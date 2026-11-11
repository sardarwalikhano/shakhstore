import { cookies } from "next/headers";
import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { ArrowLeft, Bike, ShoppingBasket, Store, Utensils, Beef, ShieldCheck, UserCircle } from "lucide-react";

const departments = [
  { title: "چێشتخانە", description: "داواکاری خواردن لە چێشتخانەکان", icon: Utensils },
  { title: "سوپەرمارکێت", description: "کڕینی کاڵا و پێداویستییەکان", icon: ShoppingBasket },
  { title: "بەقالی", description: "سەوزە، میوە و پێداویستی ڕۆژانە", icon: Store },
  { title: "گۆشت", description: "گۆشت و بەرهەمە پەیوەندیدارەکان", icon: Beef },
];

export default async function HomePage() {
  let signedIn = false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anonKey) {
    const jar = await cookies();
    const supabase = createServerClient(url, anonKey, { cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => { try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch {} },
    }});
    const { data: { user } } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  }
  return (
    <main className="min-h-screen pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="container-shell flex h-20 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3" aria-label="SHAKH STORE">
            <span className="grid size-11 place-items-center rounded-2xl bg-[#f28c28] text-xl font-black text-white">ش</span>
            <span>
              <span className="block text-lg font-black tracking-wide text-[#17243a]">SHAKH STORE</span>
              <span className="block text-xs text-slate-500">شاخ ستۆر</span>
            </span>
          </Link>
          {signedIn ? (
            <a href="/profile" className="inline-flex items-center gap-2 rounded-xl bg-[#2457a6] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1c478b">
              <UserCircle size={17} /> پرۆفایل
            </a>
          ) : (
            <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-[#2457a6] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1c478b]">
              چوونەژوورەوە <ArrowLeft size={16} />
            </Link>
          )}
        </div>
      </header>

      <section className="container-shell grid gap-8 py-12 md:grid-cols-[1.2fr_.8fr] md:items-center md:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-4 py-2 text-sm font-bold text-[#bd6412]">
            <ShieldCheck size={16} /> پلاتفۆرمی فرۆشتن و گەیاندن
          </span>
          <h1 className="mt-6 max-w-2xl text-4xl font-black leading-[1.45] text-[#17243a] md:text-6xl">
            هەموو پێداویستییەکانت، <span className="text-[#f28c28]">لە یەک شوێن</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-slate-600 md:text-lg">
            لە چێشتخانە، سوپەرمارکێت، بەقالی و فرۆشیاری گۆشت داواکاری بکە؛ شاخ ستۆر ڕێگای کڕین و گەیاندن ئاسان دەکات.
          </p>
          <a href="#departments" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#f28c28] px-6 py-3.5 font-bold text-white shadow-lg shadow-orange-200/60 transition hover:bg-[#df7918]">
            بینینی بەشەکان <ArrowLeft size={18} />
          </a>
        </div>
        <div className="surface relative overflow-hidden bg-gradient-to-br from-orange-50 via-white to-blue-50 p-7 md:p-10">
          <div className="absolute -left-12 -top-12 size-44 rounded-full bg-orange-200/40 blur-2xl" />
          <div className="relative grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <Utensils className="text-[#f28c28]" size={30} />
              <p className="mt-4 font-bold text-slate-800">خواردنی ئامادە</p>
            </div>
            <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
              <ShoppingBasket className="text-[#2457a6]" size={30} />
              <p className="mt-4 font-bold text-slate-800">کڕینی ڕۆژانە</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <Store className="text-[#2457a6]" size={30} />
              <p className="mt-4 font-bold text-slate-800">بازاڕی ناوخۆ</p>
            </div>
            <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
              <Bike className="text-[#f28c28]" size={30} />
              <p className="mt-4 font-bold text-slate-800">گەیاندن</p>
            </div>
          </div>
        </div>
      </section>

      <section id="departments" className="container-shell py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-black text-[#17243a]">بەشەکانی شاخ ستۆر</h2>
          <p className="mt-2 text-sm text-slate-500">بەشەکان بۆ کڕین ئامادە دەبن دوای چالاککردنی فرۆشیاران.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {departments.map(({ title, description, icon: Icon }) => (
            <article key={title} className="surface p-6 transition hover:-translate-y-1 hover:shadow-lg">
              <span className="grid size-12 place-items-center rounded-2xl bg-orange-50 text-[#f28c28]"><Icon size={25} /></span>
              <h3 className="mt-5 text-lg font-extrabold text-[#17243a]">{title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
              <p className="mt-5 text-xs font-bold text-[#2457a6]">بەشی پلاتفۆرم</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="mt-16 border-t border-slate-200 bg-white">
        <div className="container-shell flex flex-col gap-2 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} SHAKH STORE</span>
          <span>daim-post.online</span>
        </div>
      </footer>
    </main>
  );
}
