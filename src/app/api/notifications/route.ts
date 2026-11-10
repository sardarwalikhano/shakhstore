import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase environment is not configured");

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Cookie writes may be unavailable in a Server Component context.
        }
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  return { supabase, user };
}

export async function GET() {
  try {
    const auth = await getUserClient();
    if ("response" in auth) return auth.response;

    const { data, error } = await auth.supabase
      .from("notifications")
      .select("id,type,title,body,data,read_at,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    const notifications = data ?? [];
    return NextResponse.json({
      notifications,
      unreadCount: notifications.filter((item) => item.read_at === null).length,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Notifications GET failed:", error);
    return NextResponse.json({ error: "Unable to load notifications" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getUserClient();
    if ("response" in auth) return auth.response;

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { notificationId, markAll } = body as { notificationId?: unknown; markAll?: unknown };
    let query = auth.supabase.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("user_id", auth.user.id).is("read_at", null);

    if (markAll === true) {
      // Mark only this authenticated user's unread notifications.
    } else if (typeof notificationId === "string" && /^[0-9a-f-]{36}$/i.test(notificationId)) {
      query = query.eq("id", notificationId);
    } else {
      return NextResponse.json({ error: "A valid notificationId or markAll=true is required" }, { status: 400 });
    }

    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Notifications PATCH failed:", error);
    return NextResponse.json({ error: "Unable to update notifications" }, { status: 500 });
  }
}
