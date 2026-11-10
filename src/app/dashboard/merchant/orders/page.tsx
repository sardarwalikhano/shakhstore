"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ClipboardList, CheckCircle2, ChefHat, PackageCheck } from "lucide-react";

type Item={id:string;product_name:string;unit_price_iqd:number;quantity:number;line_total_iqd:number};
type Order={id:string;order_number:string;store_id:string;status:string;subtotal_iqd:number;delivery_fee_iqd:number;total_iqd:number;customer_name:string|null;customer_phone:string|null;delivery_address:string;customer_note:string|null;merchant_note:string|null;created_at:string;order_items:Item[]};
const labels:Record<string,string>={pending:"نوێ / چاوەڕوانی",confirmed:"پەسەندکراو",preparing:"لە ئامادەکردندایە",ready:"ئامادەیە",assigned:"کاپتن دیاریکراوە",out_for_delivery:"لە ڕێگای گەیاندندایە",delivered:"گەیشتووە",cancelled:"هەڵوەشێنراوەتەوە"};
const actions:Record<string,{next:string;label:string;icon:typeof CheckCircle2}>={
 pending:{next:"confirmed",label:"پەسەندکردنی داواکاری",icon:CheckCircle2},
 confirmed:{next:"preparing",label:"دەستپێکردنی ئامادەکردن",icon:ChefHat},
 preparing:{next:"ready",label:"نیشانکردن وەک ئامادە",icon:PackageCheck}
};
const money=(n:number)=>new Intl.NumberFormat("en-US").format(Number(n))+" د.ع";

export default function MerchantOrdersPage(){
 const [orders,setOrders]=useState<Order[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{const res=await fetch("/api/merchant/orders",{cache:"no-store"});const data=await res.json();if(!res.ok)throw new Error(data.error??"بارکردنی داواکارییەکان سەرکەوتوو نەبوو.");setOrders(data.orders??[]);}
  catch(e){setError(e instanceof Error?e.message:"هەڵەیەک ڕوویدا.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 async function update(order:Order,next:string){
  setBusy(order.id);setError("");setNotice("");
  try{const res=await fetch("/api/merchant/orders",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({order_id:order.id,status:next})});const data=await res.json();if(!res.ok)throw new Error(data.error??"گۆڕینی دۆخ سەرکەوتوو نەبوو.");setNotice("دۆخی داواکاری "+order.order_number+" نوێکرایەوە.");await load();}
  catch(e){setError(e instanceof Error?e.message:"هەڵەیەک ڕوویدا.");}
  finally{setBusy("");}
 }
 return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8"><div className="mx-auto max-w-6xl">
  <header className="mb-7 flex flex-wrap items-center justify-between gap-3"><div><p className="font-black text-orange-600">SHAKH STORE / MERCHANT</p><h1 className="mt-2 text-3xl font-black text-slate-900">داواکارییەکانی دوکان</h1><p className="mt-2 text-sm text-slate-500">پشکنین، پەسەندکردن و نوێکردنەوەی دۆخی داواکارییەکان</p></div><div className="flex gap-2"><a href="/dashboard" className="rounded-xl border bg-white px-4 py-3 text-sm font-bold">داشبۆرد</a><button onClick={()=>void load()} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-bold"><RefreshCw size={16}/> نوێکردنەوە</button></div></header>
  {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
  {notice&&<p role="status" className="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
  {loading?<div className="rounded-2xl border bg-white p-12 text-center">بارکردن...</div>:orders.length===0?<div className="rounded-2xl border bg-white p-12 text-center"><ClipboardList className="mx-auto text-slate-300" size={40}/><p className="mt-3 font-bold">هیچ داواکارییەکی نوێ یان مێژوویی نییە.</p></div>:<div className="space-y-4">{orders.map(order=>{const action=actions[order.status];const ActionIcon=action?.icon;return <article key={order.id} className="rounded-2xl border bg-white p-5 shadow-sm">
   <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black text-slate-900">{order.order_number}</h2><p className="mt-1 text-xs text-slate-500">{new Date(order.created_at).toLocaleString("ku-IQ")}</p></div><span className="rounded-full bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700">{labels[order.status]??order.status}</span></div>
   <div className="my-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><div><p className="text-xs text-slate-500">کڕیار</p><p className="mt-1 font-bold">{order.customer_name||"کڕیاری SHAKH"}</p>{order.customer_phone&&<p className="mt-1 text-slate-600">{order.customer_phone}</p>}</div><div><p className="text-xs text-slate-500">ناونیشانی گەیاندن</p><p className="mt-1 font-bold">{order.delivery_address}</p></div></div>
   <div className="divide-y border-y">{(order.order_items??[]).map(item=><div key={item.id} className="flex justify-between gap-3 py-3 text-sm"><span>{item.product_name} × {item.quantity}</span><strong>{money(item.line_total_iqd)}</strong></div>)}</div>
   {order.customer_note&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">تێبینی کڕیار: {order.customer_note}</p>}
   <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="text-sm text-slate-600"><p>بەرهەمەکان: {money(order.subtotal_iqd)}</p><p>گەیاندن: {money(order.delivery_fee_iqd)}</p><p className="mt-1 text-base font-black text-orange-600">کۆی گشتی: {money(order.total_iqd)}</p></div>
    {action&&<button disabled={busy===order.id} onClick={()=>void update(order,action.next)} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{ActionIcon&&<ActionIcon size={17}/>}{busy===order.id?"تکایە چاوەڕێ بکە...":action.label}</button>}
   </div>
  </article>})}</div>}
 </div></main>;
}
