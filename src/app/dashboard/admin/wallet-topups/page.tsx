"use client";

import { useCallback, useEffect, useState } from "react";

type RequestItem = {
  id: string; user_id: string; user_email: string | null;
  payment_method: "fastpay" | "fib"; amount_iqd: number; receipt_url: string | null;
  sender_reference: string | null; user_note: string | null;
  status: "pending" | "approved" | "rejected"; admin_note: string | null;
  created_at: string; reviewed_at: string | null;
};
const money = (n: number) => new Intl.NumberFormat("en-US").format(n) + " IQD";

export default function AdminWalletTopupsPage() {
  const [items,setItems]=useState<RequestItem[]>([]);
  const [filter,setFilter]=useState<"pending"|"approved"|"rejected"|"all">("pending");
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{const r=await fetch("/api/admin/wallet-topups",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error??"بارکردن سەرکەوتوو نەبوو");setItems(d.requests??[]);}
    catch(e){setError(e instanceof Error?e.message:"هەڵەیەک ڕوویدا");}finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  async function review(id:string,decision:"approve"|"reject"){
    if(!window.confirm(decision==="approve"?"دڵنیایت؟ باڵانسی ئەم بەکارهێنەرە زیاد دەکرێت.":"دڵنیایت لە ڕەتکردنەوە؟"))return;
    setBusy(id);setError("");setNotice("");
    try{const r=await fetch("/api/admin/wallet-topups",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId:id,decision,note:notes[id]??""})});const d=await r.json();if(!r.ok)throw new Error(d.error??"پشکنین سەرکەوتوو نەبوو");setNotice(decision==="approve"?"داواکاری پەسەند کرا و باڵانس زیاد کرا.":"داواکاری ڕەتکرایەوە.");await load();}
    catch(e){setError(e instanceof Error?e.message:"هەڵەیەک ڕوویدا");}finally{setBusy(null);}
  }
  const visible=items.filter(x=>filter==="all"||x.status===filter);
  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-6xl space-y-6">
    <header><p className="text-sm font-bold text-orange-600">SHAKH STORE / SUPER ADMIN</p><h1 className="mt-2 text-3xl font-black">پشکنینی پرکردنەوەی جزدان</h1><p className="mt-2 text-sm text-slate-600">وەسڵ و بڕی پارە بپشکنە؛ تەنها پاش دڵنیابوون پەسەندی بکە.</p></header>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">هەموو داواکارییەکان</p><strong className="text-2xl">{items.length}</strong></div><div className="rounded-xl border bg-amber-50 p-4"><p className="text-sm text-amber-800">چاوەڕوان</p><strong className="text-2xl">{items.filter(x=>x.status==="pending").length}</strong></div><div className="rounded-xl border bg-emerald-50 p-4"><p className="text-sm text-emerald-800">پەسەندکراو</p><strong className="text-2xl">{items.filter(x=>x.status==="approved").length}</strong></div></div>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className="flex flex-wrap gap-2">{(["pending","approved","rejected","all"] as const).map(x=><button key={x} onClick={()=>setFilter(x)} className={`rounded-full px-4 py-2 text-sm font-bold ${filter===x?"bg-slate-900 text-white":"border bg-white"}`}>{x==="pending"?"چاوەڕوان":x==="approved"?"پەسەندکراو":x==="rejected"?"ڕەتکراوە":"هەموو"}</button>)}<button onClick={()=>void load()} className="mr-auto rounded-xl border bg-white px-4 py-2 text-sm font-bold">نوێکردنەوە</button></div>
    {loading?<p className="rounded-xl bg-white p-8 text-center">بارکردن...</p>:visible.length===0?<p className="rounded-xl bg-white p-8 text-center text-slate-500">داواکاری نییە.</p>:<div className="space-y-4">{visible.map(x=><article key={x.id} className="rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap justify-between gap-3"><div><strong>{x.user_email??x.user_id}</strong><p className="mt-1 text-xs text-slate-500">{new Date(x.created_at).toLocaleString("ckb-IQ")}</p></div><span className="font-bold">{x.status==="pending"?"چاوەڕوان":x.status==="approved"?"پەسەندکراو":"ڕەتکراوە"}</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">بڕ</p><strong>{money(x.amount_iqd)}</strong></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">ڕێگای پارەدان</p><strong>{x.payment_method==="fastpay"?"FastPay":"FIB"}</strong></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">ژمارەی مامەڵە</p><strong>{x.sender_reference??"—"}</strong></div></div>
      {x.receipt_url?<a href={x.receipt_url} target="_blank" rel="noreferrer" className="mt-4 inline-block font-bold text-orange-700 underline">بینینی وەسڵ</a>:<p className="mt-3 text-sm text-red-600">لینکی وەسڵ بەردەست نییە.</p>}
      {x.user_note&&<p className="mt-2 text-sm text-slate-600">تێبینی بەکارهێنەر: {x.user_note}</p>}
      {x.status==="pending"&&<div className="mt-4 border-t pt-4"><label className="mb-2 block text-sm font-bold">تێبینی Super Admin</label><textarea value={notes[x.id]??""} onChange={e=>setNotes(p=>({...p,[x.id]:e.target.value}))} maxLength={1000} rows={2} className="w-full rounded-xl border p-3"/><div className="mt-3 flex gap-2"><button disabled={busy!==null} onClick={()=>void review(x.id,"approve")} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50">{busy===x.id?"چاوەڕێ...":"پەسەندکردن و زیادکردنی باڵانس"}</button><button disabled={busy!==null} onClick={()=>void review(x.id,"reject")} className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white disabled:opacity-50">ڕەتکردنەوە</button></div></div>}
    </article>)}</div>}
  </div></main>;
}
