"use client";

import { FormEvent, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail, Store } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anonKey) throw new Error("پەیوەندی بە داتابەیس ئامادە نییە. تکایە پەیوەندی بە بەڕێوەبەرەوە بکە.");

      const supabase = createBrowserClient(url, anonKey);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;

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
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-orange-500 text-2xl font-black text-white"><Store size={27} /></div>
        <div className="mt-5 text-center">
          <p className="text-sm font-black tracking-wider text-orange-600">SHAKH STORE</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">چوونەژوورەوە</h1>
          <p className="mt-2 text-sm leading-7 text-slate-500">بۆ بەردەوامبوون، زانیاری هەژمارەکەت بنووسە.</p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-5">
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

        <a href="/" className="mt-6 block text-center text-sm font-bold text-slate-500 hover:text-orange-600">گەڕانەوە بۆ پەڕەی سەرەکی</a>
      </section>
    </main>
  );
}
