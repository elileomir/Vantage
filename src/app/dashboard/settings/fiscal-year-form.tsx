"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { setFiscalYearStart } from "./actions";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function rangeLabel(start: number): string {
  const end = (start + 10) % 12; // month before start (0-indexed)
  return `${MONTHS[start - 1]} to ${MONTHS[end]}`;
}

export function FiscalYearForm({ current }: { current: number }) {
  const [month, setMonth] = useState(current);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = month !== current;

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await setFiscalYearStart(month);
      if (res.ok) setSaved(true);
      else setError(res.error ?? "Could not save.");
    });
  }

  return (
    <div>
      <label htmlFor="fy-start" className="label">
        Fiscal year starts in
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id="fy-start"
          className="input max-w-[200px]"
          value={month}
          onChange={(e) => {
            setMonth(Number(e.target.value));
            setSaved(false);
          }}
          disabled={pending}
        >
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-primary"
          onClick={save}
          disabled={!dirty || pending}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved && !dirty ? <Check className="h-4 w-4" /> : null}
          {pending ? "Saving" : "Save"}
        </button>
      </div>

      <p className="mt-2 text-[0.8125rem] text-gray-500">
        Fiscal year runs <span className="font-medium text-gray-700">{rangeLabel(month)}</span>.
        Saving recomputes the calendar, so every dashboard regroups by the new fiscal year.
      </p>
      {saved && !error && (
        <p className="mt-1 text-[0.8125rem] font-medium" style={{ color: "#16804b" }}>
          Saved. Navigate to a dashboard to see the updated fiscal grouping.
        </p>
      )}
      {error && (
        <p className="mt-1 text-[0.8125rem] font-medium" style={{ color: "#c4321c" }}>
          {error}
        </p>
      )}
    </div>
  );
}
