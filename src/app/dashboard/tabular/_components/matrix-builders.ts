// Helpers that turn the page's PivotRowData shapes into PivotMatrix {columns, rows}.
// Kept out of the page file so the server component stays lean.

import type { MatrixColumn, MatrixRow } from "@/components/charts/pivot-matrix";
import type { PivotRowData, QuarterGroup, MeasureCell } from "@/lib/data/tabular-page";
import { fiscalMonthLabel } from "@/lib/data/queries";
import { rand, count, percent } from "@/lib/format";

const RED = "#E53935";
const GREEN = "#00B050";
const AMBER = "#B45309";

export const fmtMoney = (v: number | string | null) => (v == null || Number(v) === 0 ? "" : rand(Number(v)));
export const fmtQty = (v: number | string | null) => (v == null || Number(v) === 0 ? "" : count(Number(v)));
export const fmtPct = (v: number | string | null) => (v == null ? "—" : percent(Number(v)));

/** Red when negative (PBI _DIFFERENCE_BEHIND). */
export const behindColor = (v: number | string | null) => (v != null && Number(v) < 0 ? RED : undefined);
/** RAG on an achievement ratio (1 = 100%). */
export const ragColor = (v: number | string | null) => {
  if (v == null) return undefined;
  const r = Number(v);
  return r >= 1 ? GREEN : r >= 0.8 ? AMBER : RED;
};

const emptyCell = (): MeasureCell => ({ sales: 0, target: 0, quantity: 0 });
const cellOf = (r: PivotRowData, fm: number): MeasureCell => r.byMonth.get(fm) ?? emptyCell();

// ── Per-month columns shared by the Sales|Quantity and Sales|Target|Behind matrices ──
type Leaf = "sq" | "stb";

function quarterColumns(quarterGroups: QuarterGroup[], multiMonthQuarters: Set<number>, startMonth: number, leaf: Leaf): MatrixColumn[] {
  const cols: MatrixColumn[] = [];
  const push = (key: string, group: string) => {
    if (leaf === "sq") {
      cols.push({ key: `${key}_s`, header: "Sales", group, format: "money" });
      cols.push({ key: `${key}_q`, header: "Qty", group, format: "qty" });
    } else {
      cols.push({ key: `${key}_s`, header: "Sales", group, format: "money" });
      cols.push({ key: `${key}_t`, header: "Target", group, format: "money" });
      cols.push({ key: `${key}_b`, header: "Behind", group, format: "money", color: "behind" });
    }
  };
  for (const g of quarterGroups) {
    for (const fm of g.fms) push(`m${fm}`, `Q${g.quarter} · ${fiscalMonthLabel(fm, startMonth)}`);
    if (multiMonthQuarters.has(g.quarter)) push(`q${g.quarter}`, `Q${g.quarter} Total`);
  }
  push("total", "Total");
  return cols;
}

function fillCells(cells: Record<string, number | string | null>, prefix: string, c: MeasureCell, leaf: Leaf) {
  if (leaf === "sq") {
    cells[`${prefix}_s`] = c.sales;
    cells[`${prefix}_q`] = c.quantity;
  } else {
    cells[`${prefix}_s`] = c.sales;
    cells[`${prefix}_t`] = c.target;
    cells[`${prefix}_b`] = c.sales - c.target;
  }
}

function rowCells(r: PivotRowData, quarterGroups: QuarterGroup[], multiMonthQuarters: Set<number>, leaf: Leaf): Record<string, number | string | null> {
  const cells: Record<string, number | string | null> = {};
  for (const g of quarterGroups) {
    for (const fm of g.fms) fillCells(cells, `m${fm}`, cellOf(r, fm), leaf);
    if (multiMonthQuarters.has(g.quarter)) {
      const qc = g.fms.reduce((acc, fm) => {
        const c = cellOf(r, fm);
        acc.sales += c.sales;
        acc.target += c.target;
        acc.quantity += c.quantity;
        return acc;
      }, emptyCell());
      fillCells(cells, `q${g.quarter}`, qc, leaf);
    }
  }
  fillCells(cells, "total", r.total, leaf);
  return cells;
}

/** Sales | Quantity matrix (rows may have children e.g. Brand → Product). */
export function buildSalesQtyMatrix(
  rows: PivotRowData[],
  grand: MeasureCell,
  quarterGroups: QuarterGroup[],
  multiMonthQuarters: Set<number>,
  startMonth: number,
  children?: Map<string, PivotRowData[]>,
): { columns: MatrixColumn[]; rows: MatrixRow[] } {
  const columns = quarterColumns(quarterGroups, multiMonthQuarters, startMonth, "sq");
  const toRow = (r: PivotRowData, idPrefix: string, kids?: PivotRowData[]): MatrixRow => ({
    id: `${idPrefix}:${r.name}`,
    label: r.name,
    cells: rowCells(r, quarterGroups, multiMonthQuarters, "sq"),
    children: kids?.map((k) => toRow(k, `${idPrefix}:${r.name}`)),
  });
  const matrixRows: MatrixRow[] = rows.map((r) => toRow(r, "r", children?.get(r.name)));
  matrixRows.push({ id: "__grand", label: "Total", isTotal: true, cells: rowCells({ name: "Total", byMonth: new Map(), total: grand }, quarterGroups, multiMonthQuarters, "sq") });
  return { columns, rows: matrixRows };
}

/** Sales | Target | Behind matrix (per month + quarter + total). */
export function buildSalesTargetBehindMatrix(
  rows: PivotRowData[],
  grand: MeasureCell,
  quarterGroups: QuarterGroup[],
  multiMonthQuarters: Set<number>,
  startMonth: number,
): { columns: MatrixColumn[]; rows: MatrixRow[] } {
  const columns = quarterColumns(quarterGroups, multiMonthQuarters, startMonth, "stb");
  const matrixRows: MatrixRow[] = rows.map((r) => ({
    id: `r:${r.name}`,
    label: r.name,
    cells: rowCells(r, quarterGroups, multiMonthQuarters, "stb"),
  }));
  matrixRows.push({
    id: "__grand",
    label: "Total",
    isTotal: true,
    cells: rowCells({ name: "Total", byMonth: new Map(), total: grand }, quarterGroups, multiMonthQuarters, "stb"),
  });
  return { columns, rows: matrixRows };
}

export { AMBER, GREEN, RED };
