// Reusable, filter-aware aggregation API. EVERY chart (current and future) should fetch its
// data through salesAgg()/salesKpis() so the global filters apply consistently and automatically.
// Filtering + grouping happen in Postgres (get_sales_agg / get_sales_kpis RPCs).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Filters } from "@/lib/filters";
import { applyFactFilters } from "@/lib/filters";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fetch ALL matching v_sales_fact rows, paging past PostgREST's 1000-row response cap.
 * (A plain `.limit(20000)` is silently truncated to 1000 → wrong aggregations.) Uses a fully
 * deterministic multi-column order so `.range()` page boundaries never drift/duplicate.
 * Filter-aware. Use ONLY when line-level columns are needed (tax/total/sku); prefer the agg RPCs otherwise.
 */
export async function fetchAllFacts(
  supabase: SupabaseClient,
  opts: { columns: string; fiscalYear: string; filters: Filters; extra?: (q: any) => any; cap?: number },
): Promise<Record<string, unknown>[]> {
  const PAGE = 1000;
  const cap = opts.cap ?? 60000;
  const out: Record<string, unknown>[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    let q: any = supabase
      .from("v_sales_fact")
      .select(opts.columns)
      .eq("fiscal_year", opts.fiscalYear)
      .order("sale_date", { ascending: true })
      .order("sales_representative", { ascending: true })
      .order("customer_code", { ascending: true })
      .order("brand", { ascending: true })
      .order("sku", { ascending: true })
      .order("amount", { ascending: true });
    q = applyFactFilters(q, opts.filters);
    if (opts.extra) q = opts.extra(q);
    q = q.range(from, from + PAGE - 1);
    const { data } = await q;
    const rows = (data ?? []) as Record<string, unknown>[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Dimensions you can group by. Validated server-side by the RPC. */
export type Dim =
  | "brand" | "product" | "sku" | "sales_representative"
  | "customer_code" | "customer_name" | "category" | "fiscal_month" | "fiscal_quarter" | "month_short";

export interface AggRow {
  dim: string;
  sales: number;
  quantity: number;
  lines: number;
}
export interface KpiRow {
  sales: number; quantity: number; customers: number; reps: number; brands: number; products: number; lines: number;
}

/** Map UI Filters -> the RPC jsonb (drops the fy key, which is passed separately). */
function toJsonb(f: Filters): Record<string, string> {
  const o: Record<string, string> = {};
  for (const k of ["rep", "brand", "customer", "quarter", "month", "weekStart", "date", "dateFrom", "dateTo", "product", "sku", "invoice"] as (keyof Filters)[]) {
    if (f[k]) o[k] = f[k] as string;
  }
  return o;
}

const n = (v: unknown) => (v == null ? 0 : Number(v));

export interface DailyAggRow { sale_date: string; sales: number; quantity: number; lines: number; }
export interface DimMonthRow { dim: string; fiscal_month: number; sales: number; quantity: number; lines: number; }

/** Per-day sales/qty/lines with filters applied (aggregated in SQL — immune to the 1000-row cap). */
export async function salesDaily(supabase: SupabaseClient, fy: string, filters: Filters): Promise<DailyAggRow[]> {
  const { data } = await supabase.rpc("get_daily_sales", { p_fy: fy, p_filters: toJsonb(filters) });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    sale_date: String(r.sale_date ?? "").slice(0, 10),
    sales: n(r.sales), quantity: n(r.quantity), lines: n(r.lines),
  }));
}

/** Per (dimension × fiscal_month) sales/qty/lines with filters applied (aggregated in SQL). */
export async function salesByDimMonth(supabase: SupabaseClient, fy: string, dim: Dim, filters: Filters): Promise<DimMonthRow[]> {
  const { data } = await supabase.rpc("get_sales_by_dim_month", { p_fy: fy, p_dim: dim, p_filters: toJsonb(filters) });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    dim: String(r.dim ?? ""), fiscal_month: n(r.fiscal_month),
    sales: n(r.sales), quantity: n(r.quantity), lines: n(r.lines),
  }));
}

export interface TargetMonthRow { dim: string; fiscal_month: number; target: number; }

/** Per (dim × fiscal_month) target with rep/brand/month filters applied (aggregated in SQL). */
export async function targetByDimMonth(supabase: SupabaseClient, fy: string, dim: "sales_representative" | "customer" | "brand", filters: Filters): Promise<TargetMonthRow[]> {
  const { data } = await supabase.rpc("get_target_by_dim_month", { p_fy: fy, p_dim: dim, p_filters: toJsonb(filters) });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ dim: String(r.dim ?? ""), fiscal_month: n(r.fiscal_month), target: n(r.target) }));
}

export interface RepTargetLine { customer: string; brand: string; annual: number; months: Record<string, number> }

