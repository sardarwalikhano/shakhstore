import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side gate for dashboard routes. API handlers must still enforce
 * authorization independently; this protects the page route and its HTML.
 */
export async function requireDashboardUser(allowedRoles?: readonly string[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    redirect("/login?error=config");
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components may not be able to write refreshed cookies.
        }
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const role = String(user.app_metadata?.role ?? "customer");
  if (allowedRoles && !allowedRoles.includes(role)) {
    redirect("/dashboard");
  }

  return user;
}
