"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, XCircle, Clock3, Wallet } from "lucide-react";

type Cashout = {
  id: string;
  user_id: string;
  user_email: string | null;
  requested_amount_iqd: number;
  cash_amount_iqd: number;
  platform_fee_iqd: number;
  status: "pending" | "approved" | "paid" | "rejected";
  payout_method: "fastpay" | "fib" | null;
  payout_phone: string | null;
  paid_at: string | null;
  user_note: string | null;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-US").format(amount) + " IQD";

export default function AdminCashoutsPage() {
  const [requests, setRequests] = useState<Cashout[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | Cashout["status"]>("pending");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/cashouts", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "بارکردنی داواکارییەکان سەرکەوتوو نەبوو");
      setRequests(payload.requests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "هەڵەیەک ڕوویدا");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  async function review(requestId: string, decision: "approve" | "reject" | "mark_paid") {
    const prompt = decision === "approve" ? "دڵنیایت لە پەسەندکردنی ئەم داواکارییە؟" : decision === "reject" ? "دڵنیایت لە ڕەتکردنەوەی ئەم داواکارییە؟" : "دڵنیایت پارەکەت ناردووە و دەتەوێت دۆخی تەواوبوون تۆمار بکەیت؟";
    if (!window.confirm(prompt)) return;

    setBusyId(requestId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/cashouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          decision: decision === "mark_paid" ? undefined : decision,
          action: decision === "mark_paid" ? "mark_paid" : undefined,
          note: notes[requestId] ?? "",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "کردارەکە سەرکەوتوو نەبوو");
      setNotice(decision === "approve" ? "داواکارییەکە پەسەند کرا؛ پارەکە هێشتا دەبێت بنێردرێت." : decision === "reject" ? "داواکارییەکە ڕەتکرایەوە." : "ناردنی پارە تۆمار کرا.");
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "هەڵەیەک ڕوویدا");
    } finally {
      setBusyId(null);
    }
  }

  const visible = requests.filter((item) => filter === "all" || item.status === filter);
  const pendingTotal = requests.filter((item) => item.status === "pending").length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-orange-600">SHAKH STORE / SUPER ADMIN</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">بەڕێوەبردنی کشانەوەی پارە</h1>
            <p className="mt-2 text-sm text-slate-500">پشکنین، پەسەندکردن و ڕەتکردنەوەی داواکارییەکانی خەڵات</p>
          </div>
          <button onClick={() => void loadRequests()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} /> نوێکردنەوە
          </button>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-slate-500"><span>هەموو داواکارییەکان</span><Wallet size={20} /></div>
            <p className="mt-3 text-3xl font-black text-slate-900">{requests.length}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center justify-between text-amber-800"><span>چاوەڕوانی پشکنین</span><Clock3 size={20} /></div>
            <p className="mt-3 text-3xl font-black text-amber-900">{pendingTotal}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center justify-between text-emerald-800"><span>پەسەندکراو</span><CheckCircle2 size={20} /></div>
            <p className="mt-3 text-3xl font-black text-emerald-900">{requests.filter((item) => (item.status === "approved" || item.status === "paid")).length}</p>
          </div>
        </section>

        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

        <div className="mb-4 flex flex-wrap gap-2">
          {(["pending", "approved", "paid", "rejected", "all"] as const).map((value) => (
            <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-sm font-bold ${filter === value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
              {value === "pending" ? "چاوەڕوان" : value === "approved" ? "پەسەندکراو" : value === "paid" ? "پارەدراو" : value === "rejected" ? "ڕەتکراوە" : "هەموو"}
            </button>
          ))}
        </div>

        <section className="space-y-4">
          {loading && <div className="rounded-2xl bg-white p-8 text-center text-slate-500">بارکردنی داواکارییەکان...</div>}
          {!loading && visible.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">هیچ داواکارییەک لەم بەشەدا نییە.</div>}
          {visible.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">{item.user_email ?? item.user_id}</p>
                  <p className="mt-1 text-xs text-slate-500" dir="ltr">{item.id}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString("ckb-IQ")}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === "pending" ? "bg-amber-100 text-amber-800" : item.status === "approved" || item.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                  {item.status === "pending" ? "چاوەڕوان" : item.status === "approved" ? "پەسەندکراو — پارە نە نێردراوە" : item.status === "paid" ? "پارە نێردرا" : "ڕەتکراوە"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">کۆی داواکاری</p><p className="mt-1 text-lg font-black text-slate-900">{money(item.requested_amount_iqd)}</p></div>
                <div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs text-emerald-700">٧٥٪ پارەدانی بەکارهێنەر</p><p className="mt-1 text-lg font-black text-emerald-900">{money(item.cash_amount_iqd)}</p></div>
                <div className="rounded-xl bg-orange-50 p-4"><p className="text-xs text-orange-700">٢٥٪ بۆ شاخ</p><p className="mt-1 text-lg font-black text-orange-900">{money(item.platform_fee_iqd)}</p></div>
              </div>

              {item.payout_method && <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4"><p className="text-sm font-bold text-orange-900">شوێنی ناردنی پارە</p><p className="mt-1 text-sm text-orange-900">{item.payout_method.toUpperCase()} · <span dir="ltr">{item.payout_phone}</span></p><p className="mt-1 text-xs text-orange-800">بڕی پێویست بۆ ناردن: {money(item.cash_amount_iqd)}</p></div>}
              {item.user_note && <p className="mt-4 text-sm text-slate-600">تێبینی بەکارهێنەر: {item.user_note}</p>}
              {item.paid_at && <p className="mt-2 text-sm text-emerald-700">پارە نێردرا: {new Date(item.paid_at).toLocaleString("ckb-IQ")}</p>}
              {item.admin_note && <p className="mt-2 text-sm text-slate-600">تێبینی بەڕێوەبەر: {item.admin_note}</p>}

              {(item.status === "pending" || item.status === "approved") && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor={`note-${item.id}`}>تێبینی Super Admin (ئارەزوومەندانە)</label>
                  <textarea id={`note-${item.id}`} value={notes[item.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} rows={2} maxLength={1000} className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-orange-400" placeholder="تێبینی بنووسە..." />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.status === "pending" && <button onClick={() => void review(item.id, "approve")} disabled={busyId !== null} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 size={17} />{busyId === item.id ? "تکایە چاوەڕێ بکە..." : "پەسەندکردن"}</button>}
                    {item.status === "pending" && <button onClick={() => void review(item.id, "reject")} disabled={busyId !== null} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><XCircle size={17} />ڕەتکردنەوە</button>}
                    {item.status === "approved" && <button onClick={() => void review(item.id, "mark_paid")} disabled={busyId !== null} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">پارە نێردرا / تەواوبوو</button>}
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
