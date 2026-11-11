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
  if (!url || !anon || !service) {
    return { response: NextResponse.json({ error: "Server configuration is incomplete" }, { status: 500 }) };
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
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  const role = String(user.app_metadata?.role ?? "");
  if (role !== "admin" && role !== "super_admin") {
    return { response: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }
  const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  return { user, db };
}

export async function GET() {
  try {
    const c = await context();
    if ("response" in c) return c.response;
    const { data, error } = await c.db.from("captain_commission_settings")
      .select("commission_rate_bps,updated_at,updated_by").eq("id", 1).single();
    if (error) throw error;
    return NextResponse.json({ settings: data });
  } catch (error) {
    console.error("Captain commission settings GET failed", error);
    return NextResponse.json({ error: "ڕێکخستنی پاداشتی کاپتن بەردەست نییە. دڵنیابە مایگرەیشنی 0010 جێبەجێ کراوە." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const c = await context();
    if ("response" in c) return c.response;
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const value = (raw as Record<string, unknown>).commission_rate_bps;
    const rate = Number(value);
    if (!Number.isSafeInteger(rate) || rate < 0 || rate > 10000) {
      return NextResponse.json({ error: "ڕێژە دەبێت لە ٠ تا ١٠٠٪ بێت." }, { status: 400 });
    }
    const { data, error } = await c.db.from("captain_commission_settings")
      .update({ commission_rate_bps: rate, updated_by: c.user.id, updated_at: new Date().toISOString() })
      .eq("id", 1)
      .select("commission_rate_bps,updated_at,updated_by")
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, settings: data });
  } catch (error) {
    console.error("Captain commission settings PATCH failed", error);
    return NextResponse.json({ error: "پاشەکەوتکردنی ڕێژەی پاداشت سەرکەوتوو نەبوو." }, { status: 503 });
  }
}
