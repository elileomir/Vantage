// Extra executive-dashboard datasets for full Power BI parity:
// brand/customer performance (behind target + drop vs LY), and the rep performance matrix.
// "vs LY" needs prior fiscal-year sales; when none are loaded those are flagged empty.

import { createClient } from "@/lib/supabase/server";
import type { Filters } from "@/lib/filters";
import { salesByDimMonth, targetByDimMonth, customerMatrix, prevYtdAlignedBy } from "@/lib/data/agg";

function codeOf(s: string | null | undefined): string {
  const m = String(s ?? "").match(/^\(([^)]+)\)/);
  return (m ? m[1] : String(s ?? "")).trim();
}
// Target workbook appends a numeric suffix to brand names (e.g. "DREAMFARM29", "AMT3").
// Strip trailing digits so they match the clean sales brand names. Sales brands never end in a digit.
function normBrand(s: string | null | undefined): string {
  return String(s ?? "").replace(/\d+$/, "").trim();
}

export interface PerfRow {
  name: string;
  code?: string;
  sales: number;
  target: number;
  behind: number; // sales - target (negative = behind)
  achievement: number | null;
  lySales: number;
  dropVsLy: number | null; // sales - lySales (negative = drop), null if no prior-year
}
export interface RepMatrixRow {
  rep: string;
  sales: number;
  target: number;
  gap: number;
  achievement: number | null;
  lySales: number;
  growth: number | null;
}
// One customer row inside the rep → customer drill matrix ("SALES REP & CUSTOMER PERFORMANCE").
export interface MatrixCustomerRow {
  code: string;
  name: string;
  sales: number;     // CYTD Sales
  target: number;    // CYTD Target (sales-aligned)
  gap: number;       // CYTD Gap = sales - target (negative = behind)
  achievement: number | null; // CY ACHIEVE = sales / target
  lySales: number;   // LY Sales (Previous YTD Aligned)
  growth: number | null;   // LY Growth % = (sales - lySales) / lySales
  lossGain: number | null; // LY Loss/Gain = sales - lySales
}
export interface MatrixRepRow extends Omit<MatrixCustomerRow, "code" | "name"> {
  rep: string;
  customers: MatrixCustomerRow[];
}
export interface DashboardExtras {
  brandPerf: PerfRow[];
  customerPerf: PerfRow[];
  repMatrix: RepMatrixRow[];
  repCustomerMatrix: MatrixRepRow[];
  lyCustomerCount: number;
  hasPriorYear: boolean;
}

