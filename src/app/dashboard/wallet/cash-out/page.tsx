"use client";

import { useCallback, useEffect, useState } from "react";

type Cashout = {
  id: string; requested_amount_iqd: number; cash_amount_iqd: number; platform_fee_iqd: number;
  payout_method: "fastpay" | "fib" | null; payout_phone: string | null;
  status: "pending" | "approved" | "paid" | "rejected";
  user_note: string | null; admin_note: string | null; created_at: string; paid_at: string | null;
};
const money = (n: number) => new Intl.NumberFormat("en-US").format(n) + " IQD";
const statusLabel: Record<Cashout["status"], string> = {
  pending: "چاوەڕوانی پشکنین", approved: "پەسەندکراو — چاوەڕوانی ناردنی پارە",
  paid: "پارە نێردرا", rejected: "ڕەتکراوە",
};

export default function WalletCashoutPage() {
  const [method, setMethod] = useState<"fastpay" | "fib">("fastpay");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [requests, setRequests] = useState<Cashout[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/cashouts", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "بارکردنی مێژوو سەرکەوتوو نەبوو.");
      setRequests(data.requests ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "هەڵەیەک ڕوویدا."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setNotice("");
    setSending(true);
    try {
      const res = await fetch("/api/wallet/cashouts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_iqd: Number(amount), payout_method: method, payout_phone: phone, user_note: note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ناردنی داواکاری سەرکەوتوو نەبوو.");
      setNotice("داواکارییەکەت نێردرا. دوای پشکنین، Super Admin پارەکە بۆ ژمارەکەت دەنێرێت.");
      setAmount(""); setPhone(""); setNote("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "هەڵەیەک ڕوویدا."); }
    finally { setSending(false); }
  }

  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-sm font-bold text-orange-600">SHAKH STORE / WALLET</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">کاش ئاوتی جزدان</h1><p className="mt-3"><a href="/dashboard/wallet/top-up" className="font-bold text-orange-700 underline">پرکردنەوەی جزدان</a></p>
        <p className="mt-2 text-sm text-slate-600">ژمارەی FastPay یان FIB ـی خۆت بنووسە. Super Admin دوای پەسەندکردن پارەکە بە دەستی دەنێرێت.</p>
      </header>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <h2 className="text-xl font-black">دابەشکردنی بڕ</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">داواکار</p><p className="mt-1 text-xl font-black">٧٥٪</p></div>
          <div className="rounded-xl bg-orange-50 p-4"><p className="text-xs text-orange-700">SHAKH</p><p className="mt-1 text-xl font-black">٢٥٪</p></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">نموونەی ١٠٠,٠٠٠</p><p className="mt-1 text-xl font-black">٧٥,٠٠٠ IQD</p></div>
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div><label htmlFor="cashout-amount" className="mb-2 block text-sm font-bold">بڕی داواکراو لە جزدان (IQD)</label><input id="cashout-amount" type="number" min="4" step="1" required value={amount} onChange={e=>setAmount(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3" /></div>
          <div><label className="mb-2 block text-sm font-bold">شێوازی وەرگرتنی پارە</label><div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={()=>setMethod("fastpay")} className={`rounded-xl border p-3 font-bold ${method==="fastpay"?"border-orange-500 bg-orange-50":"border-slate-200"}`}>FastPay</button>
            <button type="button" onClick={()=>setMethod("fib")} className={`rounded-xl border p-3 font-bold ${method==="fib"?"border-orange-500 bg-orange-50":"border-slate-200"}`}>FIB</button>
          </div></div>
          <div><label htmlFor="cashout-phone" className="mb-2 block text-sm font-bold">ژمارەی ئەکاونتی خۆت</label><input id="cashout-phone" type="tel" required minLength={7} maxLength={24} value={phone} onChange={e=>setPhone(e.target.value)} dir="ltr" className="w-full rounded-xl border border-slate-300 p-3 text-left" placeholder="07xxxxxxxxx" /></div>
          <div><label htmlFor="cashout-note" className="mb-2 block text-sm font-bold">تێبینی (ئارەزوومەندانە)</label><textarea id="cashout-note" rows={2} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3" /></div>
          <p className="text-xs leading-6 text-slate-500">لە کاتی پەسەندکردندا ١٠٠٪ی بڕی داواکراو لە جزدان کەم دەکرێتەوە و ٧٥٪ بۆ پارەدان تەرخان دەکرێت. دۆخی «پارە نێردرا» تەنها دوای ناردنی ڕاستەقینە لەلایەن Super Admin ـەوە دەگۆڕدرێت.</p>
          <button disabled={sending} className="w-full rounded-xl bg-orange-600 px-5 py-3 font-bold text-white disabled:opacity-50">{sending?"ناردن...":"ناردنی داواکاری کاش ئاوت"}</button>
        </form>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <h2 className="text-xl font-black">مێژووی کاش ئاوت</h2>
        {loading ? <p className="py-6 text-sm text-slate-500">بارکردن...</p> : requests.length===0 ? <p className="py-6 text-sm text-slate-500">هیچ داواکارییەک نییە.</p> :
          <div className="mt-4 space-y-3">{requests.map(item=><article key={item.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>{money(item.requested_amount_iqd)}</strong><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{statusLabel[item.status]}</span></div>
            <p className="mt-2 text-sm text-slate-600">{money(item.cash_amount_iqd)} · {item.payout_method?.toUpperCase()} · <span dir="ltr">{item.payout_phone}</span></p>
            {item.admin_note && <p className="mt-2 text-sm text-slate-600">تێبینی: {item.admin_note}</p>}
            <p className="mt-2 text-xs text-slate-400">{new Date(item.created_at).toLocaleString("ckb-IQ")}</p>
          </article>)}</div>}
      </section>
    </div>
  </main>;
}
