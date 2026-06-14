import type { SupabaseClient } from "@supabase/supabase-js";
import type { Filters } from "@/lib/filters";

export interface SlicerOption {
  value: string;
  label: string;
  n: number;
}
export interface SlicerOptions {
  rep: SlicerOption[];
  brand: SlicerOption[];
  customer: SlicerOption[];
  product: SlicerOption[];
  sku: SlicerOption[];
  quarter: SlicerOption[];
  month: SlicerOption[];
  invoice: SlicerOption[];
  fiscalYears: string[];
}

const EMPTY = (): Omit<SlicerOptions, "fiscalYears"> => ({
  rep: [], brand: [], customer: [], product: [], sku: [], quarter: [], month: [], invoice: [],
});

/**
 * Cross-filtered slicer options: each slicer's available values are computed against
 * every OTHER active slicer (not itself), via the slicer_options(jsonb) RPC. This is the
 * Power BI "each slicer filters each slicer" behavior. `fiscalYears` is global (the period picker).
 */
export async function getSlicerOptions(supabase: SupabaseClient, filters: Filters): Promise<SlicerOptions> {
  // Pass only the line-level filters to the RPC (fy scopes inside it).
  const p_filters: Record<string, string> = {};
  for (const k of ["fy", "rep", "brand", "customer", "quarter", "month", "weekStart", "date", "product", "sku", "invoice"] as const) {
    if (filters[k]) p_filters[k] = filters[k] as string;
  }
  const [{ data: rows }, { data: fyRows }] = await Promise.all([
    supabase.rpc("slicer_options", { p_filters }),
    supabase.from("v_month_totals").select("fiscal_year"),
  ]);

  const out: SlicerOptions = { ...EMPTY(), fiscalYears: [] };
  for (const r of (rows ?? []) as { dim: keyof ReturnType<typeof EMPTY>; value: string; label: string; n: number }[]) {
    if (r.value == null) continue;
    (out[r.dim] as SlicerOption[]).push({ value: String(r.value), label: r.label ?? String(r.value), n: Number(r.n) });
  }
  // Order each list by descending row count (most relevant first), except month/quarter (natural order).
  for (const k of ["rep", "brand", "customer", "product", "sku", "invoice"] as const) {
    out[k].sort((a, b) => b.n - a.n);
  }
  out.product = out.product.slice(0, 500);
  out.sku = out.sku.slice(0, 500);
  out.month.sort((a, b) => Number(a.value) - Number(b.value));
  out.quarter.sort((a, b) => a.value.localeCompare(b.value));
  out.fiscalYears = [...new Set((fyRows ?? []).map((r) => r.fiscal_year as string).filter(Boolean))].sort().reverse();
  return out;
}
