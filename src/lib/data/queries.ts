// Server-side data access for the Vantage dashboards.
// Reads the Supabase analytics views and computes Power BI-faithful measures:
//   - Total Sales            = SUM(sales.amount)
//   - YTD Target (aligned)   = SUM(monthly target) over fiscal months that have actual sales
//   - Achievement %          = Sales / YTD Target
//   - Growth vs LY %         = (Sales - LY Sales) / LY Sales   (null until prior-year sales exist)
// Fiscal year is March->February, labelled FY<startYear> (FY2026 = Mar 2026..Feb 2027).

import { createClient } from "@/lib/supabase/server";
import type { Filters } from "@/lib/filters";
import { salesKpis, salesAgg, salesByDimMonth, targetByDimMonth, salesDaily, prevYtdAlignedBy } from "@/lib/data/agg";

/** rep/brand/month subset of the filters as a jsonb payload for the target RPCs. */
function targetFilterJson(f: Filters): Record<string, string> {
  const o: Record<string, string> = {};
  if (f.rep) o.rep = f.rep;
  if (f.brand) o.brand = f.brand;
  if (f.month) o.month = f.month;
  return o;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Default fiscal-year start month (1=Jan .. 12=Dec). KRDM = March (3). Overridable in Settings. */
export const DEFAULT_FISCAL_START = 3;

export const MONTH_OPTIONS = MONTH_SHORT.map((_, i) => ({
  value: i + 1,
  label: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][i],
}));

/** The 12 fiscal-month short labels for a start month (start month first). */
export function fiscalMonths(startMonth: number = DEFAULT_FISCAL_START): string[] {
  return Array.from({ length: 12 }, (_, i) => MONTH_SHORT[(startMonth - 1 + i) % 12]);
}

export const FISCAL_MONTHS = fiscalMonths();

/** Label for a fiscal month index (1..12) given the fiscal-year start month. */
export function fiscalMonthLabel(fiscalMonth: number, startMonth: number = DEFAULT_FISCAL_START): string {
  return MONTH_SHORT[(startMonth - 1 + (fiscalMonth - 1)) % 12] ?? String(fiscalMonth);
}

/** "FY2026" -> "2026-2027" (the label the Power BI report shows). */
export function fiscalYearLabel(fy: string): string {
  const start = Number(fy.replace(/\D/g, ""));
  return Number.isFinite(start) ? `${start}-${start + 1}` : fy;
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));

export interface MonthTotal {
  fiscal_month: number;
  label: string;
  sales_amount: number;
  target_amount: number;
  quantity: number;
}
export interface RepRow {
  sales_representative: string;
  sales_amount: number;
  target_amount: number; // YTD-aligned
  quantity: number;
  achievement: number | null;
}
export interface RankRow {
  name: string;
  sales_amount: number;
  quantity: number;
  secondary?: string;
}
export interface CustomerRow {
  customer_code: string | null;
  customer_name: string | null;
  sales_amount: number;
  quantity: number;
}

export interface ExecutiveData {
  fiscalYear: string;
  fiscalYearLabel: string;
  asOf: string | null;
  periodStart: string | null;
  kpis: {
    ytd_sales: number;
    ytd_target: number;
    achievement: number | null;
    target_gap: number;
    yoy_growth: number | null;
    ly_sales: number | null;
    customer_count: number;
    mtd_sales: number;
  };
  reps: RepRow[];
  brands: RankRow[];
  products: RankRow[];
  customers: CustomerRow[];
  monthly: MonthTotal[];
  daily: { date: string; sales: number }[];
  hasData: boolean;
}

async function sb() {
  return createClient();
}

export interface ForecastInfo {
  byMonthBizDays: Map<number, number>;
  bizDaysTotal: number;
  bizDaysElapsed: number;
}
/**
 * Business-day run-rate inputs for a precise FY-end projection (holiday-aware via the calendar).
 * projected_FY = ytd_sales / bizDaysElapsed × bizDaysTotal; future months scale by their business days.
 */
