"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search, ShieldCheck, Users } from "lucide-react";

type UserRow = {
  id: string;
  email: string | null;
  name: string;
  role: string;
  created_at: string;
  email_confirmed: boolean;
};

const roles = [
  { value: "customer", label: "کڕیار" },
  { value: "captain", label: "کاپتن" },
  { value: "restaurant", label: "چێشتخانە" },
  { value: "supermarket", label: "سوپەرمارکێت" },
  { value: "produce_vendor", label: "فرۆشیاری بەرهەم" },
  { value: "meat_seafood_vendor", label: "فرۆشیاری گۆشت و ماسی" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

export default function AdminUsersPage() {
  const [users,setUsers]=useState<UserRow[]>([]);
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [busyId,setBusyId]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/admin/users?q="+encodeURIComponent(query),{cache:"no-store"});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error??"بارکردنی بەکارهێنەران سەرکەوتوو نەبوو.");
      setUsers(payload.users??[]);
    }catch(e){setError(e instanceof Error?e.message:"هەڵەیەک ڕوویدا.");}
    finally{setLoading(false);}
  },[query]);

  useEffect(()=>{void load();},[load]);

  async function changeRole(user:UserRow,role:string){
    if(user.role===role)return;
    if(!window.confirm("دڵنیایت لە گۆڕینی ڕۆڵی "+(user.email??user.id)+" بۆ "+role+"؟"))return;
    setBusyId(user.id);setError("");setNotice("");
    try{
      const response=await fetch("/api/admin/users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:user.id,role})});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error??"گۆڕینی ڕۆڵ سەرکەوتوو نەبوو.");
      setUsers(current=>current.map(item=>item.id===user.id?{...item,role:payload.user.role}:item));
      setNotice("ڕۆڵی بەکارهێنەر بە سەرکەوتوویی نوێکرایەوە. بۆ بەکارهێنانی دەستگەیشتنی نوێ، بەکارهێنەر دەبێت جارێکی تر بچێتە ژوورەوە.");
    }catch(e){setError(e instanceof Error?e.message:"هەڵەیەک ڕوویدا.");}
    finally{setBusyId(null);}
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6" dir="rtl">
    <div className="mx-auto max-w-6xl">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-bold text-orange-600">SHAKH STORE / SUPER ADMIN</p><h1 className="mt-2 text-3xl font-black text-slate-900">بەڕێوەبردنی بەکارهێنەران</h1><p className="mt-2 text-sm text-slate-500">گەڕان، پشکنینی هەژمار و دیاریکردنی ڕۆڵی بەکارهێنەران</p></div>
        <button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold"><RefreshCw size={17} className={loading?"animate-spin":""}/> نوێکردنەوە</button>
      </header>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 text-slate-500"><Users size={19}/><span className="text-sm font-bold">کۆی ئەنجامەکان</span></div>
        <p className="mt-2 text-3xl font-black text-slate-900">{users.length}</p>
        <div className="mt-4 flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3"><Search size={18} className="text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void load();}} placeholder="گەڕان بە ئیمەیڵ یان ناو..." className="min-w-0 flex-1 py-3 outline-none" /></div>
          <button onClick={()=>void load()} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">گەڕان</button>
        </div>
      </section>

      {error&&<p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {notice&&<p role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-800">{notice}</p>}

      <section className="space-y-3">
        {loading&&<div className="rounded-2xl bg-white p-8 text-center text-slate-500">بارکردنی بەکارهێنەران...</div>}
        {!loading&&users.length===0&&<div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">هیچ بەکارهێنەرێک نەدۆزرایەوە.</div>}
        {users.map(user=><article key={user.id} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0"><p className="font-black text-slate-900">{user.name||"بێ ناو"}</p><p className="mt-1 break-all text-sm text-slate-600" dir="ltr">{user.email??"No email"}</p><p className="mt-2 text-xs text-slate-400">{user.email_confirmed?"ئیمەیڵ پشتڕاستکراوەتەوە":"ئیمەیڵ پشتڕاست نەکراوەتەوە"} · {new Date(user.created_at).toLocaleDateString("ckb-IQ")}</p></div>
            <div className="flex min-w-[220px] flex-col gap-2">
              <label className="text-xs font-bold text-slate-500">ڕۆڵی بەکارهێنەر</label>
              <select value={user.role} disabled={busyId===user.id} onChange={e=>void changeRole(user,e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-orange-400">
                {roles.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </div>
          </div>
          {user.role==="super_admin"&&<div className="mt-3 flex items-center gap-2 text-xs font-bold text-orange-700"><ShieldCheck size={15}/> دەستگەیشتنی Super Admin</div>}
        </article>)}
      </section>
      <p className="mt-5 text-xs leading-6 text-slate-500">تەنها Super Admin دەتوانێت ڕۆڵ بگۆڕێت. گۆڕینی ڕۆڵ لە app_metadata ـی Supabase ئەنجام دەدرێت؛ بەکارهێنەر بۆ وەرگرتنی دەستگەیشتنی نوێ دەبێت جارێکی تر بچێتە ژوورەوە.</p>
    </div>
  </main>;
}
