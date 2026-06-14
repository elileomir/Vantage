"use client";

// Flexible Power BI-style matrix: nested expandable row groups, per-column formatter + conditional
// (RAG) text color, optional in-cell data bars, multi-level column-group headers, and a totals row.
// Generic and data-driven so every page can configure it without touching this file.

import { Fragment, useState } from "react";
import { rand, count, percent } from "@/lib/format";

// Serializable format/color keys — so SERVER components can pass plain strings (functions can't
// cross the server→client boundary). Client callers may still pass functions.
export type FormatKey = "money" | "qty" | "pct";
export type ColorKey = "rag" | "behind";
const RAG_RED = "#E53935", RAG_GREEN = "#00B050", RAG_AMBER = "#B45309";

function applyFormat(fmt: MatrixColumn["format"], v: number | string | null): string {
  if (v == null) return fmt === "pct" || typeof fmt === "function" ? (typeof fmt === "function" ? fmt(v) : "—") : "—";
  if (typeof fmt === "function") return fmt(v);
  if (fmt === "money") return Number(v) === 0 ? "" : rand(Number(v));
  if (fmt === "qty") return Number(v) === 0 ? "" : count(Number(v));
  if (fmt === "pct") return percent(Number(v));
  return String(v);
}
function applyColor(color: MatrixColumn["color"], v: number | string | null, row: MatrixRow): string | undefined {
  if (!color) return undefined;
  if (typeof color === "function") return color(v, row);
  if (v == null) return undefined;
  const n = Number(v);
  if (color === "rag") return n >= 1 ? RAG_GREEN : n >= 0.8 ? RAG_AMBER : RAG_RED;
  if (color === "behind") return n < 0 ? RAG_RED : undefined;
  return undefined;
}

export type MatrixColumn = {
  key: string;
  header: string;
  group?: string; // optional top-level column-group label (spans contiguous columns)
  align?: "left" | "right";
  format?: FormatKey | ((v: number | string | null) => string); // string key (server-safe) or fn (client)
  color?: ColorKey | ((v: number | string | null, row: MatrixRow) => string | undefined); // text color (RAG)
  bar?: boolean; // render a faint in-cell data bar scaled to the column max
};

export type MatrixRow = {
  id: string;
  label: string;
  cells: Record<string, number | string | null>;
  children?: MatrixRow[];
  isTotal?: boolean;
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

export function PivotMatrix({ columns, rows, labelHeader = "", defaultExpanded = false, maxHeight = 520 }: {
  columns: MatrixColumn[]; rows: MatrixRow[]; labelHeader?: string; defaultExpanded?: boolean; maxHeight?: number;
}) {
  const [open, setOpen] = useState<Set<string>>(() => {
    if (!defaultExpanded) return new Set();
    const s = new Set<string>();
    const walk = (rs: MatrixRow[]) => rs.forEach((r) => { if (r.children?.length) { s.add(r.id); walk(r.children); } });
    walk(rows);
    return s;
  });
  const toggle = (id: string) => setOpen((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Column-group header row (only if any column has a group).
  const groups = columns.some((c) => c.group);
  const groupSpans: { label: string; span: number }[] = [];
  if (groups) for (const c of columns) {
    const g = c.group ?? "";
    const last = groupSpans[groupSpans.length - 1];
    if (last && last.label === g) last.span += 1; else groupSpans.push({ label: g, span: 1 });
  }

  // Per-column max for data bars.
  const colMax: Record<string, number> = {};
  const collect = (rs: MatrixRow[]) => rs.forEach((r) => { for (const c of columns) if (c.bar) colMax[c.key] = Math.max(colMax[c.key] ?? 0, Math.abs(num(r.cells[c.key]))); if (r.children) collect(r.children); });
  collect(rows);

  const renderRow = (r: MatrixRow, depth: number): React.ReactNode => {
    const hasKids = !!r.children?.length;
    const expanded = open.has(r.id);
    return (
      <Fragment key={r.id}>
        <tr className={r.isTotal ? "border-t-2 border-black/15 font-semibold" : "border-b border-black/5 hover:bg-black/[0.015]"}>
          <td className="py-1.5 pr-3" style={{ paddingLeft: 8 + depth * 16 }}>
            <span className="inline-flex items-center gap-1">
              {hasKids ? (
                <button onClick={() => toggle(r.id)} className="text-gray-400 hover:text-[#A6261D]">{expanded ? "▾" : "▸"}</button>
              ) : <span className="inline-block w-3" />}
              <span className={`truncate ${r.isTotal ? "" : "text-gray-800"}`}>{r.label}</span>
            </span>
          </td>
          {columns.map((c) => {
            const v = r.cells[c.key];
            const txt = applyFormat(c.format, v);
            const color = applyColor(c.color, v, r);
            const barPct = c.bar && colMax[c.key] ? (Math.abs(num(v)) / colMax[c.key]) * 100 : 0;
            return (
              <td key={c.key} className={`relative py-1.5 pr-3 tabular-nums ${c.align === "left" ? "text-left" : "text-right"}`} style={{ color }}>
                {c.bar && barPct > 0 && <span className="absolute inset-y-1 right-2 -z-0 rounded-sm bg-[#1FA8C9]/15" style={{ width: `${barPct}%`, maxWidth: "70%" }} />}
                <span className="relative">{txt}</span>
              </td>
            );
          })}
        </tr>
        {hasKids && expanded && r.children!.map((c) => renderRow(c, depth + 1))}
      </Fragment>
    );
  };

  return (
    <div className="overflow-auto" style={{ maxHeight }}>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-white">
          {groups && (
            <tr className="text-[10px] uppercase tracking-wide text-gray-400">
              <th />
              {groupSpans.map((g, i) => <th key={i} colSpan={g.span} className="border-b border-black/10 py-1 text-center font-semibold">{g.label}</th>)}
            </tr>
          )}
          <tr className="border-b border-black/10 text-[11px] uppercase tracking-wide text-gray-400">
            <th className="py-2 pr-3 text-left font-semibold">{labelHeader}</th>
            {columns.map((c) => <th key={c.key} className={`py-2 pr-3 font-semibold ${c.align === "left" ? "text-left" : "text-right"}`}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>{rows.map((r) => renderRow(r, 0))}</tbody>
      </table>
    </div>
  );
}
