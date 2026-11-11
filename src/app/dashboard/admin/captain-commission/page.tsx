"use client";

import { useCallback, useEffect, useState } from "react";
import { Save, Percent } from "lucide-react";

type Settings = { commission_rate_bps: number; updated_at: string; updated_by: string | null };

export default function CaptainCommissionSettingsPage() {
  const [rate, setRate] = useState("20");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/captain-commission", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "بارکردنی ڕێژە سەرکەوتوو نەبوو.");
      setSettings(data.settings);
      setRate(String(Number(data.settings.commission_rate_bps) / 100));
    } catch (e) {
      setError(e instanceof Error ? e.message : "هەڵەیەک ڕوویدا.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    const numericRate = Number(rate);
    if (!Number.isFinite(numericRate) || numericRate < 0 || numericRate > 100) {
      setError("ڕێژە دەبێت لە ٠ تا ١٠٠٪ بێت.");
      return;
    }
    const basisPoints = Math.round(numericRate * 100);
    if (Math.abs(numericRate * 100 - basisPoints) > 0.000001) {
      setError("ڕێژە تەنها تا دوو ژمارەی دوای خاڵ ڕێگەپێدراوە.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/captain-commission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commission_rate_bps: basisPoints }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "پاشەکەوتکردن سەرکەوتوو نەبوو.");
      setSettings(data.settings);
      setNotice("ڕێژەی پاداشتی کاپتن پاشەکەوت کرا.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "هەڵەیەک ڕوویدا.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-black text-orange-600">SHAKH STORE / ADMIN</p>
            <h1 className="mt-2 text-3xl font-black">ڕێکخستنی پاداشتی کاپتن</h1>
            <p className="mt-2 text-sm text-slate-500">ڕێژەی پاداشت لە کرێی گەیاندنی هەر داواکارییەک.</p>
          </div>
          <a href="/dashboard/admin/deliveries" className="rounded-xl border bg-white px-4 py-3 text-sm font-bold">گەڕانەوە بۆ گەیاندن</a>
        </header>

        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <Percent size={20} className="text-orange-500" />
            <h2 className="font-black">ڕێژەی پاداشت</h2>
          </div>
          {loading ? <p className="py-8 text-center text-slate-500">بارکردن...</p> : (
            <>
              <label htmlFor="commission-rate" className="mt-5 block text-sm font-bold">ڕێژە بە پێی سەدی (%)</label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  id="commission-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                  className="w-full rounded-xl border p-3 text-lg font-bold"
                />
                <span className="text-2xl font-black text-orange-600">%</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                نموونە: ئەگەر کرێی گەیاندن ٥,٠٠٠ دینار بێت و ڕێژە ٢٠٪ بێت، پاداشتی کاپتن ١,٠٠٠ دینار و بەشی پلاتفۆرم ٤,٠٠٠ دینار دەبێت.
              </p>
              <button disabled={saving} onClick={() => void save()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-bold text-white disabled:opacity-50">
                <Save size={17} /> {saving ? "پاشەکەوتکردن..." : "پاشەکەوتکردنی ڕێژە"}
              </button>
              {settings && <p className="mt-4 text-xs text-slate-400">دوایین نوێکردنەوە: {new Date(settings.updated_at).toLocaleString("ku-IQ")}</p>}
            </>
          )}
        </section>

        <section className="mt-5 rounded-2xl border bg-white p-5 text-sm leading-7 text-slate-600">
          <h2 className="font-black text-slate-900">تێبینیی ژمێریاری</h2>
          <p>پاداشت تەنها کاتێک تۆمار دەکرێت کە کاپتن گەیاندن بە تەواوی پشتڕاست بکاتەوە. ئەو بڕە لە سەرەتادا وەک قەرزی پاداشت تۆمار دەکرێت، نەک باڵانسی پارەدراو. هیچ باڵانسێکی کاپتن بەبێ پرۆسەی جیاوازی پەسەندکردن و پارەدان زیاد ناکرێت.</p>
          <p>گۆڕینی ڕێژە تەنها کاریگەری لەسەر داواکارییە نوێکان دەبێت؛ ڕێژەی داواکارییە کۆنەکان لە کاتی گەیاندن snapshot کراوە.</p>
        </section>
      </div>
    </main>
  );
}