export async function getForecast(fy: string, asOf: string | null): Promise<ForecastInfo> {
  const supabase = await sb();
  const [{ data: bd }, { data: cal }] = await Promise.all([
    supabase.from("v_calendar_month_bizdays").select("fiscal_month, business_days").eq("fiscal_year", fy),
    supabase.from("calendar").select("date, is_business_day").eq("fiscal_year", fy),
  ]);
  const byMonthBizDays = new Map<number, number>();
  let bizDaysTotal = 0;
  for (const r of (bd ?? []) as { fiscal_month: number; business_days: number }[]) {
    byMonthBizDays.set(Number(r.fiscal_month), Number(r.business_days));
    bizDaysTotal += Number(r.business_days);
  }
  let bizDaysElapsed = 0;
  for (const r of (cal ?? []) as { date: string; is_business_day: boolean }[]) {
    if (r.is_business_day && (!asOf || String(r.date) <= asOf)) bizDaysElapsed += 1;
  }
  return { byMonthBizDays, bizDaysTotal, bizDaysElapsed };
}

/** Latest fiscal year that has actual sales (fallback FY2026). */
export async function getActiveFiscalYear(): Promise<string> {
  const supabase = await sb();
  const { data } = await supabase
    .from("v_month_totals")
    .select("fiscal_year, sales_amount")
    .gt("sales_amount", 0)
    .order("fiscal_year", { ascending: false })
    .limit(1);
  return data?.[0]?.fiscal_year ?? "FY2026";
}

/** Configured fiscal-year start month (1..12). Defaults to March if unset. */
export async function getFiscalStartMonth(): Promise<number> {
  const supabase = await sb();
  const { data } = await supabase
    .from("app_settings")
    .select("fiscal_year_start_month")
    .eq("id", 1)
    .maybeSingle();
  return data?.fiscal_year_start_month ?? DEFAULT_FISCAL_START;
}

export async function getMonthTotals(fy: string, startMonth: number = DEFAULT_FISCAL_START): Promise<MonthTotal[]> {
  const supabase = await sb();
  const { data } = await supabase
    .from("v_month_totals")
    .select("fiscal_month, sales_amount, target_amount, quantity")
    .eq("fiscal_year", fy)
    .order("fiscal_month");
  return (data ?? []).map((r) => ({
    fiscal_month: n(r.fiscal_month),
    label: fiscalMonthLabel(n(r.fiscal_month), startMonth),
    sales_amount: n(r.sales_amount),
    target_amount: n(r.target_amount),
    quantity: n(r.quantity),
  }));
}

export async function getReps(fy: string, alignedMonths: Set<number>): Promise<RepRow[]> {
  const supabase = await sb();
  const { data } = await supabase
    .from("v_rep_month")
    .select("sales_representative, fiscal_month, sales_amount, target_amount, quantity")
    .eq("fiscal_year", fy);
  const asOf =
    (await supabase
      .from("v_sales_fact")
      .select("sale_date")
      .eq("fiscal_year", fy)
      .order("sale_date", { ascending: false })
      .limit(1)).data?.[0]?.sale_date ?? null;

  // Working-day prorated per-rep YTD target (PBI ACHIEVE R 100% denominator): completed fiscal
  // months in full + current month prorated to the last sale date. ytd_target_aligned_by()
  // (migration 20260610000200). Falls back to the month-aligned sum if the RPC is unavailable.
  const repTarget = new Map<string, number>();
  if (asOf) {
    const { data: tg } = await supabase.rpc("ytd_target_aligned_by", { p_fy: fy, p_asof: asOf, p_dim: "rep" });
    for (const r of (tg ?? []) as { key: string; target: number }[]) repTarget.set(r.key, n(r.target));
  }

  const map = new Map<string, RepRow & { _alignedTarget: number }>();
  for (const r of data ?? []) {
    const rep = r.sales_representative ?? "Unassigned";
    const entry = map.get(rep) ?? {
      sales_representative: rep,
      sales_amount: 0,
      target_amount: 0,
      quantity: 0,
      achievement: null,
      _alignedTarget: 0,
    };
    entry.sales_amount += n(r.sales_amount);
    entry.quantity += n(r.quantity);
    // fallback target: months that have actual sales (used only if the prorated RPC is unavailable)
    if (alignedMonths.has(n(r.fiscal_month))) entry._alignedTarget += n(r.target_amount);
    map.set(rep, entry);
  }
  const rows = [...map.values()].map(({ _alignedTarget, ...r }) => {
    const target_amount = repTarget.get(r.sales_representative) ?? _alignedTarget;
    return { ...r, target_amount, achievement: target_amount > 0 ? r.sales_amount / target_amount : null };
  });
  return rows.sort((a, b) => b.sales_amount - a.sales_amount);
}

