// Server-side data layer for the Customer Analysis page (PBI page [3]).
//
// The page is ONE Power BI matrix:
//   Rows:    SalesRep -> Brand -> Customer "(CODE) Name"  (expandable hierarchy)
//   Columns: grouped by MONTH (fiscal months that have data); each month shows
//            SALES (SALES AMOUNT NORMALIZATION), PERIOD CHANGE % and PERIOD CHANGE VAL.
//   YEARLY view collapses the month columns into one FY column (Sales only).
//
// PERIOD_CHANGE is MONTH-OVER-MONTH (verified): each month minus the previous month
// (first month blank). Computed per row at EVERY hierarchy level (customer/brand/rep)
// off that row's own monthly series — i.e. the matrix subtotals carry their own MoM.
//
// Scale safety: the PBI version failed ("query exceeded resources") because it pulled
// raw line rows. We fetch the SQL-aggregated get_customer_matrix RPC (one row per
// rep/brand/customer with a fiscal_month->sales map) and roll up in JS — tiny payload,
// immune to the 1000-row cap. No new RPCs.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Filters } from "@/lib/filters";
import { customerMatrix } from "@/lib/data/agg";
import { fiscalMonthLabel } from "@/lib/data/queries";

const num = (v: unknown): number => (v == null ? 0 : Number(v));

/** A single matrix node (rep / brand / customer) with its monthly sales series. */
export interface CustomerMatrixNode {
  id: string;
  label: string;
  /** sales[i] aligns to `months[i]`. */
  sales: number[];
  total: number;
  children?: CustomerMatrixNode[];
}

export interface CustomerMatrixData {
  /** Fiscal-month short labels in fiscal order, one per matrix month column. */
  months: string[];
  /** FY label (e.g. "2026-2027") for the yearly column header. */
  fyLabel: string;
  /** Nested rep -> brand -> customer rows, sorted by total sales desc at each level. */
  reps: CustomerMatrixNode[];
  /** Column totals across all reps, per month index. */
  monthTotals: number[];
  /** Grand total sales. */
  grandTotal: number;
  hasData: boolean;
}

const sumArr = (a: number[]): number => a.reduce((s, v) => s + v, 0);
const addInto = (acc: number[], src: number[]): void => {
  for (let i = 0; i < acc.length; i++) acc[i] += src[i];
};

/**
 * Build the Customer Analysis matrix from the aggregated get_customer_matrix RPC.
 * Filter-aware (rep/brand/customer/etc. slicers apply via the RPC's jsonb payload).
 */
export async function getCustomerAnalysis(
  supabase: SupabaseClient,
  fy: string,
  filters: Filters,
  startMonth: number,
): Promise<CustomerMatrixData> {
  const rows = await customerMatrix(supabase, fy, filters);

  // Fiscal months that actually have data, in fiscal order.
  const monthSet = new Set<number>();
  for (const r of rows) {
    for (const [fm, amt] of Object.entries(r.months)) {
      if (num(amt) !== 0) monthSet.add(Number(fm));
    }
  }
  const fms = [...monthSet].sort((a, b) => a - b);
  const months = fms.map((m) => fiscalMonthLabel(m, startMonth));
  const monthIndex = new Map(fms.map((m, i) => [m, i]));
  const nMonths = fms.length;

  // rep -> brand -> customer -> sales[monthIndex]
  type Cust = { label: string; sales: number[] };
  type Brand = { brand: string; customers: Map<string, Cust> };
  type Rep = { rep: string; brands: Map<string, Brand> };
  const repMap = new Map<string, Rep>();

  for (const r of rows) {
    const repName = r.sales_representative?.trim() || "Unassigned";
    const brandName = r.brand?.trim() || "Unassigned";
    const code = r.customer_code?.trim() || "";
    const name = r.customer_name?.trim() || code || "Unknown";
    const label = code ? `(${code}) ${name}` : name;

    let rep = repMap.get(repName);
    if (!rep) { rep = { rep: repName, brands: new Map() }; repMap.set(repName, rep); }
    let brand = rep.brands.get(brandName);
    if (!brand) { brand = { brand: brandName, customers: new Map() }; rep.brands.set(brandName, brand); }
    let cust = brand.customers.get(label);
    if (!cust) { cust = { label, sales: Array(nMonths).fill(0) }; brand.customers.set(label, cust); }

    for (const [fm, amt] of Object.entries(r.months)) {
      const i = monthIndex.get(Number(fm));
      if (i == null) continue;
      cust.sales[i] += num(amt);
    }
  }

  // Roll up customer -> brand -> rep; sort each level by total sales desc.
  const reps: CustomerMatrixNode[] = [...repMap.values()]
    .map((rep) => {
      const repSales = Array(nMonths).fill(0) as number[];
      const brands: CustomerMatrixNode[] = [...rep.brands.values()]
        .map((brand) => {
          const brandSales = Array(nMonths).fill(0) as number[];
          const customers: CustomerMatrixNode[] = [...brand.customers.values()]
            .sort((a, b) => sumArr(b.sales) - sumArr(a.sales))
            .map((c) => {
              addInto(brandSales, c.sales);
              return { id: `${rep.rep}|${brand.brand}|${c.label}`, label: c.label, sales: c.sales, total: sumArr(c.sales) };
            });
          addInto(repSales, brandSales);
          return { id: `${rep.rep}|${brand.brand}`, label: brand.brand, sales: brandSales, total: sumArr(brandSales), children: customers };
        })
        .sort((a, b) => b.total - a.total);
      return { id: rep.rep, label: rep.rep, sales: repSales, total: sumArr(repSales), children: brands };
    })
    .sort((a, b) => b.total - a.total);

  const monthTotals = Array(nMonths).fill(0) as number[];
  for (const r of reps) addInto(monthTotals, r.sales);

  return {
    months,
    fyLabel: fy.replace(/\D/g, "") ? `${Number(fy.replace(/\D/g, ""))}-${Number(fy.replace(/\D/g, "")) + 1}` : fy,
    reps,
    monthTotals,
    grandTotal: sumArr(monthTotals),
    hasData: reps.length > 0 && sumArr(monthTotals) !== 0,
  };
}
