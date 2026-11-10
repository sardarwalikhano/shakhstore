import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MERCHANT_ROLES = ["restaurant", "supermarket", "produce_vendor", "meat_seafood_vendor"] as const;
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon || !service) {
      return NextResponse.json({ error: "Server configuration is incomplete" }, { status: 500 });
    }

    const jar = await cookies();
    const auth = createServerClient(url, anon, {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) => {
          try { items.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch {}
        },
      },
    });
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const role = String(user.app_metadata?.role ?? "customer");
    const isAdmin = role === "admin" || role === "super_admin";
    const isMerchant = MERCHANT_ROLES.includes(role as typeof MERCHANT_ROLES[number]);
    if (!isAdmin && !isMerchant) {
      return NextResponse.json({ error: "Merchant or admin access required" }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "تکایە وێنەیەک هەڵبژێرە." }, { status: 400 });
    }
    const extension = MIME_EXTENSIONS[file.type];
    if (!extension) {
      return NextResponse.json({ error: "تەنها JPG، PNG، WEBP یان AVIF ڕێگەپێدراوە." }, { status: 415 });
    }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "قەبارەی وێنە نابێت لە ٥ مێگابایت زیاتر بێت." }, { status: 413 });
    }

    const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    if (isMerchant) {
      const { data: store, error } = await db.from("stores").select("id")
        .eq("owner_id", user.id).eq("status", "approved").maybeSingle();
      if (error) throw error;
      if (!store) return NextResponse.json({ error: "دوکانەکەت هێشتا پەسەند نەکراوە." }, { status: 403 });
    }

    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await db.storage.from("product-images").upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data } = db.storage.from("product-images").getPublicUrl(path);
    return NextResponse.json({ image_url: data.publicUrl }, { status: 201 });
  } catch (error) {
    console.error("Product image upload failed", error);
    return NextResponse.json({ error: "بارکردنی وێنە سەرکەوتوو نەبوو." }, { status: 500 });
  }
}
