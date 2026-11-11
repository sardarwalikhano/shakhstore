import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function context() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return { response: NextResponse.json({ error: "Server configuration is incomplete" }, { status: 500 }) };
  const jar = await cookies();
  const auth = createServerClient(url, anon, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => { try { items.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch {} },
    },
  });
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  return { user, role: String(user.app_metadata?.role ?? "customer"), db: createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

export async function GET() {
  try {
    const c = await context();
    if ("response" in c) return c.response;
    const { data, error } = await c.db.from("orders")
      .select("id,order_number,store_id,status,subtotal_iqd,delivery_fee_iqd,total_iqd,delivery_address,customer_note,created_at,order_items(id,product_name,unit_price_iqd,quantity,line_total_iqd)")
      .eq("customer_id", c.user.id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ orders: data ?? [] });
  } catch (error) {
    console.error("Orders GET failed", error);
    return NextResponse.json({ error: "Unable to load orders" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const c = await context();
    if ("response" in c) return c.response;
    if (c.role !== "customer") return NextResponse.json({ error: "Customer account required" }, { status: 403 });
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const v = raw as Record<string, unknown>;
    if (!Array.isArray(v.items) || v.items.length < 1 || v.items.length > 50) {
      return NextResponse.json({ error: "داواکاری دەبێت ١ تا ٥٠ بەرهەمی تێدا بێت." }, { status: 400 });
    }
    const parsedItems = v.items.map((item) => {
      if (!item || typeof item !== "object") throw new Error("Invalid order item");
      const row = item as Record<string, unknown>;
      return { product_id: String(row.product_id ?? ""), quantity: Number(row.quantity) };
    });
    if (parsedItems.some((item) => !/^[0-9a-f-]{36}$/i.test(item.product_id) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000)) {
      return NextResponse.json({ error: "ژمارە یان ناسنامەی بەرهەم دروست نییە." }, { status: 400 });
    }
    // Collapse repeated product IDs so stock validation and decrement use the combined quantity.
    const quantities = new Map<string, number>();
    for (const item of parsedItems) quantities.set(item.product_id, (quantities.get(item.product_id) ?? 0) + item.quantity);
    const items = Array.from(quantities, ([product_id, quantity]) => ({ product_id, quantity }));
    if (items.some((item) => item.quantity > 10000)) {
      return NextResponse.json({ error: "کۆی ژمارەی بەرهەمی دووبارەکراو زۆرە." }, { status: 400 });
    }
    const address = typeof v.delivery_address === "string" ? v.delivery_address.trim() : "";
    if (address.length < 5 || address.length > 1000) {
      return NextResponse.json({ error: "ناونیشانی گەیاندن پێویستە." }, { status: 400 });
    }
    // The database trigger replaces this placeholder with the approved store's configured fee.
    const { data, error } = await c.db.rpc("place_store_order", {
      p_customer_id: c.user.id,
      p_items: items,
      p_delivery_address: address,
      p_customer_name: typeof v.customer_name === "string" ? v.customer_name.slice(0, 120) : null,
      p_customer_phone: typeof v.customer_phone === "string" ? v.customer_phone.slice(0, 40) : null,
      p_customer_note: typeof v.customer_note === "string" ? v.customer_note.slice(0, 1000) : null,
      p_delivery_fee_iqd: 0,
    });
    if (error) {
      const message = error.message.includes("Insufficient stock") ? "کۆگای بەرهەم بەشی ئەم داواکارییە ناکات." :
        error.message.includes("unavailable") ? "بەرهەم یان دوکان بەردەست نییە." : "تۆمارکردنی داواکاری سەرکەوتوو نەبوو.";
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ order_id: data }, { status: 201 });
  } catch (error) {
    console.error("Orders POST failed", error);
    return NextResponse.json({ error: "تۆمارکردنی داواکاری سەرکەوتوو نەبوو." }, { status: 500 });
  }
}
