"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ClipboardList, XCircle } from "lucide-react";

type Item = { id: string; product_name: string; unit_price_iqd: number; quantity: number; line_total_iqd: number };
type Order = { id: string; order_number: string; status: string; subtotal_iqd: number; delivery_fee_iqd: number; total_iqd: number; delivery_address: string; customer_note: string | null; created_at: string; order_items: Item[] };
const labels: Record<string,string> = { pending:"چاوەڕوانی دوکان", confirmed:"پەسەندکراو", preparing:"ئامادەکردن", ready:"ئامادەیە", assigned:"کاپتن دیاریکراوە", out_for_delivery:"لە ڕێگای گەیاندندایە", delivered:"گەیشتووە", cancelled:"هەڵوەشێنراوەتەوە" };
const money = (n:number) => new Intl.NumberFormat("en-US").format(Number(n)) + " د.ع";

export default function OrdersPage() {
  const [orders,setOrders] = useState<Order[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState("");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/orders",{cache:"no-store"});
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setOrders(json.orders ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "بارکردنی داواکارییەکان سەرکەوتوو نەبوو."); }
    finally { setLoading(false); }
  },[]);
  useEffect(() => { void load(); },[load]);

  async function cancelOrder(order: Order) {
    const confirmed = window.confirm("دڵنیایت لە هەڵوەشاندنەوەی ئەم داواکارییە؟ تەنها داواکاریی چاوەڕوانی دوکان دەتوانرێت هەڵبوەشێنرێتەوە.");
    if (!confirmed) return;

    setBusy(order.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "هەڵوەشاندنەوەی داواکاری سەرکەوتوو نەبوو.");
      setNotice("داواکاری " + order.order_number + " هەڵوەشێنرایەوە و کاڵاکان گەڕێنرانەوە بۆ کۆگا.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "هەڵەیەک ڕوویدا.");
    } finally {
      setBusy("");
    }
  }

  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8"><div className="mx-auto max-w-5xl">
    <header className="mb-7 flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-orange-600">SHAKH STORE / ORDERS</p><h1 className="mt-2 text-3xl font-black">داواکارییەکانم</h1><p className="mt-2 text-sm text-slate-500">شوێنکەوتنی دۆخ و وردەکاری داواکارییەکان</p></div><div className="flex gap-2"><a href="/dashboard" className="rounded-xl border bg-white px-4 py-3 text-sm">داشبۆرد</a><button onClick={()=>void load()} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm"><RefreshCw size={16}/> نوێکردنەوە</button></div></header>
    {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {notice&&<p role="status" className="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
    {loading?<div className="rounded-2xl border bg-white p-10 text-center">بارکردن...</div>:orders.length===0?<div className="rounded-2xl border bg-white p-12 text-center"><ClipboardList className="mx-auto text-slate-300" size={38}/><p className="mt-3 font-bold">هێشتا هیچ داواکارییەکت نییە.</p></div>:<div className="space-y-4">{orders.map(order=><article key={order.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-black">{order.order_number}</h2><p className="mt-1 text-xs text-slate-500">{new Date(order.created_at).toLocaleString("ku-IQ")}</p></div><span className="rounded-full bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700">{labels[order.status]??order.status}</span></div><div className="my-4 divide-y border-y">{(order.order_items??[]).map(item=><div key={item.id} className="flex justify-between gap-3 py-3 text-sm"><span>{item.product_name} × {item.quantity}</span><strong>{money(item.line_total_iqd)}</strong></div>)}</div><div className="space-y-1 text-sm text-slate-600"><p>ناونیشانی گەیاندن: {order.delivery_address}</p><p>کۆی بەرهەمەکان: {money(order.subtotal_iqd)}</p><p>کرێی گەیاندن: {money(order.delivery_fee_iqd)}</p></div><p className="mt-3 text-lg font-black text-orange-600">کۆی گشتی: {money(order.total_iqd)}</p>
      {order.status==="pending"&&<div className="mt-4 flex justify-start"><button type="button" disabled={busy===order.id} onClick={()=>void cancelOrder(order)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"><XCircle size={17}/>{busy===order.id?"تکایە چاوەڕێ بکە...":"هەڵوەشاندنەوەی داواکاری"}</button></div>}
    </article>)}</div>}
  </div></main>;
}
