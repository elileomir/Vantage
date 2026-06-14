// Page-specific data composition for the Daily Tracking page (PBI page [9] "Daily").
// Composes the existing filter-aware aggregation API (salesDaily / salesAgg / targetByDimMonth)
// plus the working-day calendar views into the exact shapes the ECharts wrappers + tables need.
// No new RPCs. PBI measures computed in JS:
//   _SUM_AMOUNT        = SUM(amount) per day / brand / customer / product
//   DAILY_TARGET       = monthly target ÷ business-days-in-month, charged only on business days (0 otherwise)
//   ACCUM_DAILY_SALES  = running total of daily sales
//   ACCUM_DAILY_TARGET = running total of daily target
//   DAILY_ACHIEVEMENT  = daily sales ÷ daily target
//   _SUM_TAX / _SUM_TOTAL = SUM(tax) / SUM(total)
//   QUANTITY           = SUM(quantity)

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Filters } from "@/lib/filters";
import { salesDaily, salesAgg, targetByDimMonth, fetchAllFacts } from "@/lib/data/agg";

export interface DailyPoint {
  date: string; // ISO yyyy-mm-dd
  sales: number; // _SUM_AMOUNT
  dailyTarget: number; // DAILY_TARGET (0 on non-business days)
  accumSales: number; // ACCUM_DAILY_SALES
  accumTarget: number; // ACCUM_DAILY_TARGET
  achievement: number | null; // DAILY_ACHIEVEMENT
  quantity: number;
  lines: number;
}

export interface BrandSlice {
  name: string;
  sales: number;
}

export interface CustomerDetailRow {
  customer: string;
  rep: string;
  sales: number; // _SUM_AMOUNT
  tax: number; // _SUM_TAX
  total: number; // _SUM_TOTAL
}

export interface ProductDetailRow {
  product: string;
  brand: string;
  sku: string;
  rep: string;
  sales: number; // _SUM_AMOUNT
  quantity: number; // QUANTITY
}

export interface DailyPageData {
  hasData: boolean;
  /** _SUM_AMOUNT for the whole (filtered) period — the Month Total card. */
  monthTotal: number;
  /** Working-day daily target accrued over the period (sum of DAILY_TARGET on sale days). */
  totalDailyTarget: number;
  /** Per-day series with daily target, running totals and achievement. */
  daily: DailyPoint[];
  /** _SUM_AMOUNT by Brand (pie + brand detail table). */
  brands: BrandSlice[];
  /** Customer × _SUM_AMOUNT + _SUM_TAX + _SUM_TOTAL + rep (detail table). */
  customers: CustomerDetailRow[];
  /** Product × _SUM_AMOUNT + QUANTITY (+ brand / sku / rep) detail table. */
  products: ProductDetailRow[];
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));

/**
 * Filter-aware DAILY_TARGET: the monthly target (after rep/brand/month slicers) spread evenly over
 * the month's business days, charged only on business days. Mirrors PBI DAILY_TARGET at the active
 * scope. Returns a map of ISO date -> daily target for every business day in the FY.
 */
async function buildDailyTargetByDate(
  supabase: SupabaseClient,
  fy: string,
  filters: Filters,
): Promise<Map<string, number>> {
  const [repTgt, { data: bizRows }, { data: calRows }] = await Promise.all([
    // Monthly target after the rep/brand/month slicers (sum across reps for the filtered scope).
    targetByDimMonth(supabase, fy, "sales_representative", filters),
    supabase
      .from("v_calendar_month_bizdays")
      .select("fiscal_month, business_days")
      .eq("fiscal_year", fy),
    supabase
      .from("calendar")
      .select("date, fiscal_month, is_business_day")
      .eq("fiscal_year", fy),
  ]);

  // Monthly target after filters, summed per fiscal month.
  const targetByMonth = new Map<number, number>();
  for (const t of repTgt) {
    targetByMonth.set(t.fiscal_month, (targetByMonth.get(t.fiscal_month) ?? 0) + t.target);
  }
  const bizByMonth = new Map<number, number>();
  for (const r of (bizRows ?? []) as { fiscal_month: number; business_days: number }[]) {
    bizByMonth.set(n(r.fiscal_month), n(r.business_days));
  }

  const byDate = new Map<string, number>();
  for (const r of (calRows ?? []) as { date: string; fiscal_month: number; is_business_day: boolean }[]) {
    if (!r.is_business_day) continue;
    const fm = n(r.fiscal_month);
    const biz = bizByMonth.get(fm) ?? 0;
    const monthTarget = targetByMonth.get(fm) ?? 0;
    if (biz > 0) byDate.set(String(r.date).slice(0, 10), monthTarget / biz);
  }
  return byDate;
}

