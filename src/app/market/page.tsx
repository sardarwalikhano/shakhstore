"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingCart, Store, Minus, Plus, RefreshCw } from "lucide-react";

type Product = {
  id: string; store_id: string; name: string; description: string | null;
  category: string; price_iqd: number; image_url: string | null; stock_quantity: number;
  stores: { id: string; name: string; slug: string; store_type: string; status: string; delivery_fee_iqd: number } | { id: string; name: string; slug: string; store_type: string; status: string; delivery_fee_iqd: number }[] | null;
};
const money = (n:number) => new Intl.NumberFormat("en-US").format(n) + " د.ع";
const storeOf = (p:Product) => Array.isArray(p.stores) ? p.stores[0] : p.stores;

export default function MarketPage() {
  const [products,setProducts] = useState<Product[]>([]);
  const [cart,setCart] = useState<Record<string,number>>({});
  const [address,setAddress] = useState("");
  const [loading,setLoading] = useState(true);
  const [placing,setPlacing] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/products",{cache:"no-store"});
      const data = await res.json();
      if(!res.ok) throw new Error(data.error ?? "نەتوانرا بەرهەمەکان باربکرێن.");
      setProducts(data.products ?? []);
    } catch(e) { setError(e instanceof Error ? e.message : "هەڵەیەک ڕوویدا."); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{ void load(); },[load]);

  const selected = products.filter(p => (cart[p.id] ?? 0) > 0);
  const storeIds = [...new Set(selected.map(p=>p.store_id))];
  const subtotal = useMemo(()=>selected.reduce((sum,p)=>sum+p.price_iqd*(cart[p.id]??0),0),[selected,cart]);
  const selectedStore = selected.length > 0 ? storeOf(selected[0]) : null;
  const deliveryFee = storeIds.length === 1 ? Number(selectedStore?.delivery_fee_iqd ?? 0) : 0;
  const grandTotal = subtotal + deliveryFee;
  const count = selected.reduce((sum,p)=>sum+(cart[p.id]??0),0);

  function change(p:Product,delta:number) {
    setCart(old=>{
      const next={...old},qty=Math.max(0,Math.min(p.stock_quantity,(old[p.id]??0)+delta));
      if(qty===0) delete next[p.id]; else next[p.id]=qty;
      return next;
    });
    setNotice("");
  }

  async function checkout() {
    if(selected.length===0) return;
    if(storeIds.length!==1) { setError("هەر داواکارییەک دەبێت لە یەک دوکانەوە بێت. تکایە بەرهەمەکانی دوکانێک هەڵبژێرە."); return; }
    if(address.trim().length<5) { setError("ناونیشانی گەیاندن بە وردی بنووسە."); return; }
    setPlacing(true);setError("");setNotice("");
    try {
      const res=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:selected.map(p=>({product_id:p.id,quantity:cart[p.id]})),delivery_address:address.trim(),delivery_fee_iqd:0})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error??"تۆمارکردنی داواکاری سەرکەوتوو نەبوو.");
      setCart({});setNotice("داواکارییەکەت تۆمارکرا. ژمارەی داواکاری: "+data.order_id);
      window.location.href="/dashboard/orders";
    } catch(e) { setError(e instanceof Error?e.message:"هەڵەیەک ڕوویدا."); }
    finally { setPlacing(false); }
  }

  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8">
    <div className="mx-auto max-w-7xl">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-black text-orange-600">SHAKH STORE / MARKET</p><h1 className="mt-2 text-3xl font-black text-slate-900">بازاڕ</h1><p className="mt-2 text-sm text-slate-500">بەرهەمە بەردەستەکانی دوکانە پەسەندکراوەکان</p></div>
        <div className="flex gap-2"><a href="/profile" className="rounded-xl border bg-white px-4 py-3 text-sm font-bold">پرۆفایل</a><a href="/dashboard" className="rounded-xl border bg-white px-4 py-3 text-sm font-bold">داشبۆرد</a><button onClick={()=>void load()} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-bold"><RefreshCw size={16}/> نوێکردنەوە</button></div>
      </header>
      {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {notice&&<p role="status" className="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section>
          {loading?<div className="rounded-2xl border bg-white p-12 text-center">بارکردنی بەرهەمەکان...</div>:products.length===0?<div className="rounded-2xl border bg-white p-12 text-center text-slate-500">ئێستا هیچ بەرهەمێکی چالاک و بەردەست نییە.</div>:<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {products.map(p=><article key={p.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              {p.image_url?<img src={p.image_url} alt={p.name} className="h-44 w-full object-cover"/>:<div className="grid h-44 place-items-center bg-orange-50 text-orange-300"><Store size={42}/></div>}
              <div className="p-4"><p className="text-xs font-bold text-orange-600">{storeOf(p)?.name??"SHAKH STORE"}</p><h2 className="mt-1 font-black text-slate-900">{p.name}</h2>{p.description&&<p className="mt-2 line-clamp-2 text-sm text-slate-500">{p.description}</p>}
                <div className="mt-4 flex items-center justify-between gap-2"><strong className="text-orange-600">{money(p.price_iqd)}</strong><span className={p.stock_quantity>0?"text-xs text-slate-400":"text-xs font-bold text-red-600"}>{p.stock_quantity>0?`کۆگا: ${p.stock_quantity}`:"بەردەست نییە"}</span></div>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-2"><button aria-label="کەمکردنەوە" onClick={()=>change(p,-1)} className="grid size-9 place-items-center rounded-lg border bg-white"><Minus size={16}/></button><strong>{cart[p.id]??0}</strong><button aria-label="زیادکردن" disabled={(cart[p.id]??0)>=p.stock_quantity} onClick={()=>change(p,1)} className="grid size-9 place-items-center rounded-lg bg-orange-500 text-white disabled:opacity-40"><Plus size={16}/></button></div>
              </div>
            </article>)}
          </div>}
        </section>
        <aside className="h-fit rounded-2xl border bg-white p-5 shadow-sm lg:sticky lg:top-5">
          <div className="flex items-center gap-2"><ShoppingCart className="text-orange-500"/><h2 className="text-lg font-black">سەبەتەی کڕین</h2><span className="mr-auto rounded-full bg-orange-50 px-2 py-1 text-xs font-bold text-orange-700">{count}</span></div>
          <div className="my-4 space-y-3">{selected.length===0?<p className="py-5 text-center text-sm text-slate-400">هێشتا بەرهەمێکت هەڵنەبژاردووە.</p>:selected.map(p=><div key={p.id} className="flex justify-between gap-2 text-sm"><span>{p.name} × {cart[p.id]}</span><strong>{money(p.price_iqd*cart[p.id])}</strong></div>)}</div>
          {storeIds.length>1&&<p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">بەرهەمەکان لە زیاتر لە یەک دوکانن. داواکارییەکان جیاواز تۆمار بکە.</p>}
          <label className="mb-2 block text-sm font-bold" htmlFor="delivery-address">ناونیشانی گەیاندن</label>
          <textarea id="delivery-address" value={address} onChange={e=>setAddress(e.target.value)} rows={3} maxLength={1000} placeholder="شار، گەڕەک، شەقام و نیشانە..." className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-orange-400"/>
          <div className="mt-4 space-y-2 border-t pt-4 text-sm"><div className="flex justify-between"><span className="text-slate-500">کۆی بەرهەمەکان</span><strong>{money(subtotal)}</strong></div><div className="flex justify-between"><span className="text-slate-500">کرێی گەیاندن</span><strong>{storeIds.length===1?money(deliveryFee):"—"}</strong></div><div className="flex justify-between border-t pt-2"><span className="font-black">کۆی گشتی</span><strong className="text-lg text-orange-600">{money(grandTotal)}</strong></div></div>
          <button disabled={placing||selected.length===0||storeIds.length!==1} onClick={()=>void checkout()} className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{placing?"تۆمارکردن...":"تەواوکردنی کڕین"}</button>
          <p className="mt-3 text-xs leading-5 text-slate-400">پارەدان لە کاتی گەیاندن/ڕێککەوتنی دواترەوەیە؛ گیت‌وەی پارەدان هێشتا پەیوەست نەکراوە.</p>
        </aside>
      </div>
    </div>
  </main>;
}
