"use client";

import { FormEvent, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowRight, Mail, Store } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email,setEmail]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setSuccess("");
    try {
      const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if(!url||!key) throw new Error("پەیوەندی Supabase ئامادە نییە.");
      const supabase=createBrowserClient(url,key);
      const redirectTo=new URL("/auth/callback?next=/reset-password",window.location.origin).toString();
      const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo});
      if(error) throw error;
      setSuccess("ئەگەر ئەم ئیمەیڵە لە هەژمارێکدا تۆمارکرابێت، لینکی گۆڕینی وشەی نهێنی بۆت دەنێردرێت.");
    } catch(e) { setError(e instanceof Error?e.message:"ناردنی داواکاری سەرکەوتوو نەبوو."); }
    finally { setLoading(false); }
  }

  return <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10" dir="rtl">
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-orange-500 text-white"><Store/></div>
      <h1 className="mt-5 text-center text-2xl font-black text-slate-900">گۆڕینی وشەی نهێنی</h1>
      <p className="mt-2 text-center text-sm leading-7 text-slate-500">ئیمەیڵی هەژمارەکەت بنووسە بۆ ناردنی لینکی گۆڕین.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block text-sm font-bold text-slate-700" htmlFor="email">ئیمەیڵ</label>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3"><Mail size={18} className="text-slate-400"/><input id="email" type="email" required autoComplete="email" dir="ltr" value={email} onChange={e=>setEmail(e.target.value)} className="min-w-0 flex-1 py-3 outline-none"/></div>
        {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success&&<p role="status" className="rounded-lg bg-green-50 p-3 text-sm leading-6 text-green-800">{success}</p>}
        <button disabled={loading} className="w-full rounded-xl bg-orange-500 py-3 font-bold text-white disabled:opacity-50">{loading?"چاوەڕێ بکە...":"ناردنی لینک"}</button>
      </form>
      <a href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-slate-500"><ArrowRight size={16}/> گەڕانەوە بۆ چوونەژوورەوە</a>
    </section>
  </main>;
}
