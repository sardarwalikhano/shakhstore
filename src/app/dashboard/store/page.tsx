"use client";
import {useEffect,useState} from "react";
import {Store,RefreshCw,Clock3,CheckCircle2,AlertCircle} from "lucide-react";

type StoreData={id:string;name:string;slug:string;store_type:string;description:string|null;phone:string|null;address:string|null;status:string;admin_note:string|null};
const types=[{value:"restaurant",label:"چێشتخانە"},{value:"supermarket",label:"سوپەرمارکێت"},{value:"produce_vendor",label:"فرۆشیاری بەرهەم"},{value:"meat_seafood_vendor",label:"فرۆشیاری گۆشت و ماسی"}];
export default function MerchantStorePage(){
 const [store,setStore]=useState<StoreData|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [form,setForm]=useState({name:"",slug:"",storeType:"restaurant",description:"",phone:"",address:""});
 async function load(){setLoading(true);setError("");try{const r=await fetch("/api/stores",{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.error);setStore(j.store);if(j.store)setForm({name:j.store.name,slug:j.store.slug,storeType:j.store.store_type,description:j.store.description??"",phone:j.store.phone??"",address:j.store.address??""});}catch(e){setError(e instanceof Error?e.message:"بارکردن سەرکەوتوو نەبوو");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 function set<K extends keyof typeof form>(key:K,value:string){setForm(v=>({...v,[key]:value}));}
 async function submit(e:React.FormEvent){e.preventDefault();setSaving(true);setError("");setNotice("");try{const r=await fetch("/api/stores",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});const j=await r.json();if(!r.ok)throw new Error(j.error);setNotice("داواکاری دوکان نێردرا بۆ پشکنینی Super Admin.");await load();}catch(e){setError(e instanceof Error?e.message:"ناردنی داواکاری سەرکەوتوو نەبوو");}finally{setSaving(false);}}
 const input="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-orange-400";
 return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8"><div className="mx-auto max-w-3xl">
 <header className="mb-6 flex items-center justify-between"><div><p className="font-bold text-orange-600">SHAKH STORE / MERCHANT</p><h1 className="mt-2 text-3xl font-black text-slate-900">دوکانەکەم</h1><p className="mt-2 text-sm text-slate-500">زانیاری دوکان بنووسە و بۆ پەسەندکردن بینێرە</p></div><a href="/dashboard" className="rounded-xl border bg-white px-4 py-2 text-sm">داشبۆرد</a></header>
 {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
 {loading?<div className="rounded-2xl bg-white p-8 text-center">بارکردن...</div>:store&&store.status!=="rejected"?<section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><Store className="text-orange-500"/><div><h2 className="font-black">{store.name}</h2><p className="text-xs text-slate-500" dir="ltr">/{store.slug}</p></div></div><div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm">{store.status==="approved"?<CheckCircle2 className="text-green-600"/>:<Clock3 className="text-amber-600"/>}{store.status==="approved"?"دوکانەکەت پەسەند کراوە.":"داواکارییەکەت لە چاوەڕوانی پشکنینی بەڕێوەبەرە."}</div>{store.admin_note&&<p className="mt-3 text-sm text-slate-600">تێبینی بەڕێوەبەر: {store.admin_note}</p>}</section>:<form onSubmit={submit} className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
 <div><label className="mb-2 block text-sm font-bold">ناوی دوکان *</label><input required minLength={2} maxLength={120} className={input} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="ناوی دوکان"/></div>
 <div><label className="mb-2 block text-sm font-bold">لینکی تایبەتی دوکان (بە ئینگلیزی) *</label><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={input} dir="ltr" value={form.slug} onChange={e=>set("slug",e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))} placeholder="my-store"/><p className="mt-1 text-xs text-slate-400">daim-post.online/store/{form.slug||"my-store"}</p></div>
 <div><label className="mb-2 block text-sm font-bold">جۆری دوکان *</label><select className={input} value={form.storeType} onChange={e=>set("storeType",e.target.value)}>{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
 <div><label className="mb-2 block text-sm font-bold">وەسفی دوکان</label><textarea rows={3} maxLength={2000} className={input} value={form.description} onChange={e=>set("description",e.target.value)}/></div>
 <div><label className="mb-2 block text-sm font-bold">ژمارەی مۆبایل</label><input className={input} dir="ltr" value={form.phone} onChange={e=>set("phone",e.target.value)}/></div>
 <div><label className="mb-2 block text-sm font-bold">ناونیشان</label><input className={input} value={form.address} onChange={e=>set("address",e.target.value)}/></div>
 <button disabled={saving} className="w-full rounded-xl bg-orange-500 px-5 py-3 font-bold text-white disabled:opacity-50">{saving?"ناردن...":"ناردنی داواکاری بۆ پەسەندکردن"}</button>
 <p className="text-xs leading-6 text-slate-500">دوکان تا پەسەندکردنی بەڕێوەبەر لە بازاڕدا پیشان نادرێت. جۆری دوکان دەبێت لەگەڵ ڕۆڵی هەژمارەکەت یەک بگرێتەوە.</p>
 </form>}
 </div></main>;
}
