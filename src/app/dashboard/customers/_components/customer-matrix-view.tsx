"use client";

// Customer Analysis matrix (PBI page [3]) — the page's core visual.
// Wraps the shared PivotMatrix with a YEARLY / MONTHLY toggle (MONTHLY = default/active).
//   MONTHLY: columns grouped by month -> SALES, PERIOD CHANGE %, PERIOD CHANGE VAL.
//            PERIOD CHANGE is month-over-month (this month - previous; first month blank),
//            computed per row off its own monthly series, at every hierarchy level.
//   YEARLY:  a single fiscal-year column showing total Sales only.
// Rows: SalesRep -> Brand -> Customer (expandable). Data is already aggregated server-side.

import { useState } from "react";
import { PivotMatrix, type MatrixColumn, type MatrixRow } from "@/components/charts/pivot-matrix";
import { percent } from "@/lib/format";
import type { CustomerMatrixNode } from "@/lib/data/customers-page";

type View = "MONTHLY" | "YEARLY";

const RED = "#c4321c";
const GREEN = "#16804b";

// PBI customer matrix shows plain 2-decimal comma-grouped numbers (no "R"), "-" for empties.
const num2 = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Power BI leaves zero cells blank; sales of 0 -> null so the matrix renders "—"/empty.
const salesOrNull = (v: number): number | null => (v === 0 ? null : v);

/** Build the per-row cells map for the MONTHLY view from a node's monthly series. */
function monthlyCells(node: CustomerMatrixNode, nMonths: number): Record<string, number | null> {
  const cells: Record<string, number | null> = {};
  for (let i = 0; i < nMonths; i++) {
    const cur = node.sales[i];
    cells[`m${i}_sales`] = salesOrNull(cur);
    if (i === 0) {
      cells[`m${i}_chgpct`] = null; // first month has no previous -> blank
      cells[`m${i}_chgval`] = null;
    } else {
      const prev = node.sales[i - 1];
      const val = cur - prev;
      // Only a meaningful change when there is something to compare against.
      const meaningful = cur !== 0 || prev !== 0;
      cells[`m${i}_chgval`] = meaningful ? val : null;
      cells[`m${i}_chgpct`] = meaningful && prev !== 0 ? val / prev : null;
    }
  }
  return cells;
}

function toMatrixRow(node: CustomerMatrixNode, nMonths: number, view: View): MatrixRow {
  const cells: Record<string, number | null> =
    view === "MONTHLY" ? monthlyCells(node, nMonths) : { fy_sales: salesOrNull(node.total) };
  return {
    id: node.id,
    label: node.label,
    cells,
    children: node.children?.map((c) => toMatrixRow(c, nMonths, view)),
  };
}

export function CustomerMatrixView({
  reps,
  months,
  fyLabel,
  monthTotals,
  grandTotal,
}: {
  reps: CustomerMatrixNode[];
  months: string[];
  fyLabel: string;
  monthTotals: number[];
  grandTotal: number;
}) {
  const [view, setView] = useState<View>("MONTHLY");
  const nMonths = months.length;

  // Column definitions.
  const chgValColor = (v: number | string | null) =>
    v == null || typeof v !== "number" ? undefined : v >= 0 ? GREEN : RED;
  const chgPctColor = chgValColor;

  let columns: MatrixColumn[];
  if (view === "MONTHLY") {
    columns = months.flatMap((label, i) => [
      { key: `m${i}_sales`, header: "SALES", group: label, align: "right", format: (v) => (v == null ? "-" : num2(Number(v))) },
      { key: `m${i}_chgpct`, header: "PERIOD CHANGE %", group: label, align: "right", format: (v) => (v == null ? "-" : percent(Number(v))), color: chgPctColor },
      { key: `m${i}_chgval`, header: "PERIOD CHANGE VAL", group: label, align: "right", format: (v) => (v == null ? "-" : num2(Number(v))), color: chgValColor },
    ] as MatrixColumn[]);
  } else {
    columns = [
      { key: "fy_sales", header: "SALES", group: fyLabel, align: "right", format: (v) => (v == null ? "-" : num2(Number(v))) },
    ];
  }

  const rows: MatrixRow[] = reps.map((r) => toMatrixRow(r, nMonths, view));

  // Grand-total row (matches PBI matrix total).
  const totalNode: CustomerMatrixNode = { id: "__total__", label: "Total", sales: monthTotals, total: grandTotal };
  const totalCells =
    view === "MONTHLY" ? monthlyCells(totalNode, nMonths) : { fy_sales: salesOrNull(grandTotal) };
  const totalRow: MatrixRow = { id: "__total__", label: "Total", cells: totalCells, isTotal: true };

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 style={{ color: "#0f2a43" }} className="text-[13px] font-bold uppercase tracking-wide">Customer Monthly Sale by Brands</h3>
        <div className="flex items-center gap-1">
          {(["YEARLY", "MONTHLY"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="rounded-md px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors"
              style={view === v ? { background: "#1FA8C9", color: "#fff" } : { background: "#eef3f7", color: "#64748b" }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <PivotMatrix
        columns={columns}
        rows={[...rows, totalRow]}
        labelHeader="SalesRep"
        maxHeight={640}
      />
    </section>
  );
}
