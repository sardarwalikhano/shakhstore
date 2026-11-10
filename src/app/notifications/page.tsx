"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";

type NotificationItem = {
  id: string;
  type: "system" | "order" | "wallet" | "referral" | "cashout" | "delivery";
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

const typeLabels: Record<NotificationItem["type"], string> = {
  system: "سیستەم",
  order: "داواکاری",
  wallet: "جزدان",
  referral: "خەڵات و بانگهێشت",
  cashout: "کشانەوەی پارە",
  delivery: "گەیاندن",
};

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "بارکردنی ئاگادارکردنەوەکان سەرکەوتوو نەبوو");
      setItems(payload.notifications ?? []);
      setUnreadCount(payload.unreadCount ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "هەڵەیەک ڕوویدا");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function markRead(notificationId?: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationId ? { notificationId } : { markAll: true }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "نوێکردنەوە سەرکەوتوو نەبوو");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "هەڵەیەک ڕوویدا");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6" dir="rtl">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-orange-600">SHAKH STORE</p>
            <h1 className="mt-2 flex items-center gap-2 text-3xl font-black text-slate-900"><Bell /> ئاگادارکردنەوەکان</h1>
            <p className="mt-2 text-sm text-slate-500">{unreadCount} ئاگادارکردنەوەی نەخوێندراوە</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void load()} disabled={loading || busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> نوێکردنەوە
            </button>
            <button onClick={() => void markRead()} disabled={unreadCount === 0 || busy} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              <CheckCheck size={16} /> خوێندنەوەی هەموو
            </button>
          </div>
        </header>

        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        <section className="space-y-3">
          {loading && <div className="rounded-2xl bg-white p-8 text-center text-slate-500">بارکردنی ئاگادارکردنەوەکان...</div>}
          {!loading && items.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><Bell className="mx-auto text-slate-300" size={32} /><p className="mt-3 font-bold text-slate-700">هیچ ئاگادارکردنەوەیەک نییە</p><p className="mt-1 text-sm text-slate-500">کاتێک ئاگادارکردنەوەیەکت هەبێت، لێرە دەردەکەوێت.</p></div>}
          {items.map((item) => (
            <article key={item.id} className={`rounded-2xl border bg-white p-5 ${item.read_at ? "border-slate-200" : "border-orange-200 bg-orange-50/40"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{typeLabels[item.type]}</span>
                    {!item.read_at && <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">نوێ</span>}
                  </div>
                  <h2 className="font-black text-slate-900">{item.title}</h2>
                  {item.body && <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{item.body}</p>}
                  <time className="mt-3 block text-xs text-slate-400">{new Date(item.created_at).toLocaleString("ckb-IQ")}</time>
                </div>
                {!item.read_at && <button onClick={() => void markRead(item.id)} disabled={busy} className="shrink-0 rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs font-bold text-orange-700 disabled:opacity-50">خوێندراوە</button>}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
