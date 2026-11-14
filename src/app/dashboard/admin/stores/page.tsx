"use client";
import {useCallback,useEffect,useState} from "react";
import {RefreshCw,CheckCircle2,XCircle,Clock3} from "lucide-react";
type StoreRow={id:string;owner_id:string;owner_email:string|null;name:string;slug:string;store_type:string;description:string|null;phone:string|null;address:string|null;status:string;delivery_fee_iqd:number|null;service_center_lat:number|null;service_center_lng:number|null;service_radius_km:number|null;admin_note:string|null;created_at:string};
const labels:Record<string,string>={restaurant:"چێشتخانە",supermarket:"سوپەرمارکێت",produce_vendor:"فرۆشیاری بەرهەم",meat_seafood_vendor:"فرۆشیاری گۆشت و ماسی"};
export default function AdminStoresPage(){
 const [rows,setRows]=useState<StoreRow[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[feeBusy,setFeeBusy]=useState(""),[feeInputs,setFeeInputs]=useState<Record<string,string>>({}),[zoneInputs,setZoneInputs]=useState<Record<string,{lat:string;lng:string;radius:string}>>({}),[zoneBusy,setZoneBusy]=useState(""),[filter,setFilter]=useState("pending"),[notes,setNotes]=useState<Record<string,string>>({}),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");try{const r=await fetch("/api/admin/stores",{cache:"no-store"}),j=await r.json();if(!r.ok)throw new Error(j.error);setRows(j.stores??[]);setFeeInputs(Object.fromEntries((j.stores??[]).map((s:StoreRow)=>[s.id,s.delivery_fee_iqd===null?"":String(s.delivery_fee_iqd??0)])));setZoneInputs(Object.fromEntries((j.stores??[]).map((s:StoreRow)=>[s.id,{lat:s.service_center_lat===null||s.service_center_lat===undefined?"":String(s.service_center_lat),lng:s.service_center_lng===null||s.service_center_lng===undefined?"":String(s.service_center_lng),radius:s.service_radius_km===null||s.service_radius_km===undefined?"":String(s.service_radius_km)}])));}catch(e){setError(e instanceof Error?e.message:"بارکردن سەرکەوتوو نەبوو");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 async function review(id:string,status:"approved"|"rejected"){if(!window.confirm(status==="approved"?"دڵنیایت لە پەسەندکردنی دوکان؟":"دڵنیایت لە ڕەتکردنەوەی داواکاری؟"))return;setBusy(id);setError("");setNotice("");try{const r=await fetch("/api/admin/stores",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({storeId:id,status,note:notes[id]??""})}),j=await r.json();if(!r.ok)throw new Error(j.error);setNotice(status==="approved"?"دوکان پەسەند کرا.":"داواکارییەکە ڕەتکرایەوە.");await load();}catch(e){setError(e instanceof Error?e.message:"کردارەکە سەرکەوتوو نەبوو");}finally{setBusy("");}}
 async function saveDeliveryFee(id:string){
  const fee=Number(feeInputs[id]??"0");
  if(!Number.isSafeInteger(fee)||fee<0||fee>100000000){setError("کرێی گەیاندن دەبێت ژمارەیەکی دروست لە ٠ تا ١٠٠,٠٠٠,٠٠٠ دینار بێت.");return;}
  setFeeBusy(id);setError("");setNotice("");
  try{
   const r=await fetch("/api/admin/stores",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({storeId:id,deliveryFeeIqd:fee})}),j=await r.json();
   if(!r.ok)throw new Error(j.error);
   setNotice("کرێی گەیاندن پاشەکەوت کرا.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"پاشەکەوتکردنی کرێ سەرکەوتوو نەبوو.");}
  finally{setFeeBusy("");}
 }

 function captureZoneCenter(id:string){
  if(!navigator.geolocation){setError("ئەم وێبگەڕە شوێنی GPS پشتگیری ناکات.");return;}
  setZoneBusy(id);setError("");setNotice("");
  navigator.geolocation.getCurrentPosition(position=>{
   setZoneInputs(v=>({...v,[id]:{lat:position.coords.latitude.toFixed(6),lng:position.coords.longitude.toFixed(6),radius:v[id]?.radius??""}}));
   setZoneBusy("");
   setNotice("ناوەندی ناوچەی گەیاندن دیاری کرا؛ مەودای کیلۆمەتر بنووسە و پاشەکەوتی بکە.");
  },geoError=>{
   setZoneBusy("");
   setError(geoError.code===1?"مۆڵەتی شوێن ڕەتکرایەوە؛ ڕێگە بە GPS بدە و دووبارە هەوڵ بدە.":"نەتوانرا شوێنی دوکان وەربگیرێت؛ دڵنیابە GPS چالاکە.");
  },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
 }
 async function saveServiceZone(id:string){
  const values=zoneInputs[id];
  const lat=Number(values?.lat),lng=Number(values?.lng),radius=Number(values?.radius);
  if(!Number.isFinite(lat)||lat < -90||lat > 90||!Number.isFinite(lng)||lng < -180||lng > 180||!Number.isFinite(radius)||radius < 0.1||radius > 100){
   setError("ناوەندی GPS دروست بکە و مەودای ناوچە لە ٠.١ تا ١٠٠ کیلۆمەتر دیاری بکە.");return;
  }
  setZoneBusy(id);setError("");setNotice("");
  try{
   const r=await fetch("/api/admin/stores",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({storeId:id,serviceCenterLat:lat,serviceCenterLng:lng,serviceRadiusKm:radius})});
   const j=await r.json();if(!r.ok)throw new Error(j.error??"پاشەکەوتکردنی ناوچە سەرکەوتوو نەبوو.");
   setNotice("ناوچەی فرۆشتن و مەودای گەیاندن پاشەکەوت کرا.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"پاشەکەوتکردنی ناوچە سەرکەوتوو نەبوو.");}
  finally{setZoneBusy("");}
 }
 async function clearServiceZone(id:string){
  if(!window.confirm("دڵنیایت لە لابردنی ناوچەی گەیاندن؟ تا دیاریکردنەوەی ناوچەی نوێ، ئۆردەر وەرناگیرێت."))return;
  setZoneBusy(id);setError("");setNotice("");
  try{
   const r=await fetch("/api/admin/stores",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({storeId:id,serviceCenterLat:null,serviceCenterLng:null,serviceRadiusKm:null})});
   const j=await r.json();if(!r.ok)throw new Error(j.error??"لابردنی ناوچە سەرکەوتوو نەبوو.");
   setNotice("ناوچەی گەیاندن لابرا.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"لابردنی ناوچە سەرکەوتوو نەبوو.");}
  finally{setZoneBusy("");}
 }
 const visible=rows.filter(r=>filter==="all"||r.status===filter);
 return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8"><div className="mx-auto max-w-6xl">
 <header className="mb-7 flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-orange-600">SHAKH STORE / ADMIN</p><h1 className="mt-2 text-3xl font-black">پشکنینی دوکانەکان</h1><p className="mt-2 text-sm text-slate-500">داواکارییەکانی Merchant پشکنین و پەسەند بکە</p></div><button onClick={()=>void load()} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm"><RefreshCw size={16}/> نوێکردنەوە</button></header>
 {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
 <div className="mb-5 flex flex-wrap gap-2">{["pending","approved","rejected","all"].map(x=><button key={x} onClick={()=>setFilter(x)} className={filter===x?"rounded-full bg-slate-900 px-4 py-2 text-sm text-white":"rounded-full border bg-white px-4 py-2 text-sm"}>{x==="pending"?"چاوەڕوان":x==="approved"?"پەسەندکراو":x==="rejected"?"ڕەتکراوە":"هەموو"} ({rows.filter(r=>x==="all"||r.status===x).length})</button>)}</div>
 {loading?<div className="rounded-2xl bg-white p-8 text-center">بارکردن...</div>:visible.length===0?<div className="rounded-2xl bg-white p-10 text-center text-slate-500">هیچ داواکارییەک نییە.</div>:<div className="space-y-4">{visible.map(s=><article key={s.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-black">{s.name}</h2><p className="text-sm text-slate-500">{s.owner_email??s.owner_id}</p><p className="mt-1 text-xs text-slate-400">{labels[s.store_type]??s.store_type} · {new Date(s.created_at).toLocaleString("ckb-IQ")}</p></div><span className="flex h-fit items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs"><Clock3 size={14}/>{s.status}</span></div>
 <div className="mt-4 grid gap-3 sm:grid-cols-2"><p className="rounded-xl bg-slate-50 p-3 text-sm">Slug: <b dir="ltr">{s.slug}</b></p><p className="rounded-xl bg-slate-50 p-3 text-sm">مۆبایل: <b dir="ltr">{s.phone||"—"}</b></p></div>{s.description&&<p className="mt-3 text-sm leading-6 text-slate-600">{s.description}</p>}{s.address&&<p className="mt-2 text-sm text-slate-600">ناونیشان: {s.address}</p>}
 {s.status==="approved"&&<div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-orange-50 p-3"><label className="min-w-0 flex-1 text-sm font-semibold">کرێی گەیاندن (دیناری عێراقی)<input type="number" min="0" max="100000000" step="1" value={feeInputs[s.id]??String(s.delivery_fee_iqd??0)} onChange={e=>setFeeInputs(v=>({...v,[s.id]:e.target.value}))} className="mt-2 w-full rounded-lg border bg-white p-2 text-sm" /></label><button disabled={!!feeBusy||s.delivery_fee_iqd===null} onClick={()=>void saveDeliveryFee(s.id)} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{feeBusy===s.id?"چاوەڕێ...":"پاشەکەوتی کرێ"}</button><p className="w-full text-xs text-slate-600">{s.delivery_fee_iqd===null?"بۆ چالاککردنی ڕێکخستنی کرێ، سەرەتا مایگرەیشنی 0009 لە Supabase جێبەجێ بکە.":"ئەم نرخە لە داتابەیسەوە بۆ هەر داواکارییەک جێبەجێ دەکرێت."}</p></div>}{s.status==="approved"&&<div className="mt-3 rounded-xl border border-slate-200 bg-white p-3"><h3 className="text-sm font-black">ناوچەی فرۆشتن و مەودای گەیاندن</h3><p className="mt-1 text-xs text-slate-500">شوێنی ناوەندی دوکان دیاری بکە و مەودای گەیاندن بە کیلۆمەتر بنووسە. بێ زۆنی دیاریکراو، ئۆردەری نوێ وەرناگیرێت.</p><p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">ئاگاداری: دوگمەی GPS شوێنی ئێستای ئامێری بەڕێوەبەر وەردەگرێت؛ تەنها کاتێک بەکاری بهێنە کە لە شوێنی خودی دوکانیت. ئەگەر لە شوێنی دیکەیت، Latitude و Longitude ـی دوکان بە دەستی بنووسە.</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><label className="text-xs font-bold">Latitude<input type="number" min="-90" max="90" step="any" dir="ltr" value={zoneInputs[s.id]?.lat??""} onChange={e=>setZoneInputs(v=>({...v,[s.id]:{lat:e.target.value,lng:v[s.id]?.lng??"",radius:v[s.id]?.radius??""}}))} className="mt-1 w-full rounded-lg border p-2 text-sm"/></label><label className="text-xs font-bold">Longitude<input type="number" min="-180" max="180" step="any" dir="ltr" value={zoneInputs[s.id]?.lng??""} onChange={e=>setZoneInputs(v=>({...v,[s.id]:{lat:v[s.id]?.lat??"",lng:e.target.value,radius:v[s.id]?.radius??""}}))} className="mt-1 w-full rounded-lg border p-2 text-sm"/></label><label className="text-xs font-bold">مەودا (km)<input type="number" min="0.1" max="100" step="0.1" dir="ltr" value={zoneInputs[s.id]?.radius??""} onChange={e=>setZoneInputs(v=>({...v,[s.id]:{lat:v[s.id]?.lat??"",lng:v[s.id]?.lng??"",radius:e.target.value}}))} className="mt-1 w-full rounded-lg border p-2 text-sm"/></label></div><div className="mt-3 flex flex-wrap gap-2"><button disabled={!!zoneBusy} onClick={()=>captureZoneCenter(s.id)} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">{zoneBusy===s.id?"وەرگرتنی شوێن...":"وەرگرتنی شوێنی ئێستای دوکان"}</button><button disabled={!!zoneBusy} onClick={()=>void saveServiceZone(s.id)} className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{zoneBusy===s.id?"پاشەکەوت...":"پاشەکەوتی ناوچە"}</button><button disabled={!!zoneBusy||s.service_center_lat===null} onClick={()=>void clearServiceZone(s.id)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">لابردنی ناوچە</button></div><p className="mt-2 text-xs text-slate-500">{s.service_radius_km===null||s.service_center_lat===null?"زۆن هێشتا ڕێکنەخراوە.":"زۆنی چالاک: مەودای "+s.service_radius_km+" کیلۆمەتر"}</p></div>}{s.status==="pending"&&<div className="mt-4 border-t pt-4"><textarea rows={2} maxLength={1000} value={notes[s.id]??""} onChange={e=>setNotes(v=>({...v,[s.id]:e.target.value}))} className="w-full rounded-xl border p-3 text-sm" placeholder="تێبینی بۆ فرۆشیار (ئارەزوومەندانە)"/><div className="mt-3 flex gap-2"><button disabled={!!busy} onClick={()=>void review(s.id,"approved")} className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 size={16}/>{busy===s.id?"چاوەڕێ...":"پەسەندکردن"}</button><button disabled={!!busy} onClick={()=>void review(s.id,"rejected")} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><XCircle size={16}/>ڕەتکردنەوە</button></div></div>}</article>)}</div>}
 </div></main>;
}
