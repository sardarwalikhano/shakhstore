import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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
    // Show only a short, human-readable provider error; never include tokens or secrets.
    if (detail) target.searchParams.set("detail", detail.slice(0, 240));
    return NextResponse.redirect(target);
  };

  // OAuth providers can return an error without an authorization code.
  if (providerError) {
    return loginError("oauth", searchParams.get("error_description") ?? providerError);
  }

  if (!code) {
    return loginError("callback", searchParams.get("error_description"));
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return loginError("config", "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing on the server.");
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return loginError("exchange", error.message);
  }

  return NextResponse.redirect(new URL(next, origin));
}
