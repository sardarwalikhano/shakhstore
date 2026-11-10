import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuthorizedAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    throw new Error("Supabase server environment is not configured");
  }

  const cookieStore = await cookies();
  const authClient = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies; Route Handlers can.
        }
      },
    },
  });

  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) {
    return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }

  // app_metadata is controlled by trusted server-side admin operations.
  if (user.app_metadata?.role !== "super_admin") {
    return { response: NextResponse.json({ error: "Super Admin access required" }, { status: 403 }) };
  }

  const adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { user, adminClient };
}

export async function GET() {
  try {
    const auth = await getAuthorizedAdmin();
    if ("response" in auth) return auth.response;

    const { data, error } = await auth.adminClient
      .from("wallet_cashout_requests")
      .select("id,user_id,requested_amount_iqd,cash_amount_iqd,platform_fee_iqd,status,user_note,admin_note,created_at,reviewed_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const requests = await Promise.all((data ?? []).map(async (request) => {
      const { data: userData } = await auth.adminClient.auth.admin.getUserById(request.user_id);
      return {
        ...request,
        user_email: userData.user?.email ?? null,
      };
    }));

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Cashout list failed:", error);
    return NextResponse.json({ error: "Unable to load cashout requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthorizedAdmin();
    if ("response" in auth) return auth.response;

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { requestId, decision, note } = body as {
      requestId?: unknown;
      decision?: unknown;
      note?: unknown;
    };

    if (typeof requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(requestId)) {
      return NextResponse.json({ error: "Invalid cashout request ID" }, { status: 400 });
    }
    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json({ error: "Decision must be approve or reject" }, { status: 400 });
    }
    if (note !== undefined && note !== null && typeof note !== "string") {
      return NextResponse.json({ error: "Invalid admin note" }, { status: 400 });
    }

    const { data, error } = await auth.adminClient.rpc("review_wallet_cashout", {
      p_request_id: requestId,
      p_admin_user_id: auth.user.id,
      p_decision: decision,
      p_admin_note: typeof note === "string" ? note.slice(0, 1000) : null,
    });

    if (error) {
      console.error("Cashout review RPC failed:", error);
      return NextResponse.json({ error: "Cashout review failed" }, { status: 409 });
    }

    return NextResponse.json({ success: true, transactionId: data });
  } catch (error) {
    console.error("Cashout review failed:", error);
    return NextResponse.json({ error: "Unable to review cashout request" }, { status: 500 });
  }
}
