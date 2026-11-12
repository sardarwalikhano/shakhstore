import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

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
    const { data, error } = await c.db.from("wallet_cashout_requests")
      .select("id,requested_amount_iqd,cash_amount_iqd,platform_fee_iqd,payout_method,payout_phone,status,user_note,admin_note,created_at,reviewed_at,paid_at")
      .eq("user_id", c.user.id).order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return NextResponse.json({ requests: data ?? [] });
  } catch (error) {
    console.error("Cashout history failed", error);
    return NextResponse.json({ error: "بارکردنی مێژووی کاش ئاوت سەرکەوتوو نەبوو." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const c = await context();
    if ("response" in c) return c.response;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const value = body as Record<string, unknown>;
    const amount = Number(value.amount_iqd);
    const method = value.payout_method;
    const phone = typeof value.payout_phone === "string" ? value.payout_phone.trim() : "";
    const note = typeof value.user_note === "string" ? value.user_note.trim().slice(0, 1000) : null;
    if (!Number.isSafeInteger(amount) || amount < 4) return NextResponse.json({ error: "کەمترین بڕی کاش ئاوت ٤ دینارە." }, { status: 400 });
    if (method !== "fastpay" && method !== "fib") return NextResponse.json({ error: "شێوازی وەرگرتنی پارە هەڵبژێرە." }, { status: 400 });
    if (!/^[0-9+() -]{7,24}$/.test(phone)) return NextResponse.json({ error: "ژمارەی FastPay/FIB دروست نییە." }, { status: 400 });
    const { data, error } = await c.db.rpc("request_wallet_cashout_with_destination", {
      p_amount_iqd: amount, p_payout_method: method, p_payout_phone: phone, p_user_note: note,
    });
    if (error) return NextResponse.json({ error: error.message.includes("Insufficient") ? "باڵانسی بەردەستت بەس نییە." : "ناردنی داواکاری کاش ئاوت سەرکەوتوو نەبوو." }, { status: 409 });
    return NextResponse.json({ success: true, requestId: data }, { status: 201 });
  } catch (error) {
    console.error("Cashout submission failed", error);
    return NextResponse.json({ error: "ناردنی داواکاری کاش ئاوت سەرکەوتوو نەبوو." }, { status: 500 });
  }
}