export async function getBrandSales(fy: string): Promise<RankRow[]> {
  const supabase = await sb();
  const { data } = await supabase
    .from("v_sales_by_brand")
    .select("brand, sales_amount, quantity")
    .eq("fiscal_year", fy)
    .order("sales_amount", { ascending: false });
  return (data ?? [])
    .filter((r) => r.brand)
    .map((r) => ({ name: r.brand as string, sales_amount: n(r.sales_amount), quantity: n(r.quantity) }));
}

export async function getProductSales(fy: string): Promise<RankRow[]> {
  const supabase = await sb();
  const { data } = await supabase
    .from("v_sales_by_product")
    .select("product, brand, sales_amount, quantity")
    .eq("fiscal_year", fy)
    .order("sales_amount", { ascending: false })
    .limit(60);
  return (data ?? [])
    .filter((r) => r.product)
    .map((r) => ({
      name: r.product as string,
      secondary: (r.brand as string) ?? undefined,
      sales_amount: n(r.sales_amount),
      quantity: n(r.quantity),
    }));
}

export async function getCustomerSales(fy: string): Promise<CustomerRow[]> {
  const supabase = await sb();
  const { data } = await supabase
    .from("v_sales_by_customer")
    .select("customer_code, customer_name, sales_amount, quantity")
    .eq("fiscal_year", fy)
    .order("sales_amount", { ascending: false });
  return (data ?? []).map((r) => ({
    customer_code: (r.customer_code as string) ?? null,
    customer_name: (r.customer_name as string) ?? null,
    sales_amount: n(r.sales_amount),
    quantity: n(r.quantity),
  }));
}

export async function getMaxSaleDate(): Promise<string | null> {
  const supabase = await sb();
  const { data } = await supabase
    .from("v_sales_fact")
    .select("sale_date")
    .order("sale_date", { ascending: false })
    .limit(1);
  return data?.[0]?.sale_date ?? null;
}

/** Live "Data as of <date>" label (PBI LatestReportData), scoped to a fiscal year if given. */
export async function getAsOfLabel(fy?: string): Promise<string> {
  const supabase = await sb();
  let q = supabase.from("v_sales_fact").select("sale_date").order("sale_date", { ascending: false }).limit(1);
  if (fy) q = q.eq("fiscal_year", fy);
  const { data } = await q;
  const iso = data?.[0]?.sale_date as string | undefined;
  if (!iso) return "No data yet";
  const d = new Date(iso + "T00:00:00");
  return `Data as of ${d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}`;
}

