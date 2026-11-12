import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function context() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return { response: NextResponse.json({ error: "Server configuration is incomplete" }, { status: 500 }) };
  const jar = await cookies();
  const auth = createServerClient(url, anon, { cookies: {
    getAll: () => jar.getAll(),
    setAll: (items) => { try { items.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch {} },
  }});
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  return { user, db: createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

export async function GET() {
  try {
    const c = await context();
    if ("response" in c) return c.response;
    const { data, error } = await c.db.from("wallet_topup_requests")
      .select("id,payment_method,amount_iqd,sender_reference,user_note,status,admin_note,created_at,reviewed_at")
      .eq("user_id", c.user.id).order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return NextResponse.json({ requests: data ?? [] });
  } catch (error) {
    console.error("Wallet top-up list failed", error);
    return NextResponse.json({ error: "Unable to load top-up requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  try {
    const c = await context();
    if ("response" in c) return c.response;
    const form = await request.formData();
    const amount = Number(form.get("amount_iqd"));
    const method = form.get("payment_method");
    const reference = form.get("sender_reference");
    const note = form.get("user_note");
    const receipt = form.get("receipt");
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000) {
      return NextResponse.json({ error: "بڕی پارە دەبێت لە ١ تا ١٠٠,٠٠٠,٠٠٠ دینار بێت." }, { status: 400 });
    }
    if (method !== "fastpay" && method !== "fib") return NextResponse.json({ error: "Payment method is invalid" }, { status: 400 });
    if (!(receipt instanceof File) || receipt.size <= 0 || receipt.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "وەسڵی پارەدان پێویستە و نابێت لە ٥MB زیاتر بێت." }, { status: 400 });
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(receipt.type)) return NextResponse.json({ error: "تەنها JPG, PNG, WEBP یان PDF قبوڵ دەکرێت." }, { status: 400 });

    const ext = receipt.type === "image/jpeg" ? "jpg" : receipt.type === "application/pdf" ? "pdf" : receipt.type.split("/")[1];
    uploadedPath = c.user.id + "/" + randomUUID() + "." + ext;
    const bytes = new Uint8Array(await receipt.arrayBuffer());
    const { error: uploadError } = await c.db.storage.from("wallet-topup-receipts")
      .upload(uploadedPath, bytes, { contentType: receipt.type, upsert: false });
    if (uploadError) throw uploadError;

    const { data, error } = await c.db.from("wallet_topup_requests").insert({
      user_id: c.user.id,
      payment_method: method,
      amount_iqd: amount,
      receipt_path: uploadedPath,
      sender_reference: typeof reference === "string" ? reference.trim().slice(0, 120) || null : null,
      user_note: typeof note === "string" ? note.trim().slice(0, 1000) || null : null,
    }).select("id,payment_method,amount_iqd,status,created_at").single();
    if (error) throw error;
    return NextResponse.json({ success: true, request: data }, { status: 201 });
  } catch (error) {
    console.error("Wallet top-up submission failed", error);
    if (uploadedPath) {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
        await db.storage.from("wallet-topup-receipts").remove([uploadedPath]);
      } catch {}
    }
    return NextResponse.json({ error: "ناردنی داواکاریی پرکردنەوەی جزدان سەرکەوتوو نەبوو." }, { status: 500 });
  }
}