/** Target lines for one rep: one row per (customer, brand) with a fiscal_month→target map. */
export async function repTargetLines(supabase: SupabaseClient, fy: string, rep: string): Promise<RepTargetLine[]> {
  const { data } = await supabase.rpc("get_rep_target_lines", { p_fy: fy, p_rep: rep });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    customer: String(r.customer ?? "Unassigned"),
    brand: String(r.brand ?? "Unassigned"),
    annual: Number(r.annual ?? 0),
    months: (r.months ?? {}) as Record<string, number>,
  }));
}

/** PBI "Previous YTD Aligned" by dimension: prior-FY sales over the same day-of-fiscal-year window. */
export async function prevYtdAlignedBy(supabase: SupabaseClient, fy: string, asof: string, dim: Dim, filters: Filters): Promise<{ dim: string; sales: number }[]> {
  const { data } = await supabase.rpc("prev_ytd_aligned_by", { p_fy: fy, p_asof: asof, p_dim: dim, p_filters: toJsonb(filters) });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ dim: String(r.dim ?? ""), sales: n(r.sales) }));
}

export interface CustomerMatrixRow {
  sales_representative: string; brand: string; customer_code: string; customer_name: string;
  months: Record<string, number>;
}

/** Customer matrix source: one row per (rep, brand, customer) with a fiscal_month→sales map. */
export async function customerMatrix(supabase: SupabaseClient, fy: string, filters: Filters): Promise<CustomerMatrixRow[]> {
  const { data } = await supabase.rpc("get_customer_matrix", { p_fy: fy, p_filters: toJsonb(filters) });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    sales_representative: String(r.sales_representative ?? "Unassigned"),
    brand: String(r.brand ?? "Unassigned"),
    customer_code: String(r.customer_code ?? ""),
    customer_name: String(r.customer_name ?? "Unknown"),
    months: (r.months ?? {}) as Record<string, number>,
  }));
}

export interface TwoDimRow { k1: string; k2: string; sales: number; }

/** Per (dim1 × dim2) sales with filters applied (aggregated in SQL — for decomposition trees). */
export async function salesByTwoDims(supabase: SupabaseClient, fy: string, dim1: Dim, dim2: Dim, filters: Filters): Promise<TwoDimRow[]> {
  const { data } = await supabase.rpc("get_sales_by_two_dims", { p_fy: fy, p_dim1: dim1, p_dim2: dim2, p_filters: toJsonb(filters) });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ k1: String(r.k1 ?? "Unknown"), k2: String(r.k2 ?? "Unknown"), sales: n(r.sales) }));
}

/** Build a 2-level decomposition tree (top `parents` parents, each with top `children` children). */
export function buildTree(rows: TwoDimRow[], parents = 9, children = 8): { name: string; value: number; products: { name: string; value: number }[] }[] {
  const m = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const c = m.get(r.k1) ?? new Map<string, number>();
    c.set(r.k2, (c.get(r.k2) ?? 0) + r.sales);
    m.set(r.k1, c);
  }
  return [...m.entries()]
    .map(([name, kids]) => ({
      name,
      value: [...kids.values()].reduce((a, v) => a + v, 0),
      products: [...kids.entries()].map(([n2, value]) => ({ name: n2, value })).sort((a, b) => b.value - a.value).slice(0, children),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, parents);
}

/** Aggregated sales for a dimension, with the active filters applied. Sorted by sales desc. */
export async function salesAgg(supabase: SupabaseClient, fy: string, dim: Dim, filters: Filters): Promise<AggRow[]> {
  const { data } = await supabase.rpc("get_sales_agg", { p_fy: fy, p_dim: dim, p_filters: toJsonb(filters) });
  return ((data ?? []) as Record<string, unknown>[])
    .map((r) => ({ dim: String(r.dim ?? ""), sales: n(r.sales), quantity: n(r.quantity), lines: n(r.lines) }))
    .sort((a, b) => b.sales - a.sales);
}

/** Headline KPIs (total sales/qty + distinct counts) with the active filters applied. */
export async function salesKpis(supabase: SupabaseClient, fy: string, filters: Filters): Promise<KpiRow> {
  const { data } = await supabase.rpc("get_sales_kpis", { p_fy: fy, p_filters: toJsonb(filters) });
  const r = (((data ?? []) as Record<string, unknown>[])[0]) ?? {};
  return {
    sales: n(r.sales), quantity: n(r.quantity), customers: n(r.customers),
    reps: n(r.reps), brands: n(r.brands), products: n(r.products), lines: n(r.lines),
  };
}

/** Pareto helper: cumulative share (descending). Reusable for any agg result. */
export function withPareto(rows: AggRow[], threshold = 0.8): (AggRow & { cumulative: number; inThreshold: boolean })[] {
  const total = rows.reduce((a, r) => a + Math.max(0, r.sales), 0) || 1;
  let run = 0;
  return rows.map((r) => {
    const prev = run / total;
    run += Math.max(0, r.sales);
    return { ...r, cumulative: run / total, inThreshold: prev < threshold };
  });
}
