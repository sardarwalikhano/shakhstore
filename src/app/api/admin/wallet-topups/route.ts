import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { createInAppNotifications } from "@/lib/server/notifications";

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
  if (user.app_metadata?.role !== "super_admin") return { response: NextResponse.json({ error: "Super Admin access required" }, { status: 403 }) };
  return { user, db: createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

export async function GET() {
  try {
    const c = await context();
    if ("response" in c) return c.response;
    const { data, error } = await c.db.from("wallet_topup_requests")
      .select("id,user_id,payment_method,amount_iqd,receipt_path,sender_reference,user_note,status,admin_note,created_at,reviewed_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const requests = await Promise.all((data ?? []).map(async (item) => {
      const [{ data: userData }, { data: signed }] = await Promise.all([
        c.db.auth.admin.getUserById(item.user_id),
        c.db.storage.from("wallet-topup-receipts").createSignedUrl(item.receipt_path, 300),
      ]);
      return { ...item, user_email: userData.user?.email ?? null, receipt_url: signed.signedUrl ?? null };
    }));
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Admin wallet top-up list failed", error);
    return NextResponse.json({ error: "Unable to load wallet top-up requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const c = await context();
    if ("response" in c) return c.response;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const v = body as Record<string, unknown>;
    if (typeof v.requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(v.requestId)) return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
    if (v.decision !== "approve" && v.decision !== "reject") return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    if (v.note !== undefined && v.note !== null && typeof v.note !== "string") return NextResponse.json({ error: "Invalid note" }, { status: 400 });

    const { data: item, error: findError } = await c.db.from("wallet_topup_requests")
      .select("id,user_id,amount_iqd,status").eq("id", v.requestId).maybeSingle();
    if (findError) throw findError;
    if (!item) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (item.status !== "pending") return NextResponse.json({ error: "Request already reviewed" }, { status: 409 });

    const { data: transactionId, error } = await c.db.rpc("review_wallet_topup", {
      p_request_id: item.id,
      p_admin_user_id: c.user.id,
      p_decision: v.decision,
      p_admin_note: typeof v.note === "string" ? v.note.trim().slice(0, 1000) : null,
    });
    if (error) throw error;
    await createInAppNotifications([{
      userId: item.user_id,
      type: "wallet",
      title: v.decision === "approve" ? "داواکاری پرکردنەوەی جزدان پەسەند کرا" : "داواکاری پرکردنەوەی جزدان ڕەتکرایەوە",
      body: v.decision === "approve"
        ? "بڕی " + new Intl.NumberFormat("en-US").format(Number(item.amount_iqd)) + " IQD بۆ جزدانەکەت زیاد کرا."
        : "داواکاری پرکردنەوەی جزدان ڕەتکرایەوە. بۆ زانیاری زیاتر تێبینی بەڕێوەبەر ببینە.",
      data: { topup_request_id: item.id, decision: v.decision },
    }]);
    return NextResponse.json({ success: true, transactionId });
  } catch (error) {
    console.error("Admin wallet top-up review failed", error);
    return NextResponse.json({ error: "پشکنین و پەسەندکردنی داواکاری سەرکەوتوو نەبوو." }, { status: 409 });
  }
}
