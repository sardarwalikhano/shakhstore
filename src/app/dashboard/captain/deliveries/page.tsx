"use client";
import {useCallback,useEffect,useState} from "react";
import {RefreshCw,MapPin,PackageCheck,Truck} from "lucide-react";
type Item={id:string;product_name:string;quantity:number};
type Delivery={id:string;order_number:string;status:string;total_iqd:number;delivery_address:string;customer_name:string|null;customer_phone:string|null;customer_note:string|null;created_at:string;assigned_at:string|null;stores:{name:string}|{name:string}[]|null;order_items:Item[]};
type Earnings={commission_rate_bps:number;accrued_total_iqd:number;paid_total_iqd:number;commissions:{id:string;order_id:string;delivery_fee_iqd:number;commission_rate_bps:number;commission_iqd:number;status:string;completed_at:string;orders:{order_number:string}|{order_number:string}[]|null}[]};
const money=(n:number)=>new Intl.NumberFormat("en-US").format(n)+" د.ع";
const storeName=(s:Delivery["stores"])=>Array.isArray(s)?s[0]?.name:s?.name;
const commissionOrderNumber=(row:Earnings["commissions"][number])=>Array.isArray(row.orders)?row.orders[0]?.order_number:row.orders?.order_number;
export default function CaptainDeliveriesPage(){
 const [deliveries,setDeliveries]=useState<Delivery[]>([]),[earnings,setEarnings]=useState<Earnings|null>(null),[earningsError,setEarningsError]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  const [deliveryResult,earningsResult]=await Promise.allSettled([
   fetch("/api/captain/deliveries",{cache:"no-store"}),
   fetch("/api/captain/earnings",{cache:"no-store"})
  ]);
  try{
   if(deliveryResult.status==="rejected")throw deliveryResult.reason;
   const r=deliveryResult.value,j=await r.json();
   if(!r.ok)throw new Error(j.error??"بارکردنی گەیاندنەکان سەرکەوتوو نەبوو.");
   setDeliveries(j.deliveries??[]);
  }catch(e){setError(e instanceof Error?e.message:"هەڵەیەک ڕوویدا.");}
  try{
   if(earningsResult.status==="rejected")throw earningsResult.reason;
   const r=earningsResult.value,j=await r.json();
   if(!r.ok)throw new Error(j.error??"بارکردنی پاداشت سەرکەوتوو نەبوو.");
   setEarnings(j);setEarningsError("");
  }catch(e){setEarnings(null);setEarningsError(e instanceof Error?e.message:"پاداشت بەردەست نییە.");}
  setLoading(false);
 },[]);
 useEffect(()=>{void load();},[load]);
 async function update(d:Delivery,next:string){setBusy(d.id);setError("");setNotice("");try{const r=await fetch("/api/captain/deliveries",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({order_id:d.id,status:next})}),j=await r.json();if(!r.ok)throw new Error(j.error??"نوێکردنەوەی دۆخ سەرکەوتوو نەبوو.");setNotice("دۆخی "+d.order_number+" نوێکرایەوە.");await load();}catch(e){setError(e instanceof Error?e.message:"هەڵەیەک ڕوویدا.");}finally{setBusy("");}}
 return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8"><div className="mx-auto max-w-5xl">
 <header className="mb-7 flex flex-wrap items-center justify-between gap-3"><div><p className="font-black text-orange-600">SHAKH STORE / CAPTAIN</p><h1 className="mt-2 text-3xl font-black">گەیاندنەکانم</h1><p className="mt-2 text-sm text-slate-500">داواکارییە دیاریکراوەکان بۆ تۆ و دۆخی گەیاندن</p></div><div className="flex gap-2"><a href="/dashboard" className="rounded-xl border bg-white px-4 py-3 text-sm font-bold">داشبۆرد</a><button onClick={()=>void load()} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-bold"><RefreshCw size={16}/> نوێکردنەوە</button></div></header>
 {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
 {earningsError&&<p role="status" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{earningsError}</p>}
 {earnings&&<section className="mb-5 grid gap-3 sm:grid-cols-3">
  <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">پاداشی تۆمارکراو (هێشتا نەدراوە)</p><strong className="mt-2 block text-2xl font-black text-orange-600">{money(earnings.accrued_total_iqd)}</strong></div>
  <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">پاداشتی پارەدراو</p><strong className="mt-2 block text-2xl font-black text-emerald-700">{money(earnings.paid_total_iqd)}</strong></div>
  <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">ڕێژەی ئێستای پاداشت</p><strong className="mt-2 block text-2xl font-black">{(earnings.commission_rate_bps/100).toLocaleString("en-US")}%</strong></div>
 </section>
 }
 {earnings&&earnings.commissions.length>0&&<section className="mb-5 rounded-2xl border bg-white p-5">
  <h2 className="mb-3 font-black">وردەکاری پاداشتی گەیاندنەکان</h2>
  <div className="divide-y">{earnings.commissions.map(row=><div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
   <div><p className="font-bold">{commissionOrderNumber(row)??row.order_id}</p><p className="mt-1 text-xs text-slate-500">{new Date(row.completed_at).toLocaleString("ku-IQ")} · کرێ: {money(Number(row.delivery_fee_iqd))}</p></div>
   <div className="text-left"><strong className="text-orange-600">{money(Number(row.commission_iqd))}</strong><p className="mt-1 text-xs text-slate-500">{(row.commission_rate_bps/100).toLocaleString("en-US")}% · {row.status==="paid"?"پارەدراو":row.status==="voided"?"هەڵوەشێنراوە":"تۆمارکراو / نەدراوە"}</p></div>
  </div>)}</div>
 </section>}
 {loading?<div className="rounded-2xl border bg-white p-10 text-center">بارکردن...</div>:deliveries.length===0?<div className="rounded-2xl border bg-white p-12 text-center text-slate-500">هێشتا هیچ داواکارییەک بۆ تۆ دیاری نەکراوە.</div>:<div className="space-y-4">{deliveries.map(d=><article key={d.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-black">{d.order_number}</h2><p className="mt-1 text-xs text-slate-500">{storeName(d.stores)??"دوکان"} · {new Date(d.assigned_at??d.created_at).toLocaleString("ku-IQ")}</p></div><span className="rounded-full bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700">{d.status==="assigned"?"نوێ / وەرگیراو":d.status==="out_for_delivery"?"لە ڕێگای گەیاندندایە":"گەیشتووە"}</span></div>
 <div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="flex items-center gap-2 text-sm font-bold"><MapPin size={17} className="text-orange-500"/> {d.delivery_address}</p><p className="mt-2 text-sm">کڕیار: {d.customer_name??"کڕیاری SHAKH"}</p>{d.customer_phone&&<p className="mt-1 text-sm">مۆبایل: <a className="font-bold text-orange-600" href={"tel:"+d.customer_phone}>{d.customer_phone}</a></p>}</div>
 <div className="my-4 divide-y border-y">{(d.order_items??[]).map(i=><div key={i.id} className="flex justify-between py-2 text-sm"><span>{i.product_name}</span><strong>× {i.quantity}</strong></div>)}</div>
 <div className="flex flex-wrap items-center justify-between gap-3"><strong className="text-orange-600">{money(d.total_iqd)}</strong>{d.status==="assigned"?<button disabled={busy===d.id} onClick={()=>void update(d,"out_for_delivery")} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><Truck size={17}/>{busy===d.id?"چاوەڕێ...":"دەستپێکردنی گەیاندن"}</button>:d.status==="out_for_delivery"?<button disabled={busy===d.id} onClick={()=>void update(d,"delivered")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><PackageCheck size={17}/>{busy===d.id?"چاوەڕێ...":"پشتڕاستکردنەوەی گەیشتن"}</button>:<span className="text-sm font-bold text-emerald-700">گەیاندن تەواو بوو</span>}</div>
 </article>)}</div>}
 </div></main>;
}
