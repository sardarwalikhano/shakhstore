import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public readiness endpoint.
 * Exposes configuration presence only; never returns credentials or secrets.
 */
export async function GET() {
  const publicSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  // This public route reports only public client configuration. It must not
  // reveal whether a privileged service-role credential is configured.
  const ready = publicSupabaseConfigured;
  const checks = { publicSupabaseConfigured };

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
