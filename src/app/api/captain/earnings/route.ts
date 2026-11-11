import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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
    if (authError || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (user.app_metadata?.role !== "captain") {
      return NextResponse.json({ error: "Captain account required" }, { status: 403 });
    }

    const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const [{ data: commissions, error }, { data: settings, error: settingsError }] = await Promise.all([
      db.from("captain_commissions")
        .select("id,order_id,delivery_fee_iqd,commission_rate_bps,commission_iqd,platform_share_iqd,status,completed_at,orders(order_number)")
        .eq("captain_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(200),
      db.from("captain_commission_settings")
        .select("commission_rate_bps")
        .eq("id", 1)
        .single(),
    ]);
    if (error) throw error;
    if (settingsError) throw settingsError;
    const rows = commissions ?? [];
    const accrued = rows.filter((row) => row.status === "accrued");
    const paid = rows.filter((row) => row.status === "paid");
    return NextResponse.json({
      commission_rate_bps: settings.commission_rate_bps,
      accrued_total_iqd: accrued.reduce((sum, row) => sum + Number(row.commission_iqd), 0),
      paid_total_iqd: paid.reduce((sum, row) => sum + Number(row.commission_iqd), 0),
      commissions: rows,
    });
  } catch (error) {
    console.error("Captain earnings GET failed", error);
    return NextResponse.json({ error: "داهاتی پاداشی کاپتن بەردەست نییە. دڵنیابە مایگرەیشنی 0010 جێبەجێ کراوە." }, { status: 503 });
  }
}
