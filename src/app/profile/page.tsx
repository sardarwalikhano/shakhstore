"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { ArrowRight, LogOut, Save, ShieldCheck, UserCircle } from "lucide-react";

type Profile={id:string;email:string|null;fullName:string;phone:string;role:string};
const roleLabels:Record<string,string>={super_admin:"Super Admin",admin:"Admin",restaurant:"چێشتخانە",supermarket:"سوپەرمارکێت",produce_vendor:"فرۆشیاری بەرهەم",meat_seafood_vendor:"فرۆشیاری گۆشت و ماسی",captain:"کاپتن",customer:"کڕیار"};

export default function ProfilePage(){
 const router=useRouter(); const [profile,setProfile]=useState<Profile|null>(null);
 const [fullName,setFullName]=useState("");const [phone,setPhone]=useState("");
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const getClient=()=>{const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)throw new Error("پەیوەندی Supabase ئامادە نییە.");return createBrowserClient(url,key);};
 const load=useCallback(async()=>{setLoading(true);setError("");try{const {data,error}=await getClient().auth.getUser();if(error||!data.user){router.replace("/login");return;}const u=data.user;const p={id:u.id,email:u.email??null,fullName:String(u.user_metadata?.full_name??u.user_metadata?.name??""),phone:String(u.user_metadata?.phone??""),role:String(u.app_metadata?.role??"customer")};setProfile(p);setFullName(p.fullName);setPhone(p.phone);}catch(e){setError(e instanceof Error?e.message:"بارکردنی پرۆفایل سەرکەوتوو نەبوو.");}finally{setLoading(false);}},[router]);
 useEffect(()=>{void load();},[load]);
 async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();setSaving(true);setError("");setNotice("");try{const {data,error}=await getClient().auth.updateUser({data:{full_name:fullName.trim(),phone:phone.trim()}});if(error)throw error;if(data.user){setProfile(p=>p?{...p,fullName,phone}:p);}setNotice("زانیاری پرۆفایل پاشەکەوت کرا.");}catch(e){setError(e instanceof Error?e.message:"پاشەکەوتکردن سەرکەوتوو نەبوو.");}finally{setSaving(false);}}
 async function logout(){setSaving(true);try{await getClient().auth.signOut();router.replace("/login");router.refresh();}catch(e){setError(e instanceof Error?e.message:"چوونەدەرەوە سەرکەوتوو نەبوو.");}finally{setSaving(false);}}
 return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6" dir="rtl"><div className="mx-auto max-w-3xl">
 <a href="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowRight size={17}/> گەڕانەوە بۆ داشبۆرد</a>
 <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
 <div className="flex items-center gap-4"><span className="grid size-14 place-items-center rounded-2xl bg-orange-100 text-orange-600"><UserCircle size={30}/></span><div><p className="text-sm font-bold text-orange-600">SHAKH STORE</p><h1 className="text-2xl font-black text-slate-900">پرۆفایلی من</h1><p className="mt-1 text-sm text-slate-500">زانیاری کەسی و ڕێکخستنەکانی هەژمار</p></div></div>
 {loading?<p className="py-12 text-center text-slate-500">بارکردنی پرۆفایل...</p>:profile&&<form onSubmit={save} className="mt-8 space-y-5">
 <div><label className="mb-2 block text-sm font-bold" htmlFor="fullName">ناوی تەواو</label><input id="fullName" value={fullName} onChange={e=>setFullName(e.target.value)} maxLength={100} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-orange-400"/></div>
 <div><label className="mb-2 block text-sm font-bold" htmlFor="email">ئیمەیڵ</label><input id="email" value={profile.email??""} readOnly dir="ltr" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-500"/></div>
 <div><label className="mb-2 block text-sm font-bold" htmlFor="phone">ژمارەی مۆبایل</label><input id="phone" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} maxLength={30} dir="ltr" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left outline-none focus:border-orange-400"/></div>
 <div className="rounded-xl bg-slate-50 p-4"><div className="flex items-center gap-2 text-slate-500"><ShieldCheck size={18}/><span className="text-sm font-bold">ڕۆڵی هەژمار</span></div><p className="mt-2 font-black text-slate-900">{roleLabels[profile.role]??profile.role}</p><p className="mt-1 text-xs text-slate-500">ڕۆڵ تەنها لەلایەن بەڕێوەبەری متمانەپێکراوەوە دەگۆڕدرێت.</p></div>
 {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
 <div className="flex flex-wrap gap-3"><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-bold text-white disabled:opacity-50"><Save size={17}/> پاشەکەوتکردن</button><button type="button" disabled={saving} onClick={()=>void logout()} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-5 py-3 font-bold text-red-700 disabled:opacity-50"><LogOut size={17}/> چوونەدەرەوە</button></div>
 </form>}
 </section></div></main>;
}
