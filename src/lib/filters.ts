// Global dashboard filters. State lives in the URL (?rep=&brand=&customer=&quarter=&month=&product=&sku=&invoice=&fy=),
// so it is server-readable, shareable, and preserved across navigation. Filters apply to v_sales_fact.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface Filters {
  fy?: string; // fiscal_year (e.g. FY2026); period selector
  rep?: string; // sales_representative
  brand?: string;
  customer?: string; // customer_code
  quarter?: string; // fiscal_quarter (Q1..Q4)
  month?: string; // fiscal_month (1..12)
  weekStart?: string; // week_start (YYYY-MM-DD)
  date?: string; // sale_date (YYYY-MM-DD) — single-day (legacy)
  dateFrom?: string; // sale_date >= (YYYY-MM-DD) — range start
  dateTo?: string; // sale_date <= (YYYY-MM-DD) — range end
  product?: string;
  sku?: string;
  invoice?: string; // 'Invoice' | 'Credit note'
}

export const FILTER_KEYS: (keyof Filters)[] = [
  "fy", "rep", "quarter", "month", "weekStart", "date", "dateFrom", "dateTo", "brand", "product", "invoice", "customer", "sku",
];

/** Labels for the active-filter chips (excludes fy, which the bar shows as the period). */
export const FILTER_LABELS: Record<keyof Filters, string> = {
  fy: "Fiscal Year", rep: "Representative", brand: "Brand", customer: "Customer",
  quarter: "Quarter", month: "Month", weekStart: "Week Start", date: "Date",
  dateFrom: "From", dateTo: "To", product: "Product", sku: "SKU", invoice: "Invoice/Credit",
};

type SearchParams = Record<string, string | string[] | undefined>;

export function parseFilters(sp: SearchParams | undefined): Filters {
  const f: Filters = {};
  if (!sp) return f;
  for (const k of FILTER_KEYS) {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    if (s) f[k] = s;
  }
  return f;
}

/** Serialize to a query string (omits empty). Optionally merge/override extra params. */
export function serializeFilters(f: Filters, extra?: Partial<Record<keyof Filters, string | undefined>>): string {
  const merged = { ...f, ...extra };
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = merged[k];
    if (v) p.set(k, v);
  }
  return p.toString();
}

/** Active filters (excluding fy) as {key,value} for chips. */
export function activeChips(f: Filters): { key: keyof Filters; value: string }[] {
  return FILTER_KEYS.filter((k) => k !== "fy" && f[k]).map((k) => ({ key: k, value: f[k] as string }));
}

export function hasActiveFilters(f: Filters): boolean {
  return activeChips(f).length > 0;
}

/** Map each filter key to its underlying v_sales_fact column + value coercion. */
export const FILTER_COLUMN: Record<keyof Filters, { col: string; coerce?: (v: string) => unknown }> = {
  fy: { col: "fiscal_year" },
  rep: { col: "sales_representative" },
  brand: { col: "brand" },
  customer: { col: "customer_code" },
  quarter: { col: "fiscal_quarter" },
  month: { col: "fiscal_month", coerce: (v) => Number(v) },
  weekStart: { col: "week_start" },
  date: { col: "sale_date" },
  dateFrom: { col: "sale_date" }, // range — applied as gte (see applyFactFilters)
  dateTo: { col: "sale_date" }, // range — applied as lte
  product: { col: "product" },
  sku: { col: "sku" },
  invoice: { col: "invoice_credit_note" },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Apply the line-level filters to a query against v_sales_fact.
 * Pass `except` to omit one filter — used for cross-filtering a slicer's own options
 * (each slicer's available values are constrained by every OTHER active slicer, not itself).
 */
export function applyFactFilters<Q>(query: Q, f: Filters, except?: keyof Filters): Q {
  let q: any = query;
  for (const k of FILTER_KEYS) {
    if (k === except) continue;
    const v = f[k];
    if (!v) continue;
    if (k === "dateFrom") { q = q.gte("sale_date", v); continue; } // range start
    if (k === "dateTo") { q = q.lte("sale_date", v); continue; } // range end
    const { col, coerce } = FILTER_COLUMN[k];
    q = q.eq(col, coerce ? coerce(v) : v);
  }
  return q;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface FilterOptions {
  fiscalYears: string[];
  reps: string[];
  brands: string[];
  customers: { code: string; name: string }[];
  products: string[];
  skus: string[];
  weeks: string[];
  dates: string[];
}

/** Distinct values for the filter controls, scoped to the active fiscal year. */
export async function getFilterOptions(supabase: SupabaseClient, fy: string): Promise<FilterOptions> {
  const [fyRes, repRes, brandRes, custRes, prodRes, weekRes] = await Promise.all([
    supabase.from("v_month_totals").select("fiscal_year").order("fiscal_year"),
    supabase.from("v_sales_by_rep").select("sales_representative").eq("fiscal_year", fy),
    supabase.from("v_sales_by_brand").select("brand").eq("fiscal_year", fy).order("sales_amount", { ascending: false }),
    supabase.from("v_sales_by_customer").select("customer_code, customer_name").eq("fiscal_year", fy).order("sales_amount", { ascending: false }).limit(500),
    supabase.from("v_sales_by_product").select("product, sku").eq("fiscal_year", fy).order("sales_amount", { ascending: false }).limit(800),
    supabase.from("v_sales_fact").select("week_start, sale_date").eq("fiscal_year", fy).order("sale_date").limit(8000),
  ]);
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))];
  const toISO = (v: unknown) => (v ? String(v).slice(0, 10) : null);
  return {
    fiscalYears: uniq((fyRes.data ?? []).map((r) => r.fiscal_year as string)).sort().reverse(),
    reps: uniq((repRes.data ?? []).map((r) => r.sales_representative as string)).sort(),
    brands: uniq((brandRes.data ?? []).map((r) => r.brand as string)),
    customers: (custRes.data ?? [])
      .filter((r) => r.customer_code)
      .map((r) => ({ code: r.customer_code as string, name: (r.customer_name as string) || (r.customer_code as string) })),
    products: uniq((prodRes.data ?? []).map((r) => r.product as string)).slice(0, 400),
    skus: uniq((prodRes.data ?? []).map((r) => r.sku as string)).slice(0, 400),
    weeks: uniq((weekRes.data ?? []).map((r) => toISO(r.week_start))).sort(),
    dates: uniq((weekRes.data ?? []).map((r) => toISO(r.sale_date))).sort(),
  };
}
