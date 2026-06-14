"use client";

// Refresh button — triggers the CIN7 incremental delta sync (/api/refresh), then re-pulls
// the dashboard (router.refresh re-runs the force-dynamic server components against fresh data).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check, AlertTriangle } from "lucide-react";

type Result = { ok: boolean; upToDate: boolean; salesUpserted: number; rowsUpserted: number; asOf: string | null };

export function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  async function refresh() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const r = (await res.json()) as Result;
      if (!res.ok || !r.ok) {
        setMsg({ tone: "warn", text: "Sync failed" });
      } else if (r.upToDate || r.rowsUpserted === 0) {
        setMsg({ tone: "ok", text: "Up to date" });
      } else {
        setMsg({ tone: "ok", text: `Updated ${r.salesUpserted} sale${r.salesUpserted === 1 ? "" : "s"}` });
        router.refresh();
      }
    } catch {
      setMsg({ tone: "warn", text: "Sync failed" });
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 6000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg && (
        <span
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color: msg.tone === "ok" ? "#16804b" : "#c4321c" }}
        >
          {msg.tone === "ok" ? <Check size={13} /> : <AlertTriangle size={13} />}
          {msg.text}
        </span>
      )}
      <button
        onClick={refresh}
        disabled={busy}
        title="Pull latest sales from CIN7 (checks for changes since last sync)"
        className="flex h-8 items-center gap-1.5 rounded-full border border-[#1FA8C9]/40 bg-[#1FA8C9]/10 px-3 text-xs font-semibold text-[#0e7490] transition hover:bg-[#1FA8C9]/15 disabled:opacity-60"
      >
        <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
        {busy ? "Syncing…" : "Refresh"}
      </button>
    </div>
  );
}
