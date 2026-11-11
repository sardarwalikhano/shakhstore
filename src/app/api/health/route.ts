import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public readiness endpoint.
 * Exposes configuration presence only; never returns credentials or secrets.
 */
export async function GET() {
  const checks = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabasePublicKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  const ready = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      status: ready ? "ok" : "configuration_incomplete",
      service: "shakh-store",
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