export async function getExecutiveData(fy: string, filters: Filters = {}): Promise<ExecutiveData> {
  const startMonth = await getFiscalStartMonth();
  const supabase = await sb();

  // Everything filter-aware via the SQL-aggregation RPCs (small result sets, immune to the 1000-row cap).
  const [kpi, repSales, repTgt, brandAgg, productAgg, custAgg, daily, monthMeta] = await Promise.all([
    salesKpis(supabase, fy, filters),
    salesByDimMonth(supabase, fy, "sales_representative", filters),
    targetByDimMonth(supabase, fy, "sales_representative", filters),
    salesAgg(supabase, fy, "brand", filters),
    salesAgg(supabase, fy, "product", filters),
    salesAgg(supabase, fy, "customer_name", filters),
    salesDaily(supabase, fy, filters),
    getMonthTotals(fy, startMonth), // month order + labels (fiscal months that exist in the FY)
  ]);

  const asOf = daily.length ? daily[daily.length - 1].sale_date : null;
  const firstSale = daily.length ? daily[0].sale_date : null;

  // Per-month sales/qty (filtered) from rep×month; per-month target (filtered) from rep target.
  const salesByMonth = new Map<number, number>();
  const qtyByMonth = new Map<number, number>();
  for (const r of repSales) {
    salesByMonth.set(r.fiscal_month, (salesByMonth.get(r.fiscal_month) ?? 0) + r.sales);
    qtyByMonth.set(r.fiscal_month, (qtyByMonth.get(r.fiscal_month) ?? 0) + r.quantity);
  }
  const tgtByMonth = new Map<number, number>();
  for (const t of repTgt) tgtByMonth.set(t.fiscal_month, (tgtByMonth.get(t.fiscal_month) ?? 0) + t.target);

  const monthly: MonthTotal[] = monthMeta.map((m) => ({
    fiscal_month: m.fiscal_month,
    label: fiscalMonthLabel(m.fiscal_month, startMonth),
    sales_amount: salesByMonth.get(m.fiscal_month) ?? 0,
    target_amount: tgtByMonth.get(m.fiscal_month) ?? 0,
    quantity: qtyByMonth.get(m.fiscal_month) ?? 0,
  }));
  const aligned = new Set([...salesByMonth.entries()].filter(([, v]) => v > 0).map(([fm]) => fm));

  const ytd_sales = kpi.sales;
  // Working-day prorated YTD target for the FILTERED scope (rep/brand/month slicers apply).
  let ytd_target = [...tgtByMonth.entries()].filter(([fm]) => aligned.has(fm)).reduce((a, [, v]) => a + v, 0);
  if (asOf) {
    const { data: ft } = await supabase.rpc("ytd_target_aligned_filtered", {
      p_fy: fy, p_asof: asOf, p_filters: targetFilterJson(filters),
    });
    if (typeof ft === "number" && ft > 0) ytd_target = ft;
  }

  // Per-rep: sales (filtered) + working-day prorated rep target (PBI ACHIEVE R 100%).
  const repAgg = new Map<string, { sales: number; qty: number }>();
  for (const r of repSales) {
    const e = repAgg.get(r.dim) ?? { sales: 0, qty: 0 };
    e.sales += r.sales;
    e.qty += r.quantity;
    repAgg.set(r.dim, e);
  }
  const repProrated = new Map<string, number>();
  if (asOf) {
    const { data: tg } = await supabase.rpc("ytd_target_aligned_by", { p_fy: fy, p_asof: asOf, p_dim: "rep" });
    for (const r of (tg ?? []) as { key: string; target: number }[]) repProrated.set(r.key, n(r.target));
  }
  const reps: RepRow[] = [...repAgg.entries()]
    .map(([rep, v]) => {
      const target_amount = repProrated.get(rep) ?? (aligned.size ? 0 : 0);
      return { sales_representative: rep, sales_amount: v.sales, quantity: v.qty, target_amount, achievement: target_amount > 0 ? v.sales / target_amount : null };
    })
    .filter((r) => r.sales_amount !== 0 || r.target_amount !== 0)
    .sort((a, b) => b.sales_amount - a.sales_amount);

  const brands: RankRow[] = brandAgg.filter((b) => b.dim).map((b) => ({ name: b.dim, sales_amount: b.sales, quantity: b.quantity }));
  const products: RankRow[] = productAgg.filter((p) => p.dim).map((p) => ({ name: p.dim, sales_amount: p.sales, quantity: p.quantity }));
  const customers: CustomerRow[] = custAgg.filter((c) => c.dim).map((c) => ({ customer_code: null, customer_name: c.dim, sales_amount: c.sales, quantity: c.quantity }));

  const lastMonth = Math.max(0, ...[...aligned]);
  const mtd_sales = salesByMonth.get(lastMonth) ?? 0;
  // PBI "Previous YTD Aligned" (day-aligned prior-FY window), filter-aware. Null if no prior-year data.
  const lyRows = asOf ? await prevYtdAlignedBy(supabase, fy, asOf, "sales_representative", filters) : [];
  const lyTotal = lyRows.reduce((a, r) => a + r.sales, 0);
  const lySales = lyTotal > 0 ? lyTotal : null;

  return {
    fiscalYear: fy,
    fiscalYearLabel: fiscalYearLabel(fy),
    asOf,
    periodStart: firstSale,
    kpis: {
      ytd_sales,
      ytd_target,
      achievement: ytd_target > 0 ? ytd_sales / ytd_target : null,
      target_gap: ytd_sales - ytd_target,
      ly_sales: lySales,
      yoy_growth: lySales && lySales > 0 ? (ytd_sales - lySales) / lySales : null,
      customer_count: kpi.customers,
      mtd_sales,
    },
    reps,
    brands,
    products,
    customers,
    monthly,
    daily: daily.map((d) => ({ date: d.sale_date, sales: d.sales })),
    hasData: ytd_sales !== 0,
  };
}

/** Pareto: cumulative share of total, descending. Returns rows with cumulative ratio + in-threshold flag. */
export function withPareto<T extends { sales_amount: number }>(
  rows: T[],
  threshold = 0.8,
): (T & { cumulative: number; inThreshold: boolean })[] {
  const total = rows.reduce((a, r) => a + Math.max(0, r.sales_amount), 0) || 1;
  let run = 0;
  return rows.map((r) => {
    run += Math.max(0, r.sales_amount);
    const cumulative = run / total;
    return { ...r, cumulative, inThreshold: cumulative - r.sales_amount / total < threshold };
  });
}
