import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = [
  "customer",
  "captain",
  "restaurant",
  "supermarket",
  "produce_vendor",
  "meat_seafood_vendor",
  "admin",
  "super_admin",
] as const;

async function authorize() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return { response: NextResponse.json({ error: "Server configuration is incomplete" }, { status: 500 }) };
  }

  const cookieStore = await cookies();
  const authClient = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
      },
    },
  });
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) {
    return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }
  if (user.app_metadata?.role !== "super_admin") {
    return { response: NextResponse.json({ error: "Super Admin access required" }, { status: 403 }) };
  }

  const adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { user, adminClient };
}

export async function GET(request: Request) {
  try {
    const auth = await authorize();
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
    const { data, error } = await auth.adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;

    const users = data.users
      .filter((user) => !query || (user.email ?? "").toLowerCase().includes(query) ||
        String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "").toLowerCase().includes(query))
      .map((user) => ({
        id: user.id,
        email: user.email ?? null,
        name: String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? ""),
        role: String(user.app_metadata?.role ?? "customer"),
        created_at: user.created_at,
        email_confirmed: Boolean(user.email_confirmed_at),
      }));

    return NextResponse.json({ users, roles: ROLES });
  } catch (error) {
    console.error("Admin users list failed:", error);
    return NextResponse.json({ error: "Unable to load users" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authorize();
    if ("response" in auth) return auth.response;

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { userId, role } = body as { userId?: unknown; role?: unknown };
    if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }
    if (typeof role !== "string" || !ROLES.includes(role as typeof ROLES[number])) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (userId === auth.user.id) {
      return NextResponse.json({ error: "You cannot change your own role" }, { status: 409 });
    }

    const { data: target, error: getError } = await auth.adminClient.auth.admin.getUserById(userId);
    if (getError || !target.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const appMetadata = { ...(target.user.app_metadata ?? {}), role };
    const { data, error } = await auth.adminClient.auth.admin.updateUserById(userId, {
      app_metadata: appMetadata,
    });
    if (error) throw error;

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
        role: String(data.user.app_metadata?.role ?? "customer"),
      },
    });
  } catch (error) {
    console.error("Admin user role update failed:", error);
    return NextResponse.json({ error: "Unable to update user role" }, { status: 500 });
  }
}
