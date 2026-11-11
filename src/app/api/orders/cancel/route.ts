import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { createInAppNotifications } from "@/lib/server/notifications";

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
  if (error || !user) {
    return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }

  const role = String(user.app_metadata?.role ?? "customer");
  if (role !== "customer") {
    return { response: NextResponse.json({ error: "Customer account required" }, { status: 403 }) };
  }

  const db = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { user, db };
}

export async function POST(request: Request) {
  try {
    const c = await context();
    if ("response" in c) return c.response;

    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const orderId = (raw as Record<string, unknown>).order_id;
    if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    // This ownership-scoped read is for the merchant notification only.
    // The database RPC repeats ownership and status validation under FOR UPDATE.
    const { data: order, error: orderError } = await c.db
      .from("orders")
      .select("id,order_number,status,customer_id,stores(owner_id)")
      .eq("id", orderId)
      .eq("customer_id", c.user.id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status !== "pending") {
      return NextResponse.json({ error: "Only pending orders can be cancelled" }, { status: 409 });
    }

    const { data, error } = await c.db.rpc("cancel_customer_order", {
      p_order_id: orderId,
      p_customer_id: c.user.id,
    });
    if (error) {
      console.error("Customer order cancellation RPC failed:", error.message);
      const notFound = error.message.toLowerCase().includes("order not found");
      return NextResponse.json(
        { error: notFound ? "Order not found" : "Order could not be cancelled. Refresh and try again." },
        { status: notFound ? 404 : 409 },
      );
    }

    const relation = order.stores as { owner_id?: string | null } | { owner_id?: string | null }[] | null;
    const store = Array.isArray(relation) ? relation[0] : relation;
    if (store?.owner_id) {
      await createInAppNotifications([{
        userId: store.owner_id,
        type: "order",
        title: "داواکارییەک هەڵوەشێنرایەوە",
        body: "کڕیار داواکاری " + String(order.order_number ?? "") + " هەڵوەشاندەوە.",
        data: { order_id: orderId, status: "cancelled" },
      }]);
    }

    return NextResponse.json({ success: true, order_id: data });
  } catch (error) {
    console.error("Customer order cancellation failed:", error);
    return NextResponse.json({ error: "هەڵوەشاندنەوەی داواکاری سەرکەوتوو نەبوو." }, { status: 500 });
  }
}
