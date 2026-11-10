"use client";

import { FormEvent, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { LockKeyhole, Store } from "lucide-react";

export default function ResetPasswordPage(){
 const router=useRouter(); const [password,setPassword]=useState(""); const [confirm,setConfirm]=useState("");
 const [loading,setLoading]=useState(false); const [error,setError]=useState(""); const [success,setSuccess]=useState("");
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");setSuccess("");
  if(password.length<8){setError("وشەی نهێنی دەبێت لانیکەم ٨ پیت بێت.");return;}
  if(password!==confirm){setError("دوو وشەی نهێنییەکە یەکسان نین.");return;}
  setLoading(true);
  try{const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
   if(!url||!key)throw new Error("پەیوەندی Supabase ئامادە نییە.");
   const supabase=createBrowserClient(url,key);const {error}=await supabase.auth.updateUser({password});
   if(error)throw error;setSuccess("وشەی نهێنی نوێ کرایەوە.");setTimeout(()=>router.replace("/dashboard"),900);
  }catch(e){setError(e instanceof Error?e.message:"گۆڕینی وشەی نهێنی سەرکەوتوو نەبوو.");}finally{setLoading(false);}
 }
 return <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10" dir="rtl"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
 <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-orange-500 text-white"><Store/></div><h1 className="mt-5 text-center text-2xl font-black">وشەی نهێنی نوێ</h1>
 <form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm font-bold" htmlFor="password">وشەی نهێنی نوێ</label><div className="flex items-center gap-3 rounded-xl border px-3"><LockKeyhole size={18}/><input id="password" type="password" minLength={8} required autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="flex-1 py-3 outline-none"/></div>
 <label className="block text-sm font-bold" htmlFor="confirm">دووبارەکردنەوەی وشەی نهێنی</label><input id="confirm" type="password" required autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="w-full rounded-xl border px-3 py-3 outline-none"/>
 {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success&&<p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{success}</p>}
 <button disabled={loading} className="w-full rounded-xl bg-orange-500 py-3 font-bold text-white disabled:opacity-50">{loading?"چاوەڕێ بکە...":"پاشەکەوتکردنی وشەی نهێنی"}</button></form></section></main>;
}
