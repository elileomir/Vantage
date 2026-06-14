"use client";

import { useState, useTransition } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { addExclusion, removeExclusion } from "./actions";

export interface Exclusion {
  value: string;
  label: string;
}

export function ExclusionsForm({ exclusions }: { exclusions: Exclusion[] }) {
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function add() {
    const v = input.trim();
    if (!v) return;
    setError(null);
    startTransition(async () => {
      const res = await addExclusion(v, v);
      if (res.ok) setInput("");
      else setError(res.error ?? "Could not add.");
    });
  }
  function remove(value: string) {
    setError(null);
    startTransition(async () => {
      const res = await removeExclusion(value);
      if (!res.ok) setError(res.error ?? "Could not remove.");
    });
  }

  // De-dup by label for display (multiple spellings can map to one label).
  const byLabel = new Map<string, string[]>();
  for (const e of exclusions) {
    const arr = byLabel.get(e.label) ?? [];
    arr.push(e.value);
    byLabel.set(e.label, arr);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {[...byLabel.entries()].map(([label, values]) => (
          <span key={label} className="badge badge-accent">
            {label}
            <button
              type="button"
              onClick={() => values.forEach(remove)}
              disabled={pending}
              aria-label={`Remove ${label} exclusion`}
              className="cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {byLabel.size === 0 && <span className="text-[0.8125rem] text-gray-400">No exclusions — all brands count as sales.</span>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-[260px]"
          placeholder="Brand or category to exclude"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          disabled={pending}
        />
        <button type="button" className="btn-ghost" onClick={add} disabled={pending || !input.trim()}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </div>
      <p className="mt-2 text-[0.8125rem] text-gray-500">
        Excluded brands/categories are removed from every Sales total (matched case-insensitively).
      </p>
      {error && <p className="mt-1 text-[0.8125rem] font-medium" style={{ color: "#c4321c" }}>{error}</p>}
    </div>
  );
}
