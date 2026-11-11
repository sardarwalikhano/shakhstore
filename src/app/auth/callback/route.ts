import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  const loginError = (reason: string, detail?: string | null) => {
    const target = new URL("/login", origin);
    target.searchParams.set("error", reason);
    if (detail) target.searchParams.set("detail", detail.slice(0, 240));
    return NextResponse.redirect(target);
  };

  if (providerError) {
    return loginError("oauth", searchParams.get("error_description") ?? providerError);
  }
  if (!code) {
    return loginError("callback", searchParams.get("error_description"));
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return loginError("config", "Supabase server configuration is missing.");
  }

  // Set Supabase auth cookies on the exact redirect response sent to the browser.
  const response = NextResponse.redirect(new URL(next, origin));
  const supabase = createServerClient(url, key, {
    cookieOptions: { path: "/", sameSite: "lax", secure: true },
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, { ...options, path: options?.path ?? "/" });
        });
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return loginError("exchange", error.message);
  if (!data.session || !data.user) {
    return loginError("session", "Supabase returned no session after OAuth.");
  }

  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
