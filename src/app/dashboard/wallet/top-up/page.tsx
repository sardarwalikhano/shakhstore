"use client";

import { useCallback, useEffect, useState } from "react";

type Topup = {
  id: string; payment_method: "fastpay" | "fib"; amount_iqd: number;
  sender_reference: string | null; user_note: string | null;
  status: "pending" | "approved" | "rejected"; admin_note: string | null;
  created_at: string; reviewed_at: string | null;
};
const money = (n: number) => new Intl.NumberFormat("en-US").format(n) + " IQD";

export default function WalletTopupPage() {
  const [method, setMethod] = useState<"fastpay" | "fib">("fastpay");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [requests, setRequests] = useState<Topup[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/topups", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "بارکردنی مێژوو سەرکەوتوو نەبوو");
      setRequests(data.requests ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "هەڵەیەک ڕوویدا"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setNotice("");
    if (!receipt) { setError("تکایە وەسڵی پارەدان بار بکە."); return; }
    const n = Number(amount);
    if (!Number.isSafeInteger(n) || n <= 0) { setError("بڕی پارە دروست نییە."); return; }
    setSending(true);
    try {
      const form = new FormData();
      form.set("payment_method", method); form.set("amount_iqd", String(n));
      form.set("sender_reference", reference); form.set("user_note", note); form.set("receipt", receipt);
      const res = await fetch("/api/wallet/topups", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ناردنی داواکاری سەرکەوتوو نەبوو");
      setNotice("داواکارییەکەت نێردرا؛ دوای پشکنینی Super Admin باڵانس زیاد دەکرێت.");
      setAmount(""); setReference(""); setNote(""); setReceipt(null);
      const input = document.getElementById("topup-receipt") as HTMLInputElement | null;
      if (input) input.value = "";
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "هەڵەیەک ڕوویدا"); }
    finally { setSending(false); }
  }

  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
    <div className="mx-auto max-w-4xl space-y-6">
      <header><p className="text-sm font-bold text-orange-600">SHAKH STORE / WALLET</p><h1 className="mt-2 text-3xl font-black text-slate-900">پرکردنەوەی جزدان</h1><p className="mt-2 text-sm text-slate-600">پارەکە بنێرە بۆ ژمارەی سوپەر ئەدمین و وەسڵەکە بار بکە. باڵانس تەنها دوای پشکنین زیاد دەکرێت.</p></header>
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="font-bold">FastPay</p><p dir="ltr" className="mt-2 text-2xl font-black">07736999576</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="font-bold">FIB</p><p dir="ltr" className="mt-2 text-2xl font-black">07504796924</p></div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <h2 className="text-xl font-black">داواکاریی نوێ</h2>
        <p className="mt-1 text-sm text-slate-500">١ IQD پارەی پەسەندکراو = ١ IQD باڵانس</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div><label className="mb-2 block text-sm font-bold">شێوازی ناردنی پارە</label><div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMethod("fastpay")} className={`rounded-xl border p-3 font-bold ${method === "fastpay" ? "border-orange-500 bg-orange-50 text-orange-800" : "border-slate-200"}`}>FastPay</button>
            <button type="button" onClick={() => setMethod("fib")} className={`rounded-xl border p-3 font-bold ${method === "fib" ? "border-orange-500 bg-orange-50 text-orange-800" : "border-slate-200"}`}>FIB</button>
          </div></div>
          <div><label htmlFor="topup-amount" className="mb-2 block text-sm font-bold">بڕی نێردراو (IQD)</label><input id="topup-amount" type="number" min="1" max="100000000" step="1" required value={amount} onChange={e=>setAmount(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3" placeholder="10000" /></div>
          <div><label htmlFor="topup-reference" className="mb-2 block text-sm font-bold">ژمارەی مامەڵە / Reference (ئارەزوومەندانە)</label><input id="topup-reference" value={reference} onChange={e=>setReference(e.target.value)} maxLength={120} className="w-full rounded-xl border border-slate-300 p-3" /></div>
          <div><label htmlFor="topup-receipt" className="mb-2 block text-sm font-bold">وەسڵی پارەدان (پێویستە)</label><input id="topup-receipt" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setReceipt(e.target.files?.[0] ?? null)} className="w-full rounded-xl border border-slate-300 p-3 text-sm" /><p className="mt-1 text-xs text-slate-500">JPG، PNG، WEBP یان PDF — تا ٥MB</p></div>
          <div><label htmlFor="topup-note" className="mb-2 block text-sm font-bold">تێبینی</label><textarea id="topup-note" value={note} onChange={e=>setNote(e.target.value)} maxLength={1000} rows={2} className="w-full rounded-xl border border-slate-300 p-3" /></div>
          <button disabled={sending} className="w-full rounded-xl bg-orange-600 px-5 py-3 font-bold text-white disabled:opacity-50">{sending ? "ناردن..." : "ناردنی داواکاری پرکردنەوە"}</button>
        </form>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><h2 className="text-xl font-black">مێژووی داواکارییەکان</h2>
        {loading ? <p className="py-6 text-sm text-slate-500">بارکردن...</p> : requests.length === 0 ? <p className="py-6 text-sm text-slate-500">هێشتا داواکارییەکت نییە.</p> :
          <div className="mt-4 space-y-3">{requests.map(item=><article key={item.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>{money(item.amount_iqd)}</strong><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status==="pending"?"bg-amber-100 text-amber-800":item.status==="approved"?"bg-emerald-100 text-emerald-800":"bg-red-100 text-red-800"}`}>{item.status==="pending"?"چاوەڕوان":item.status==="approved"?"پەسەندکراو":"ڕەتکراوە"}</span></div>
            <p className="mt-2 text-sm text-slate-600">{item.payment_method==="fastpay"?"FastPay":"FIB"} · {new Date(item.created_at).toLocaleString("ckb-IQ")}</p>
            {item.admin_note && <p className="mt-2 text-sm text-slate-600">تێبینی: {item.admin_note}</p>}
          </article>)}</div>}
      </section>
    </div>
  </main>;
}
