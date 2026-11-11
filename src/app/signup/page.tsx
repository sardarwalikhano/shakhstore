"use client";

import { FormEvent, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail, Phone, Store, UserRound } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess("");
    if(password.length<8){setError("وشەی نهێنی دەبێت لانیکەم ٨ پیت بێت.");return;}
    if(password!==confirm){setError("دوو وشەی نهێنییەکە یەکسان نین.");return;}
    setLoading(true);
    try {
      const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if(!url||!key) throw new Error("پەیوەندی Supabase ئامادە نییە.");
      const supabase=createBrowserClient(url,key);
      const emailRedirectTo="https://daim-post.online/auth/callback?next=/dashboard";
      const {data,error}=await supabase.auth.signUp({
        email:email.trim().toLowerCase(),
        password,
        options:{emailRedirectTo,data:{full_name:name.trim(),phone:phone.trim()}}
      });
      if(error) throw error;
      if(data.session){
        window.location.replace("/dashboard");
      } else {
        setSuccess("هەژمارەکەت دروست کرا. تکایە ئیمەیڵەکەت بپشکنە و لینکی پشتڕاستکردنەوە بکەرەوە.");
      }
    } catch(err) {
      const message=err instanceof Error?err.message:"دروستکردنی هەژمار سەرکەوتوو نەبوو.";
      setError(message.includes("User already registered")?"ئەم ئیمەیڵە پێشتر تۆمار کراوە. بچۆ بۆ چوونەژوورەوە.":message);
    } finally {setLoading(false);}
  }

  async function googleSignup(){
    setError("");setLoading(true);
    try{
      const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if(!url||!key)throw new Error("پەیوەندی Supabase ئامادە نییە.");
      const supabase=createBrowserClient(url,key);
      const redirectTo=new URL("/auth/callback?next=/dashboard",window.location.origin).toString();
      const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo,queryParams:{prompt:"select_account"}}});
      if(error)throw error;
    }catch(err){setError(err instanceof Error?err.message:"چوونەژوورەوە بە Google سەرکەوتوو نەبوو.");setLoading(false);}
  }

  return <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-8" dir="rtl">
    <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-orange-500 text-white"><Store size={27}/></div>
      <div className="mt-4 text-center"><p className="text-sm font-black tracking-wider text-orange-600">SHAKH STORE</p><h1 className="mt-2 text-2xl font-black text-slate-900">دروستکردنی هەژماری نوێ</h1><p className="mt-2 text-sm leading-7 text-slate-500">بۆ بەکارهێنانی خزمەتگوزارییەکانی شاخ ستۆر هەژمار دروست بکە.</p></div>

      <button type="button" onClick={()=>void googleSignup()} disabled={loading} className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
        <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 38.06 46.98 31.92 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>
        دروستکردن بە Google
      </button>

      <div className="my-6 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200"/><span className="text-xs text-slate-400">یان بە ئیمەیڵ</span><span className="h-px flex-1 bg-slate-200"/></div>

      <form onSubmit={submit} className="space-y-4">
        <div><label htmlFor="name" className="mb-2 block text-sm font-bold text-slate-700">ناوی تەواو</label><div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 focus-within:border-orange-400"><UserRound size={18} className="text-slate-400"/><input id="name" required maxLength={100} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="ناوی تەواوت" className="min-w-0 flex-1 py-3 outline-none"/></div></div>
        <div><label htmlFor="phone" className="mb-2 block text-sm font-bold text-slate-700">ژمارەی مۆبایل (ئارەزوومەندانە)</label><div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 focus-within:border-orange-400"><Phone size={18} className="text-slate-400"/><input id="phone" type="tel" maxLength={30} autoComplete="tel" dir="ltr" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+964..." className="min-w-0 flex-1 py-3 text-left outline-none"/></div></div>
        <div><label htmlFor="email" className="mb-2 block text-sm font-bold text-slate-700">ئیمەیڵ</label><div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 focus-within:border-orange-400"><Mail size={18} className="text-slate-400"/><input id="email" type="email" required autoComplete="email" dir="ltr" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" className="min-w-0 flex-1 py-3 text-left outline-none"/></div></div>
        <div><label htmlFor="password" className="mb-2 block text-sm font-bold text-slate-700">وشەی نهێنی</label><div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 focus-within:border-orange-400"><LockKeyhole size={18} className="text-slate-400"/><input id="password" type={showPassword?"text":"password"} required minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="min-w-0 flex-1 py-3 outline-none"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label="پیشاندان/شاردنەوەی وشەی نهێنی" className="text-slate-400">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>
        <div><label htmlFor="confirm" className="mb-2 block text-sm font-bold text-slate-700">دووبارەکردنەوەی وشەی نهێنی</label><input id="confirm" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-orange-400"/></div>
        {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
        {success&&<p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm leading-6 text-green-800">{success}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-xl bg-orange-500 px-4 py-3.5 font-black text-white hover:bg-orange-600 disabled:opacity-50">{loading?"چاوەڕێ بکە...":"دروستکردنی هەژمار"}</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">پێشتر هەژمارت هەیە؟ <a href="/login" className="font-black text-orange-600">بچۆ ژوورەوە</a></p>
      <p className="mt-3 text-center text-xs leading-6 text-slate-400">ڕۆڵی هەژمار لەلایەن سیستەم و بەڕێوەبەری متمانەپێکراوەوە دیاری دەکرێت؛ لە کاتی تۆمارکردن ناتوانرێت خۆت ببیتە Admin.</p>
    </section>
  </main>;
}
