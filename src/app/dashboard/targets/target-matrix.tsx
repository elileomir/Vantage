"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { RepTargetLine } from "@/lib/data/agg";
import { updateTargetCell } from "./actions";

const randFull = (v: number) => `R${Math.round(v).toLocaleString("en-ZA")}`;
const randCompact = (v: number) =>
  v >= 1_000_000 ? `R${(v / 1_000_000).toFixed(1)}m` : v >= 1000 ? `R${Math.round(v / 1000)}k` : `R${Math.round(v)}`;

const MAX_ROWS = 80;
type CellStatus = "idle" | "saving" | "saved" | "error";

function Cell({
  fy, rep, customer, brand, month, value, canEdit, onCommit,
}: {
  fy: string; rep: string; customer: string; brand: string; month: number;
  value: number; canEdit: boolean; onCommit: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<CellStatus>("idle");
  const [msg, setMsg] = useState<string>();

  async function save() {
    setEditing(false);
    const parsed = Number(draft.replace(/[, ]/g, ""));
    if (!Number.isFinite(parsed) || parsed < 0) { setStatus("error"); setMsg("Enter a number ≥ 0"); return; }
    const rounded = Math.round(parsed);
    if (rounded === value) { setStatus("idle"); return; }
    setStatus("saving");
    const res = await updateTargetCell({ fy, rep, customer, brand, month, amount: rounded });
    if (res.ok) { onCommit(rounded); setStatus("saved"); setTimeout(() => setStatus("idle"), 1100); }
    else { setStatus("error"); setMsg(res.error ?? "Save failed"); }
  }

  if (!canEdit) {
    return (
      <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: value ? "var(--color-fg)" : "var(--color-fg-faint)" }}>
        {value ? randFull(value) : "—"}
      </td>
    );
  }
  return (
    <td className="px-1 py-1 text-right">
      {editing ? (
        <input
          autoFocus
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") { setEditing(false); setStatus("idle"); }
          }}
          className="w-[84px] rounded-[var(--radius-sm)] px-2 py-1 text-right text-[0.8125rem] tabular-nums outline-none"
          style={{ border: "1.5px solid var(--color-accent)", background: "var(--color-bg)", color: "var(--color-fg)" }}
          aria-label={`Target for ${customer}, ${brand}, month ${month}`}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setDraft(String(value)); setEditing(true); setStatus((s) => (s === "error" ? "idle" : s)); }}
          title={status === "error" ? msg : "Click to edit"}
          className="w-[84px] cursor-text rounded-[var(--radius-sm)] px-2 py-1 text-right text-[0.8125rem] tabular-nums transition-colors"
          style={{
            color: value ? "var(--color-fg)" : "var(--color-fg-faint)",
            background: status === "saved" ? "var(--color-accent-muted)" : "transparent",
            boxShadow: status === "error" ? "inset 0 0 0 1.5px var(--color-negative)" : "inset 0 0 0 1px transparent",
            opacity: status === "saving" ? 0.45 : 1,
          }}
        >
          {value ? randFull(value) : "—"}
        </button>
      )}
    </td>
  );
}

export function TargetEditor({
  fy, rep, repOptions, monthLabels, lines, canEdit,
}: {
  fy: string;
  rep: string;
  repOptions: string[];
  monthLabels: string[];
  lines: RepTargetLine[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [query, setQuery] = useState("");

  // Live overrides: `${customer}|${brand}|${month}` -> value.
  const [edits, setEdits] = useState<Record<string, number>>({});
  const valueOf = (l: RepTargetLine, m: number) =>
    edits[`${l.customer}|${l.brand}|${m}`] ?? Number(l.months[String(m)] ?? 0);

  function selectRep(next: string) {
    const p = new URLSearchParams(sp.toString());
    p.set("trep", next);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((l) => `${l.customer} ${l.brand}`.toLowerCase().includes(q));
  }, [lines, query]);
  const visible = filtered.slice(0, MAX_ROWS);

  const annualOf = (l: RepTargetLine) => monthLabels.reduce((a, _, m) => a + valueOf(l, m + 1), 0);
  const grand = filtered.reduce((a, l) => a + annualOf(l), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--color-fg-faint)" }}>Representative</span>
          <select className="filter-chip cursor-pointer" value={rep} onChange={(e) => selectRep(e.target.value)}>
            {repOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customer or brand…"
          className="input !w-[240px] !py-1.5 !text-[0.8125rem]"
          aria-label="Search target lines"
        />
        <span className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
          {filtered.length} line{filtered.length === 1 ? "" : "s"}
          {filtered.length > MAX_ROWS ? ` · showing top ${MAX_ROWS}, search to narrow` : ""}
        </span>
        <span className="ml-auto text-xs" style={{ color: "var(--color-fg-muted)" }}>
          {canEdit ? "Click a cell to edit — saves automatically." : "Read-only (admin / manager to edit)."}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="sticky left-0 z-10" style={{ background: "var(--color-surface-2, #f5f4f1)", minWidth: 260 }}>Customer · Brand</th>
              {monthLabels.map((l) => <th key={l} className="text-right">{l}</th>)}
              <th className="text-right">Annual</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((l) => (
              <tr key={`${l.customer}|${l.brand}`}>
                <td className="sticky left-0 z-10" style={{ background: "var(--color-bg)" }}>
                  <span className="block max-w-[260px] truncate font-medium" style={{ color: "var(--color-fg)" }} title={l.customer}>{l.customer}</span>
                  <span className="text-[0.7rem]" style={{ color: "var(--color-fg-faint)" }}>{l.brand}</span>
                </td>
                {monthLabels.map((_, m) => (
                  <Cell
                    key={m}
                    fy={fy}
                    rep={rep}
                    customer={l.customer}
                    brand={l.brand}
                    month={m + 1}
                    value={valueOf(l, m + 1)}
                    canEdit={canEdit}
                    onCommit={(v) => setEdits((e) => ({ ...e, [`${l.customer}|${l.brand}|${m + 1}`]: v }))}
                  />
                ))}
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums" style={{ color: "var(--color-fg)" }}>
                  {randCompact(annualOf(l))}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={14} className="py-6 text-center text-sm" style={{ color: "var(--color-fg-muted)" }}>No target lines match your search.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky left-0 z-10 font-semibold" style={{ background: "var(--color-surface-2, #f5f4f1)", color: "var(--color-fg)" }}>
                {rep} · total
              </td>
              <td colSpan={monthLabels.length} />
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums" style={{ color: "var(--color-accent)" }}>
                {randCompact(grand)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