export async function getDashboardExtras(fy: string, filters: Filters = {}): Promise<DashboardExtras> {
  const supabase = await createClient();
  // Report as-of (last sale date) — anchors the day-aligned prior-YTD window.
  const asOf = (await supabase
    .from("v_sales_fact").select("sale_date").eq("fiscal_year", fy)
    .order("sale_date", { ascending: false }).limit(1)).data?.[0]?.sale_date as string | undefined;

  // All filter-aware + SQL-aggregated. LY = PBI "Previous YTD Aligned" (day-aligned prior-FY window).
  const [brandSales, brandTgt, brandLy, custMatrix, custTgt, custLy, repSales, repTgt, repLy] = await Promise.all([
    salesByDimMonth(supabase, fy, "brand", filters),
    targetByDimMonth(supabase, fy, "brand", filters),
    asOf ? prevYtdAlignedBy(supabase, fy, asOf, "brand", filters) : Promise.resolve([]),
    customerMatrix(supabase, fy, filters),
    targetByDimMonth(supabase, fy, "customer", filters),
    asOf ? prevYtdAlignedBy(supabase, fy, asOf, "customer_code", filters) : Promise.resolve([]),
    salesByDimMonth(supabase, fy, "sales_representative", filters),
    targetByDimMonth(supabase, fy, "sales_representative", filters),
    asOf ? prevYtdAlignedBy(supabase, fy, asOf, "sales_representative", filters) : Promise.resolve([]),
  ]);

  const hasPriorYear = brandLy.length > 0 || repLy.length > 0;

  // Fiscal months that have sales (filtered) — the sales-aligned target window.
  const aligned = new Set<number>();
  for (const r of repSales) if (r.sales > 0) aligned.add(r.fiscal_month);

  // Brands
  const bs = new Map<string, number>(), bt = new Map<string, number>(), bl = new Map<string, number>();
  for (const r of brandSales) if (r.dim) bs.set(r.dim, (bs.get(r.dim) ?? 0) + r.sales);
  for (const r of brandTgt) {
    if (!r.dim || !aligned.has(r.fiscal_month)) continue;
    const b = normBrand(r.dim);
    bt.set(b, (bt.get(b) ?? 0) + r.target);
  }
  for (const r of brandLy) if (r.dim) bl.set(r.dim, r.sales);
  const brandPerf: PerfRow[] = [...bs.keys()].map((name) => {
    const s = bs.get(name) ?? 0, t = bt.get(name) ?? 0, l = bl.get(name) ?? 0;
    return { name, sales: s, target: t, behind: s - t, achievement: t > 0 ? s / t : null, lySales: l, dropVsLy: l > 0 ? s - l : null };
  });

  // Customers (match target -> sales by code prefix). custMatrix gives code + name + month map.
  const cName = new Map<string, string>(), cs = new Map<string, number>(), ct = new Map<string, number>(), cl = new Map<string, number>();
  for (const r of custMatrix) {
    const code = r.customer_code;
    if (!code) continue;
    const csum = Object.values(r.months).reduce((a, v) => a + Number(v), 0);
    cs.set(code, (cs.get(code) ?? 0) + csum);
    cName.set(code, r.customer_name || code);
  }
  for (const r of custTgt) {
    if (!aligned.has(r.fiscal_month)) continue;
    const code = codeOf(r.dim);
    if (!code) continue;
    ct.set(code, (ct.get(code) ?? 0) + r.target);
  }
  for (const r of custLy) {
    if (r.dim) cl.set(r.dim, r.sales);
  }
  const customerPerf: PerfRow[] = [...cs.keys()].map((code) => {
    const s = cs.get(code) ?? 0, t = ct.get(code) ?? 0, l = cl.get(code) ?? 0;
    return { name: cName.get(code) ?? code, code, sales: s, target: t, behind: s - t, achievement: t > 0 ? s / t : null, lySales: l, dropVsLy: l > 0 ? s - l : null };
  });

  // Rep matrix
  const rs = new Map<string, number>(), rt = new Map<string, number>(), rl = new Map<string, number>();
  for (const r of repSales) {
    const rep = r.dim || "Unassigned";
    rs.set(rep, (rs.get(rep) ?? 0) + r.sales);
  }
  for (const r of repTgt) {
    if (!aligned.has(r.fiscal_month)) continue;
    const rep = r.dim || "Unassigned";
    rt.set(rep, (rt.get(rep) ?? 0) + r.target);
  }
  for (const r of repLy) if (r.dim) rl.set(r.dim, r.sales);
  const repMatrix: RepMatrixRow[] = [...rs.keys()]
    .map((rep) => {
      const s = rs.get(rep) ?? 0, t = rt.get(rep) ?? 0, l = rl.get(rep) ?? 0;
      return { rep, sales: s, target: t, gap: s - t, achievement: t > 0 ? s / t : null, lySales: l, growth: l > 0 ? (s - l) / l : null };
    })
    .sort((a, b) => b.sales - a.sales);

  // Rep → customer drill matrix. custMatrix groups sales by (rep, brand, customer);
  // target/LY come from the per-customer maps (ct/cl) built above, keyed by code.
  const repCust = new Map<string, Map<string, { name: string; sales: number }>>();
  for (const r of custMatrix) {
    const rep = r.sales_representative || "Unassigned";
    const code = r.customer_code;
    if (!code) continue;
    const csum = Object.values(r.months).reduce((a, v) => a + Number(v), 0);
    const m = repCust.get(rep) ?? new Map<string, { name: string; sales: number }>();
    const e = m.get(code) ?? { name: r.customer_name || code, sales: 0 };
    e.sales += csum;
    m.set(code, e);
    repCust.set(rep, m);
  }
  const repCustomerMatrix: MatrixRepRow[] = [...repCust.entries()]
    .map(([rep, custs]) => {
      const customers: MatrixCustomerRow[] = [...custs.entries()]
        .map(([code, v]) => {
          const t = ct.get(code) ?? 0;
          const l = hasPriorYear ? cl.get(code) ?? 0 : 0;
          return {
            code, name: v.name, sales: v.sales, target: t, gap: v.sales - t,
            achievement: t > 0 ? v.sales / t : null,
            lySales: l,
            growth: l > 0 ? (v.sales - l) / l : null,
            lossGain: hasPriorYear ? v.sales - l : null,
          };
        })
        .sort((a, b) => b.sales - a.sales);
      const sales = customers.reduce((a, c) => a + c.sales, 0);
      const target = customers.reduce((a, c) => a + c.target, 0);
      const lySales = customers.reduce((a, c) => a + c.lySales, 0);
      return {
        rep, customers, sales, target, gap: sales - target,
        achievement: target > 0 ? sales / target : null,
        lySales,
        growth: lySales > 0 ? (sales - lySales) / lySales : null,
        lossGain: hasPriorYear ? sales - lySales : null,
      };
    })
    .sort((a, b) => b.sales - a.sales);

  // PBI PREVIOUS_DISTINCT_COUNT_CUSTOMER — distinct customers active in the prior-YTD-aligned window.
  const lyCustomerCount = custLy.filter((r) => r.sales > 0).length;

  return { brandPerf, customerPerf, repMatrix, repCustomerMatrix, lyCustomerCount, hasPriorYear };
}
