import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { Bell, ShieldCheck, Store, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 p-6" dir="rtl"><p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">پەیوەندی Supabase لە سێرڤەر ڕێک نەخراوە.</p></main>;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isSuperAdmin = user.app_metadata?.role === "super_admin";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6" dir="rtl">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-orange-500 text-white"><Store /></span>
            <div><p className="text-sm font-bold text-orange-600">SHAKH STORE</p><h1 className="text-2xl font-black text-slate-900">داشبۆرد</h1></div>
          </div>
          <div className="text-sm text-slate-600">{user.email}</div>
        </header>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-black text-slate-900">بەخێربێیت</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">چوونەژوورەوە بە سەرکەوتوویی ئەنجام درا. لەم بەشەوە دەتوانیت بە پەڕە بەردەستەکان بگەیت.</p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <a href="/notifications" className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-orange-300 hover:shadow-md">
            <Bell className="text-orange-500" size={25} /><h3 className="mt-4 font-black text-slate-900">ئاگادارکردنەوەکان</h3><p className="mt-2 text-sm text-slate-500">بینین و خوێندنەوەی ئاگادارکردنەوەکان</p>
          </a>
          {isSuperAdmin && <a href="/dashboard/admin/cashouts" className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-orange-300 hover:shadow-md">
            <Wallet className="text-orange-500" size={25} /><h3 className="mt-4 font-black text-slate-900">بەڕێوەبردنی Cashout</h3><p className="mt-2 text-sm text-slate-500">پشکنینی داواکارییەکانی کشانەوەی پارە</p>
          </a>}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <ShieldCheck className="text-blue-600" size={25} /><h3 className="mt-4 font-black text-slate-900">ڕۆڵی هەژمار</h3><p className="mt-2 text-sm text-slate-500">{isSuperAdmin ? "Super Admin" : "بەکارهێنەر"}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
