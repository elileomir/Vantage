"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const OPTIONS = [0.7, 0.75, 0.8, 0.85, 0.9];

/** PBI PARAM_PARETO what-if slicer: sets the cumulative Pareto threshold via the `pareto` URL param. */
export function ParetoControl({ value }: { value: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function set(v: string) {
    const p = new URLSearchParams(sp.toString());
    if (v && v !== "0.8") p.set("pareto", v);
    else p.delete("pareto");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-gray-400">Threshold</span>
      <select className="filter-chip cursor-pointer" value={String(value)} onChange={(e) => set(e.target.value)}>
        {OPTIONS.map((o) => (
          <option key={o} value={String(o)}>
            {Math.round(o * 100)}%
          </option>
        ))}
      </select>
    </label>
  );
}

/** Parse the `pareto` URL param to a 0–1 threshold (default 0.8). */
export function parseParetoThreshold(sp: Record<string, string | string[] | undefined>): number {
  const raw = Array.isArray(sp.pareto) ? sp.pareto[0] : sp.pareto;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n < 1 ? n : 0.8;
}
