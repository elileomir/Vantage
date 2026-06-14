"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { setSyncTier } from "./actions";

const TIERS = [
  { value: "manual", label: "Manual", cadence: "No automatic sync" },
  { value: "standard", label: "Standard", cadence: "Daily" },
  { value: "pro", label: "Pro", cadence: "Hourly" },
  { value: "enterprise", label: "Enterprise", cadence: "Every 15 minutes" },
];

export function SyncTierForm({ current }: { current: string }) {
  const [tier, setTier] = useState(current);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = tier !== current;
  const cadence = TIERS.find((t) => t.value === tier)?.cadence ?? "";

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await setSyncTier(tier);
      if (res.ok) setSaved(true);
      else setError(res.error ?? "Could not save.");
    });
  }

  return (
    <div>
      <label htmlFor="sync-tier" className="label">Auto-sync tier</label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id="sync-tier"
          className="input max-w-[220px]"
          value={tier}
          onChange={(e) => { setTier(e.target.value); setSaved(false); }}
          disabled={pending}
        >
          {TIERS.map((t) => (
            <option key={t.value} value={t.value}>{t.label} — {t.cadence}</option>
          ))}
        </select>
        <button type="button" className="btn-primary" onClick={save} disabled={!dirty || pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved && !dirty ? <Check className="h-4 w-4" /> : null}
          {pending ? "Saving" : "Save"}
        </button>
      </div>
      <p className="mt-2 text-[0.8125rem] text-gray-500">
        CIN7 sales sync runs automatically: <span className="font-medium text-gray-700">{cadence}</span>.
        Only changed sales are pulled each run, so existing data is never disturbed.
      </p>
      {saved && !error && <p className="mt-1 text-[0.8125rem] font-medium" style={{ color: "#16804b" }}>Saved.</p>}
      {error && <p className="mt-1 text-[0.8125rem] font-medium" style={{ color: "#c4321c" }}>{error}</p>}
    </div>
  );
}
