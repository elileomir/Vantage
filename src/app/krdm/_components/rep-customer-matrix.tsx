"use client";

// PBI "SALES REP & CUSTOMER PERFORMANCE (VS LAST YEAR)" — an expandable rep → customer matrix.
// Columns: SalesRep/Customer · CYTD Sales · CYTD Target · CYTD Gap · CY ACHIEVE (RAG) · LY Sales · LY Growth · LY Loss/Gain.

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { rand, percent } from "@/lib/format";
import type { MatrixRepRow, MatrixCustomerRow } from "@/lib/data/dashboard-extras";

const GREEN = "#16804b";
const RED = "#c4321c";

function achieveStyle(a: number | null): React.CSSProperties {
  if (a == null) return { background: "#e5e5e5", color: "#9ca3af" };
  if (a >= 1) return { background: "#16804b", color: "#fff" };
  if (a >= 0.8) return { background: "#f0b429", color: "#fff" };
  return { background: "#e23b2e", color: "#fff" };
}
function GrowthCell({ v }: { v: number | null }) {
  if (v == null) return <span className="text-gray-300">–</span>;
  const up = v >= 0;
  return <span style={{ color: up ? GREEN : RED }}>{up ? "▲" : "▼"} {percent(Math.abs(v))}</span>;
}
function Money({ v, muted, bold }: { v: number; muted?: boolean; bold?: boolean }) {
  return <span className={`tabular-nums ${bold ? "font-semibold" : ""} ${muted ? "text-gray-400" : "text-gray-700"}`}>{rand(v)}</span>;
}
function Gap({ v }: { v: number }) {
  return <span className="tabular-nums" style={{ color: v >= 0 ? GREEN : RED }}>{rand(v)}</span>;
}

export function RepCustomerMatrix({ reps }: { reps: MatrixRepRow[] }) {
  // Expand the first rep by default (mirrors the PBI drill-down view).
  const [open, setOpen] = useState<Record<string, boolean>>(() => (reps[0] ? { [reps[0].rep]: true } : {}));
  const toggle = (rep: string) => setOpen((o) => ({ ...o, [rep]: !o[rep] }));

  const totals = reps.reduce(
    (a, r) => ({ sales: a.sales + r.sales, target: a.target + r.target, ly: a.ly + r.lySales }),
    { sales: 0, target: 0, ly: 0 },
  );
  const totalLossGain = reps.some((r) => r.lossGain != null) ? totals.sales - totals.ly : null;
  const totalGrowth = totals.ly > 0 ? (totals.sales - totals.ly) / totals.ly : null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-black/10 bg-[#eef3f7] text-left text-[11px] font-semibold uppercase tracking-wide text-[#1f4e6b]">
            <th className="py-2.5 pl-3 pr-4">SalesRep / Customer</th>
            <th className="py-2.5 pr-4 text-right">CYTD Sales</th>
            <th className="py-2.5 pr-4 text-right">CYTD Target</th>
            <th className="py-2.5 pr-4 text-right">CYTD Gap</th>
            <th className="py-2.5 pr-3 text-center">CY Achieve</th>
            <th className="py-2.5 pr-4 text-right">LY Sales</th>
            <th className="py-2.5 pr-4 text-right">LY Growth</th>
            <th className="py-2.5 pr-3 text-right">LY Loss/Gain</th>
          </tr>
        </thead>
        <tbody>
          {reps.map((r) => {
            const isOpen = !!open[r.rep];
            return (
              <RepGroup key={r.rep} rep={r} isOpen={isOpen} onToggle={() => toggle(r.rep)} />
            );
          })}
          <tr className="border-t-2 border-black/15 bg-[#f7f9fb] font-semibold">
            <td className="py-2.5 pl-3 pr-4">Total</td>
            <td className="py-2.5 pr-4 text-right tabular-nums">{rand(totals.sales)}</td>
            <td className="py-2.5 pr-4 text-right tabular-nums">{rand(totals.target)}</td>
            <td className="py-2.5 pr-4 text-right"><Gap v={totals.sales - totals.target} /></td>
            <td className="py-2.5 pr-3" />
            <td className="py-2.5 pr-4 text-right tabular-nums">{totals.ly > 0 ? rand(totals.ly) : "–"}</td>
            <td className="py-2.5 pr-4 text-right"><GrowthCell v={totalGrowth} /></td>
            <td className="py-2.5 pr-3 text-right tabular-nums">{totalLossGain == null ? "–" : rand(totalLossGain)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function RepGroup({ rep, isOpen, onToggle }: { rep: MatrixRepRow; isOpen: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="border-b border-black/10 bg-[#f7f9fb]">
        <td className="py-2 pl-3 pr-4">
          <button onClick={onToggle} className="flex items-center gap-1.5 font-semibold text-gray-800" aria-expanded={isOpen}>
            <ChevronRight size={14} className={`shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
            {rep.rep}
          </button>
        </td>
        <td className="py-2 pr-4 text-right"><Money v={rep.sales} bold /></td>
        <td className="py-2 pr-4 text-right"><Money v={rep.target} bold /></td>
        <td className="py-2 pr-4 text-right"><Gap v={rep.gap} /></td>
        <td className="py-2 pr-3 text-center">
          <Achieve a={rep.achievement} />
        </td>
        <td className="py-2 pr-4 text-right"><Money v={rep.lySales} bold /></td>
        <td className="py-2 pr-4 text-right"><GrowthCell v={rep.growth} /></td>
        <td className="py-2 pr-3 text-right tabular-nums font-semibold">{rep.lossGain == null ? "–" : rand(rep.lossGain)}</td>
      </tr>
      {isOpen && rep.customers.map((c: MatrixCustomerRow) => (
        <tr key={c.code} className="border-b border-black/5">
          <td className="py-1.5 pl-9 pr-4 text-gray-600">{c.name}</td>
          <td className="py-1.5 pr-4 text-right"><Money v={c.sales} /></td>
          <td className="py-1.5 pr-4 text-right"><Money v={c.target} muted /></td>
          <td className="py-1.5 pr-4 text-right"><Gap v={c.gap} /></td>
          <td className="py-1.5 pr-3 text-center"><Achieve a={c.achievement} /></td>
          <td className="py-1.5 pr-4 text-right">{c.lySales > 0 ? <Money v={c.lySales} muted /> : <span className="text-gray-300">–</span>}</td>
          <td className="py-1.5 pr-4 text-right"><GrowthCell v={c.growth} /></td>
          <td className="py-1.5 pr-3 text-right tabular-nums text-gray-600">{c.lossGain == null ? "–" : rand(c.lossGain)}</td>
        </tr>
      ))}
    </>
  );
}

function Achieve({ a }: { a: number | null }) {
  return (
    <span className="inline-block min-w-[44px] rounded px-2 py-0.5 text-xs font-semibold tabular-nums" style={achieveStyle(a)}>
      {a == null ? "–" : percent(a)}
    </span>
  );
}