// ── Daily Sales Tracker (current-month, working-day target spread) ──────────
export interface DailyTrackerPoint {
  date: string;
  sales: number;
  target: number; // working-day target (0 on weekends/holidays)
  runningSales: number;
  runningTarget: number;
}
export interface DailyTrackerData {
  hasData: boolean;
  monthLabel: string; // e.g. "June"
  points: DailyTrackerPoint[];
  mtd: { sales: number; target: number; pct: number | null };
  currentDay: { date: string; sales: number; target: number; pct: number | null } | null;
}

const monthName = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", { month: "long" });
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * The Daily "Sales Tracker": the latest data month, one point per CALENDAR day. Target is the
 * (filtered) monthly target spread over the month's business days, charged only on business days
 * (weekends + SA public holidays excluded via calendar.is_business_day). MTD = month sales vs full
 * month target; Current Day = today's (or the latest day's) sales vs that day's target.
 */
export async function getDailyTracker(
  supabase: SupabaseClient,
  fy: string,
  filters: Filters,
): Promise<DailyTrackerData> {
  const empty: DailyTrackerData = { hasData: false, monthLabel: "", points: [], mtd: { sales: 0, target: 0, pct: null }, currentDay: null };

  const asOf = (await supabase
    .from("v_sales_fact").select("sale_date").eq("fiscal_year", fy)
    .order("sale_date", { ascending: false }).limit(1)).data?.[0]?.sale_date as string | undefined;
  if (!asOf) return empty;

  const [repTgt, { data: bizRows }, { data: calRows }, dailyRows] = await Promise.all([
    targetByDimMonth(supabase, fy, "sales_representative", filters),
    supabase.from("v_calendar_month_bizdays").select("fiscal_month, business_days").eq("fiscal_year", fy),
    supabase.from("calendar").select("date, fiscal_month, is_business_day").eq("fiscal_year", fy),
    salesDaily(supabase, fy, filters),
  ]);

  const cal = (calRows ?? []) as { date: string; fiscal_month: number; is_business_day: boolean }[];
  const asOfRow = cal.find((r) => String(r.date).slice(0, 10) === asOf);
  const fm = asOfRow ? n(asOfRow.fiscal_month) : (cal.length ? n(cal[cal.length - 1].fiscal_month) : 0);

  // Monthly target (filtered) + business-day count for this fiscal month.
  const monthTarget = repTgt.filter((t) => t.fiscal_month === fm).reduce((a, t) => a + t.target, 0);
  const bizDays = ((bizRows ?? []) as { fiscal_month: number; business_days: number }[]).find((r) => n(r.fiscal_month) === fm)?.business_days ?? 0;
  const dailyTargetVal = bizDays > 0 ? monthTarget / bizDays : 0;

  const salesByDate = new Map<string, number>();
  for (const d of dailyRows) salesByDate.set(d.sale_date, d.sales);

  const monthDays = cal
    .filter((r) => n(r.fiscal_month) === fm)
    .map((r) => ({ date: String(r.date).slice(0, 10), biz: !!r.is_business_day }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (monthDays.length === 0) return empty;

  let runS = 0, runT = 0;
  const points: DailyTrackerPoint[] = monthDays.map((r) => {
    const sales = salesByDate.get(r.date) ?? 0;
    const target = r.biz ? dailyTargetVal : 0;
    runS += sales; runT += target;
    return { date: r.date, sales, target, runningSales: runS, runningTarget: runT };
  });

  const mtdSales = points.reduce((a, p) => a + p.sales, 0);
  const mtd = { sales: mtdSales, target: monthTarget, pct: monthTarget > 0 ? mtdSales / monthTarget : null };

  // Current day = the most recent day up to today that is a business day or had sales
  // (so weekends/holidays don't surface a R0-target "current day"); falls back to the latest data day.
  const today = todayIso();
  const candidates = points.filter((p) => p.date <= today && (p.target > 0 || p.sales !== 0));
  const cur = candidates.length ? candidates[candidates.length - 1] : (points.find((p) => p.date === asOf) ?? null);
  const currentDay = cur ? { date: cur.date, sales: cur.sales, target: cur.target, pct: cur.target > 0 ? cur.sales / cur.target : null } : null;

  return { hasData: true, monthLabel: monthName(asOf), points, mtd, currentDay };
}

export async function getDailyPageData(
  supabase: SupabaseClient,
  fy: string,
  filters: Filters,
): Promise<DailyPageData> {
  // Line-level detail for the customer / product tables (tax, total, sku, rep are not in the agg RPCs).
  // Paged past PostgREST's 1000-row cap so the detail aggregations are complete (not truncated).
  const [dailyRows, brandAgg, targetByDate, factRows] = await Promise.all([
    salesDaily(supabase, fy, filters),
    salesAgg(supabase, fy, "brand", filters),
    buildDailyTargetByDate(supabase, fy, filters),
    fetchAllFacts(supabase, {
      columns: "sales_representative, customer_name, customer_code, brand, product, sku, amount, tax, total, quantity",
      fiscalYear: fy,
      filters,
    }),
  ]);

  // ── Daily series with DAILY_TARGET + running totals + achievement ──────────
  let accumSales = 0;
  let accumTarget = 0;
  let totalDailyTarget = 0;
  const daily: DailyPoint[] = dailyRows.map((d) => {
    const dt = targetByDate.get(d.sale_date) ?? 0;
    accumSales += d.sales;
    accumTarget += dt;
    totalDailyTarget += dt;
    return {
      date: d.sale_date,
      sales: d.sales,
      dailyTarget: dt,
      accumSales,
      accumTarget,
      achievement: dt > 0 ? d.sales / dt : null,
      quantity: d.quantity,
      lines: d.lines,
    };
  });
  const monthTotal = daily.reduce((a, d) => a + d.sales, 0);

  const brands: BrandSlice[] = brandAgg
    .filter((b) => b.dim)
    .map((b) => ({ name: b.dim, sales: b.sales }));

  // ── Customer / product detail aggregation from line-level rows ─────────────
  type CustAcc = { customer: string; rep: string; sales: number; tax: number; total: number };
  type ProdAcc = { product: string; brand: string; sku: string; rep: string; sales: number; quantity: number };
  const custMap = new Map<string, CustAcc>();
  const prodMap = new Map<string, ProdAcc>();

  for (const r of factRows as Record<string, unknown>[]) {
    const customer = String(r.customer_name ?? r.customer_code ?? "Unknown");
    const rep = String(r.sales_representative ?? "Unassigned");
    const brand = String(r.brand ?? "Unknown");
    const product = String(r.product ?? "Unknown");
    const sku = String(r.sku ?? "");
    const amount = n(r.amount);
    const tax = n(r.tax);
    const total = n(r.total);
    const quantity = n(r.quantity);

    const ck = `${customer}|${rep}`;
    const c = custMap.get(ck) ?? { customer, rep, sales: 0, tax: 0, total: 0 };
    c.sales += amount;
    c.tax += tax;
    c.total += total;
    custMap.set(ck, c);

    const pk = `${product}|${sku}|${brand}|${rep}`;
    const p = prodMap.get(pk) ?? { product, brand, sku, rep, sales: 0, quantity: 0 };
    p.sales += amount;
    p.quantity += quantity;
    prodMap.set(pk, p);
  }

  const customers: CustomerDetailRow[] = [...custMap.values()].sort((a, b) => b.sales - a.sales);
  const products: ProductDetailRow[] = [...prodMap.values()].sort((a, b) => b.sales - a.sales);

  const hasData = monthTotal !== 0 || daily.length > 0 || brands.length > 0;

  return {
    hasData,
    monthTotal,
    totalDailyTarget,
    daily,
    brands,
    customers,
    products,
  };
}
