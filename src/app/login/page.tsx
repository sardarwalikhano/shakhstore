"use client";

import { FormEvent, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LockKeyhole, Mail, Store } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) throw new Error("پەیوەندی Supabase ئامادە نییە.");
    return createBrowserClient(url, anonKey);
  }

  async function googleLogin() {
    setError("");
    setLoading(true);
    try {
      const supabase = getSupabase();
      const redirectTo = new URL("/auth/callback?next=/dashboard", window.location.origin).toString();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, queryParams: { prompt: "select_account" } },
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "چوونەژوورەوە بە Google سەرکەوتوو نەبوو.");
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message.includes("Invalid login credentials")
        ? "ئیمەیڵ یان وشەی نهێنی هەڵەیە."
        : message || "چوونەژوورەوە سەرکەوتوو نەبوو.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10" dir="rtl">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-orange-500 text-white"><Store size={27} /></div>
        <div className="mt-5 text-center">
          <p className="text-sm font-black tracking-wider text-orange-600">SHAKH STORE</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">چوونەژوورەوە</h1>
          <p className="mt-2 text-sm leading-7 text-slate-500">بۆ بەردەوامبوون، زانیاری هەژمارەکەت بنووسە.</p>
        </div>

        <button type="button" onClick={() => void googleLogin()} disabled={loading} className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 38.06 46.98 31.92 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>
          چوونەژوورەوە بە Google
        </button>
        <div className="my-6 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200"/><span className="text-xs text-slate-400">یان بە ئیمەیڵ</span><span className="h-px flex-1 bg-slate-200"/></div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-bold text-slate-700">ئیمەیڵ</label>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 focus-within:border-orange-400">
              <Mail size={18} className="text-slate-400" />
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" dir="ltr" className="min-w-0 flex-1 bg-transparent py-3.5 text-left outline-none" />
            </div>
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-bold text-slate-700">وشەی نهێنی</label>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 focus-within:border-orange-400">
              <LockKeyhole size={18} className="text-slate-400" />
              <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="وشەی نهێنی" className="min-w-0 flex-1 bg-transparent py-3.5 outline-none" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "شاردنەوەی وشەی نهێنی" : "پیشاندانی وشەی نهێنی"} className="p-1 text-slate-400">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-orange-500 px-4 py-3.5 font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? "چوونەژوورەوە..." : "چوونەژوورەوە"}
          </button>
        </form>
        <a href="/forgot-password" className="mt-4 block text-center text-sm font-bold text-orange-600 hover:text-orange-700">وشەی نهێنیت لەبیرکردووە؟</a>
        <p className="mt-4 text-center text-sm text-slate-600">هەژمارت نییە؟ <a href="/signup" className="font-black text-orange-600">هەژمار دروست بکە</a></p>
        <Link href="/" className="mt-5 block text-center text-sm font-bold text-slate-500 hover:text-orange-600">گەڕانەوە بۆ پەڕەی سەرەکی</Link>
      </section>
    </main>
  );
}
