import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { Bell, Bike, ClipboardList, Package, ShieldCheck, ShoppingBag, Store, UserCircle, Wallet, Utensils } from "lucide-react";
import { DashboardMobileNav } from "@/components/dashboard-mobile-nav";

export const dynamic = "force-dynamic";

const roleLabels: Record<string,string> = {
  super_admin:"Super Admin", admin:"Admin", restaurant:"چێشتخانە",
  supermarket:"سوپەرمارکێت", produce_vendor:"فرۆشیاری بەرهەم",
  meat_seafood_vendor:"فرۆشیاری گۆشت و ماسی", captain:"کاپتن", customer:"کڕیار"
};

export default async function DashboardPage() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!anonKey) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6" dir="rtl"><p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">پەیوەندی Supabase لە سێرڤەر ڕێک نەخراوە.</p></main>;
  const cookieStore=await cookies();
  const supabase=createServerClient(url,anonKey,{cookies:{
    getAll:()=>cookieStore.getAll(),
    setAll:(values)=>{try{values.forEach(({name,value,options})=>cookieStore.set(name,value,options));}catch{}}
  }});
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");

  const role=String(user.app_metadata?.role??"customer");
  const displayName=String(user.user_metadata?.full_name??user.user_metadata?.name??user.email??"بەکارهێنەر");
  const {data:wallet}=await supabase.from("wallet_accounts").select("balance_minor").eq("owner_type","user").eq("owner_id",user.id).eq("currency","IQD").maybeSingle();
  const balance=Number(wallet?.balance_minor??0);

  const admin=role==="super_admin"||role==="admin";
  const merchant=["restaurant","supermarket","produce_vendor","meat_seafood_vendor"].includes(role);
  const cards=[
    {title:"پرۆفایل",description:"نوێکردنەوەی ناو، ژمارەی مۆبایل و زانیاری هەژمار",href:"/profile",icon:UserCircle},
    {title:"ئاگادارکردنەوەکان",description:"بینین و خوێندنەوەی ئاگادارکردنەوەکان",href:"/notifications",icon:Bell},
    {title:"داواکارییەکان",description:"بینینی مێژوو و دۆخی داواکارییەکان",href:"/dashboard/orders",icon:ShoppingBag},
    {title:"پرکردنەوەی جزدان",description:"ناردنی پارە بە FastPay یان FIB و بارکردنی وەسڵ",href:"/dashboard/wallet/top-up",icon:Wallet},
    ...(role==="customer"?[{title:"بازاڕ و کڕین",description:"گەڕان لە بەرهەمە بەردەستەکانی دوکانە پەسەندکراوەکان و زیادکردن بۆ سەبەتە",href:"/market",icon:Store}]:[]),
    ...(admin?[{title:"پشکنینی دوکانەکان",description:"پەسەندکردن و بەڕێوەبردنی داواکارییەکانی فرۆشیاران",href:"/dashboard/admin/stores",icon:Store},{title:"بەڕێوەبردنی گەیاندن",description:"دیاریکردنی کاپتن بۆ داواکارییە ئامادەکان و چاودێری گەیاندن",href:"/dashboard/admin/deliveries",icon:Bike},{title:"بەرهەمەکان",description:"بەڕێوەبردنی کاتەلۆگی بەرهەمەکانی SHAKH STORE",href:"/dashboard/products",icon:Package}]:[]),
    ...(role==="captain"?[{title:"گەیاندنەکانم",description:"بینینی داواکارییە دیاریکراوەکان و نوێکردنەوەی دۆخی گەیاندن",href:"/dashboard/captain/deliveries",icon:Bike}]:[]),
    ...(role==="super_admin"?[{title:"بازاڕی تایبەتی شاخ ستۆر",description:"زیادکردن و بەڕێوەبردنی بەرهەمەکانی شاخ ستۆر بە ناوی خۆی",href:"/dashboard/admin/shakh-market",icon:Store},{title:"بەڕێوەبردنی Cashout",description:"پشکنین و بڕیاردان لەسەر داواکارییەکانی کشانەوە",href:"/dashboard/admin/cashouts",icon:Wallet},{title:"پشکنینی پرکردنەوەی جزدان",description:"پشکنینی وەسڵ و پەسەندکردنی زیادکردنی باڵانس",href:"/dashboard/admin/wallet-topups",icon:Wallet},{title:"بەکارهێنەران و ڕۆڵەکان",description:"گەڕان، پشکنین و دیاریکردنی ڕۆڵی هەژمارەکان",href:"/dashboard/admin/users",icon:ShieldCheck}]:[]),
    ...(merchant?[{title:"داواکارییەکانی دوکان",description:"بینین، پەسەندکردن و ئامادەکردنی داواکارییەکانی کڕیاران",href:"/dashboard/merchant/orders",icon:ShoppingBag},{title:"دوکانەکەم",description:"دروستکردن و بەڕێوەبردنی زانیاری دوکان و داواکاری پەسەندکردن",href:"/dashboard/store",icon:Store},{title:"بەرهەمەکانم",description:"زیادکردنی بەرهەم، نرخ، وێنە و کۆگا",href:"/dashboard/products",icon:Package}]:[]),
  ];
  const modules=admin
    ? ["بەڕێوەبردنی بەکارهێنەران و ڕۆڵەکان","چاودێری فرۆشیاران و دوکانەکان","داواکاری و گەیاندن","ڕاپۆرت و ڕێکخستنی کۆمیشن"]
    : merchant
    ? ["بەڕێوەبردنی دوکان و زانیاری فرۆشیار","بەرهەم، نرخ و وێنەکان","داواکارییە هاتووەکان","فرۆشتن و هەژماری کۆمیشن"]
    : role==="captain"
    ? ["داواکارییەکانی گەیاندن","داهاتی ڕۆژانە و کۆمیشن","مێژووی گەیاندن","هەژماری کاپتن"]
    : ["گەڕان لە بەشەکانی بازاڕ","داواکاری و مێژووی کڕین","خەڵاتی بانگهێشت و لینکەکان","جزدان و داواکاری Cashout"];

  return <main className="min-h-screen bg-slate-50 px-4 py-6 pb-24 sm:px-6 sm:pb-24 lg:px-8 lg:pb-8" dir="rtl">
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-orange-500 text-white"><Store/></span><div><p className="text-sm font-black text-orange-600">SHAKH STORE</p><h1 className="text-2xl font-black text-slate-900">داشبۆرد</h1></div></div>
        <nav className="flex flex-wrap items-center gap-2">
          <a href="/profile" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"><UserCircle size={17}/> پرۆفایل</a>
          <a href="/notifications" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"><Bell size={17}/> ئاگادارکردنەوە</a>
        </nav>
      </header>

      <section className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
        <div className="rounded-2xl bg-[#17243a] p-6 text-white sm:p-8">
          <p className="text-sm font-bold text-orange-300">بەخێربێیت بۆ SHAKH STORE</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">{displayName}</h2>
          <p className="mt-3 text-sm text-slate-300">{user.email}</p>
          <span className="mt-5 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-bold">{roleLabels[role]??role}</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between"><span className="text-sm font-bold text-slate-500">باڵانسی جزدان</span><Wallet className="text-orange-500"/></div>
          <p className="mt-4 text-3xl font-black text-slate-900">{new Intl.NumberFormat("en-US").format(balance)} <span className="text-base">IQD</span></p>
          <p className="mt-2 text-xs leading-6 text-slate-500">باڵانس لە داتابەیسەوە دەخوێندرێتەوە؛ لەم پەڕەیەوە ناگۆڕدرێت.</p>
        </div>
      </section>

      <section className="mb-7">
        <h2 className="mb-4 text-lg font-black text-slate-900">دەستگەیشتنی خێرا</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({title,description,href,icon:Icon})=><a key={href} href={href} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"><Icon className="text-orange-500" size={25}/><h3 className="mt-3 font-black text-slate-900">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></a>)}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2"><ClipboardList className="text-orange-500"/><h2 className="text-lg font-black text-slate-900">بەشەکانی ڕۆڵی {roleLabels[role]??role}</h2></div>
        <p className="mt-2 text-sm text-slate-500">ئەمە ڕێکخستنی بەشەکانی کارە. بەشەکانی خوارەوە هێشتا پێویستیان بە API و پەیوەندی داتابەیس هەیە؛ تا ئەو کاتە وەک بەشی چالاک پیشان نادرێن.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {modules.map((label,index)=><div key={label} className="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-orange-500">{index===0?<ShoppingBag size={18}/>:index===1?<Package size={18}/>:index===2?<Bike size={18}/>:<Utensils size={18}/>}</span><div><p className="text-sm font-bold text-slate-800">{label}</p><p className="mt-1 text-xs text-slate-500">لە پلانی قۆناغی داهاتوودا</p></div></div>)}
        </div>
        {admin&&<div className="mt-5 flex items-center gap-2 rounded-xl bg-blue-50 p-4 text-sm text-blue-900"><ShieldCheck size={18}/> دەستگەیشتنی بەڕێوەبەر بەپێی app_metadata.role دیاری دەکرێت.</div>}
      </section>
    </div>
    <DashboardMobileNav role={role} />
  </main>;
}
