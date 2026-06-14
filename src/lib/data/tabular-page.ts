// Page-specific data composition for the Tabular Summary page (PBI page 5).
// Composes the existing filter-aware aggregation API (salesByDimMonth / targetByDimMonth /
// salesByTwoDims) plus a bounded fact query for the rep×customer×brand RIO'S VIEW detail.
// No new RPCs — everything is shaped in JS into the MatrixRow/{columns,rows} format.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Filters } from "@/lib/filters";
import { salesByDimMonth, targetByDimMonth, salesByTwoDims, type DimMonthRow, type TargetMonthRow } from "@/lib/data/agg";
import { fiscalMonthLabel } from "@/lib/data/queries";

const n = (v: unknown): number => (v == null ? 0 : Number(v));

/** Fiscal month (1-based within the fiscal year) -> quarter index (1..4). */
export const quarterOf = (fiscalMonth: number): number => Math.floor((fiscalMonth - 1) / 3) + 1;

export interface QuarterGroup {
  quarter: number;
  fms: number[];
}

export interface MeasureCell {
  sales: number;
  target: number;
  quantity: number;
}

/** A pivot row: name + per-fiscal-month measures + a row total. */
export interface PivotRowData {
  name: string;
  byMonth: Map<number, MeasureCell>;
  total: MeasureCell;
}

function emptyCell(): MeasureCell {
  return { sales: 0, target: 0, quantity: 0 };
}

/** Pivot flat rows (name × fiscal_month with sales/qty/target) into name -> month -> cell. */
function pivot(rows: { name: string; fiscal_month: number; sales: number; quantity: number; target: number }[]): PivotRowData[] {
  const map = new Map<string, PivotRowData>();
  for (const r of rows) {
    const entry = map.get(r.name) ?? ({ name: r.name, byMonth: new Map(), total: emptyCell() } as PivotRowData);
    const cell = entry.byMonth.get(r.fiscal_month) ?? emptyCell();
    cell.sales += r.sales;
    cell.quantity += r.quantity;
    cell.target += r.target;
    entry.byMonth.set(r.fiscal_month, cell);
    entry.total.sales += r.sales;
    entry.total.quantity += r.quantity;
    entry.total.target += r.target;
    map.set(r.name, entry);
  }
  return [...map.values()];
}

/** Sum a set of pivot rows' column for a given fiscal month. */
export function colTotal(rows: PivotRowData[], fm: number): MeasureCell {
  return rows.reduce((acc, r) => {
    const c = r.byMonth.get(fm);
    if (c) {
      acc.sales += c.sales;
      acc.target += c.target;
      acc.quantity += c.quantity;
    }
    return acc;
  }, emptyCell());
}

function grandTotal(rows: PivotRowData[]): MeasureCell {
  return rows.reduce((acc, r) => {
    acc.sales += r.total.sales;
    acc.target += r.total.target;
    acc.quantity += r.total.quantity;
    return acc;
  }, emptyCell());
}

// ── Fiscal-year achievement (TARGET_ACHIEVEMENT / YTD_TARGET_ACHIEVEMENT) ──
export interface MonthAchievementRow {
  fiscalMonth: number;
  quarter: number;
  label: string;
  sales: number;
  target: number;
  achievement: number | null; // TARGET_ACHIEVEMENT (monthly)
  ytdAchievement: number | null; // YTD_TARGET_ACHIEVEMENT (cumulative, prorated last month)
  dailyTargetYtd: number; // DAILY_TARGET_YTD_GLOBAL (prorated YTD target up to this month)
}

// ── RIO'S VIEW types ──
export interface DailyCust {
  customer: string;
  sales: number;
  target: number;
}
export interface DailyRep {
  rep: string;
  customers: DailyCust[];
  sales: number;
  target: number;
}
export interface DailyDate {
  date: string;
  label: string;
  reps: DailyRep[];
  sales: number;
  target: number;
}
export interface DailyMonth {
  fiscalMonth: number;
  label: string;
  dates: DailyDate[];
  sales: number;
  target: number;
}

export interface RepBehindGroup {
  rep: string;
  rows: { customer: string; sales: number; target: number; behind: number }[];
}

export interface TabularPageData {
  hasData: boolean;
  startMonth: number;
  salesMonths: number[];
  quarterGroups: QuarterGroup[];
  /** A quarter sub-total column is meaningful only when the quarter spans >1 month. */
  multiMonthQuarters: Set<number>;
  /** Sales & Target per Fiscal Year (Month, Sales | YTD Target | YTD %). */
  monthAchievement: MonthAchievementRow[];
  monthAchievementTotal: { sales: number; target: number; ytdTarget: number };
  /** Sales by Brands & Products (Brand → Product, Sales | Quantity). */
  brandProduct: PivotRowData[];
  brandProductGrand: MeasureCell;
  brandProductChildren: Map<string, PivotRowData[]>; // brand -> product rows
  /** Sales by Representative (Sales | Quantity per month + total). */
  reps: PivotRowData[];
  repsGrand: MeasureCell;
  /** Sales & Target by Representative (Sales | Target | Behind). */
  repsST: PivotRowData[];
  repsSTGrand: MeasureCell;
  /** RIO'S VIEW — Daily Sales & Target by Representative. */
  dailyMonths: DailyMonth[];
  dailyGrand: { sales: number; target: number };
  /** RIO'S VIEW — Top 5 Behind Customer per Rep. */
  top5Behind: RepBehindGroup[];
}

export async function getTabularPageData(
  supabase: SupabaseClient,
  fy: string,
  filters: Filters,
  startMonth: number,
): Promise<TabularPageData> {
  // RIO'S VIEW needs rep×customer×date line detail (Daily Sales & Target). There is no SQL-agg RPC
  // at that grain, so the fact is pulled directly — but FULLY, not capped: PostgREST hard-caps each
  // response at 1000 rows, so the previous `.limit(5000)` still truncated FY2026's 10.5k rows and
  // broke every RIO total. We page through all rows under a DETERMINISTIC order (sale_date alone is
  // non-unique → unstable .range() boundaries that double-count/skip rows) so the rep totals tie out
  // to the SQL-aggregated "Sales by Representative" matrix (= R11,904,816 for FY2026, unfiltered).
  const fetchFactPage = (from: number, to: number) => {
    let q = supabase
      .from("v_sales_fact")
      .select("sale_date, fiscal_month, sales_representative, customer_code, customer_name, brand, amount, quantity")
      .eq("fiscal_year", fy)
      // Deterministic multi-column order so .range() pages don't overlap/skip on duplicate sale_dates.
      .order("sale_date")
      .order("sales_representative")
      .order("customer_code")
      .order("brand")
      .order("amount")
      .order("quantity")
      .range(from, to);
    for (const [k, col] of [
      ["rep", "sales_representative"],
      ["brand", "brand"],
      ["customer", "customer_code"],
      ["quarter", "fiscal_quarter"],
      ["product", "product"],
      ["sku", "sku"],
      ["invoice", "invoice_credit_note"],
    ] as [keyof Filters, string][]) {
      if (filters[k]) q = q.eq(col, filters[k] as string);
    }
    if (filters.month) q = q.eq("fiscal_month", Number(filters.month));
    if (filters.weekStart) q = q.eq("week_start", filters.weekStart);
    if (filters.date) q = q.eq("sale_date", filters.date);
    if (filters.dateFrom) q = q.gte("sale_date", filters.dateFrom);
    if (filters.dateTo) q = q.lte("sale_date", filters.dateTo);
    return q as unknown as Promise<{ data: Record<string, unknown>[] | null }>;
  };
  const fetchAllFacts = async (): Promise<Record<string, unknown>[]> => {
    const PAGE = 1000;
    const out: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data } = await fetchFactPage(from, from + PAGE - 1);
      const rows = data ?? [];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
    return out;
  };

  // Customer-target query — filter-aware. Previously only `fiscal_year` was applied, so a rep/brand/
  // month slicer left the targets (and therefore every Behind value) at the unfiltered total. Apply
  // the same rep/brand/month filters the sales side uses; customer & target columns are kept for the
  // per-(rep, customer) Behind keying.
  let custTargetQ = supabase
    .from("v_target_by_month")
    .select("sales_representative, customer, target_amount")
    .eq("fiscal_year", fy);
  if (filters.rep) custTargetQ = custTargetQ.eq("sales_representative", filters.rep);
  if (filters.brand) custTargetQ = custTargetQ.eq("brand", filters.brand);
  if (filters.month) custTargetQ = custTargetQ.eq("fiscal_month", Number(filters.month));

  const [repSales, repTgt, brandProductRows, facts_raw, custTargetRes]: [
    DimMonthRow[],
    TargetMonthRow[],
    { k1: string; k2: string; sales: number }[],
    Record<string, unknown>[],
    { data: Record<string, unknown>[] | null },
  ] = await Promise.all([
    salesByDimMonth(supabase, fy, "sales_representative", filters),
    targetByDimMonth(supabase, fy, "sales_representative", filters),
    salesByTwoDims(supabase, fy, "brand", "product", filters),
    fetchAllFacts(),
    custTargetQ as unknown as Promise<{ data: Record<string, unknown>[] | null }>,
  ]);

  const repTgtByKey = new Map<string, number>();
  for (const t of repTgt) repTgtByKey.set(`${t.dim}|${t.fiscal_month}`, t.target);

  // Per-month sales/target/qty totals (drives column ordering + achievement).
  const monthAgg = new Map<number, MeasureCell>();
  for (const r of repSales) {
    const m = monthAgg.get(r.fiscal_month) ?? emptyCell();
    m.sales += r.sales;
    m.quantity += r.quantity;
    monthAgg.set(r.fiscal_month, m);
  }
  for (const t of repTgt) {
    const m = monthAgg.get(t.fiscal_month) ?? emptyCell();
    m.target += t.target;
    monthAgg.set(t.fiscal_month, m);
  }

  const hasData = [...monthAgg.values()].some((m) => m.sales > 0);

  const salesMonths = [...monthAgg.entries()].filter(([, m]) => m.sales > 0).map(([fm]) => fm).sort((a, b) => a - b);

  const quarterGroups: QuarterGroup[] = [];
  for (const fm of salesMonths) {
    const q = quarterOf(fm);
    const g = quarterGroups.find((x) => x.quarter === q);
    if (g) g.fms.push(fm);
    else quarterGroups.push({ quarter: q, fms: [fm] });
  }
  const multiMonthQuarters = new Set(quarterGroups.filter((g) => g.fms.length > 1).map((g) => g.quarter));

  // ── Sales & Target per Fiscal Year (TARGET_ACHIEVEMENT / YTD_TARGET_ACHIEVEMENT) ──
  const asOfIso =
    ((
      await supabase
        .from("v_sales_fact")
        .select("sale_date")
        .eq("fiscal_year", fy)
        .order("sale_date", { ascending: false })
        .limit(1)
    ).data?.[0]?.sale_date as string | undefined) ?? undefined;
  const tFilters: Record<string, string> = {};
  if (filters.rep) tFilters.rep = filters.rep;
  if (filters.brand) tFilters.brand = filters.brand;
  if (filters.month) tFilters.month = filters.month;
  let proratedYtdTarget = 0;
  if (asOfIso) {
    const { data: ft } = await supabase.rpc("ytd_target_aligned_filtered", { p_fy: fy, p_asof: asOfIso, p_filters: tFilters });
    if (typeof ft === "number") proratedYtdTarget = ft;
  }
  const maSales = salesMonths.map((fm) => monthAgg.get(fm)?.sales ?? 0);
  const maTarget = salesMonths.map((fm) => monthAgg.get(fm)?.target ?? 0);
  const cumSum = (arr: number[], i: number) => arr.slice(0, i + 1).reduce((a, v) => a + v, 0);
  const lastIdx = salesMonths.length - 1;
  const monthAchievement: MonthAchievementRow[] = salesMonths.map((fm, i) => {
    const sales = maSales[i];
    const target = maTarget[i];
    const runSales = cumSum(maSales, i);
    // Current (last) month uses the working-day prorated YTD target; earlier months sum full targets.
    const runTarget = i === lastIdx && proratedYtdTarget > 0 ? proratedYtdTarget : cumSum(maTarget, i);
    return {
      fiscalMonth: fm,
      quarter: quarterOf(fm),
      label: fiscalMonthLabel(fm, startMonth),
      sales,
      target,
      achievement: target > 0 ? sales / target : null,
      ytdAchievement: runTarget > 0 ? runSales / runTarget : null,
      dailyTargetYtd: runTarget,
    };
  });
  const maTotalSales = maSales.reduce((a, v) => a + v, 0);
  const maTotalTarget = maTarget.reduce((a, v) => a + v, 0);
  const monthAchievementTotal = {
    sales: maTotalSales,
    target: maTotalTarget,
    ytdTarget: proratedYtdTarget > 0 ? proratedYtdTarget : maTotalTarget,
  };

  // ── Sales & Target by Representative (Sales | Target | Behind) ──
  const repTargetRows = repSales.map((r) => ({
    name: r.dim || "Unassigned",
    fiscal_month: r.fiscal_month,
    sales: r.sales,
    quantity: r.quantity,
    target: repTgtByKey.get(`${r.dim}|${r.fiscal_month}`) ?? 0,
  }));
  const repsST = pivot(repTargetRows)
    .filter((r) => r.total.sales !== 0 || r.total.target !== 0)
    .sort((a, b) => b.total.sales - a.total.sales);
  const repsSTGrand = grandTotal(repsST);

  // ── Sales by Representative (Sales | Quantity) ──
  const reps = pivot(repTargetRows.map((r) => ({ ...r, target: 0 })))
    .filter((r) => r.total.sales !== 0 || r.total.quantity !== 0)
    .sort((a, b) => b.total.sales - a.total.sales);
  const repsGrand = grandTotal(reps);

  // ── Sales by Brands & Products (Brand → Product, Sales | Quantity) ──
  // salesByTwoDims gives brand × product totals (no month split — quantity included via lines? No:
  // get_sales_by_two_dims returns only sales). We need quantity per product too, so derive from
  // the product agg keyed by brand. Use the two-dim sales and fetch product qty separately.
  const brandMap = new Map<string, { total: MeasureCell; products: Map<string, MeasureCell> }>();
  for (const r of brandProductRows) {
    const brand = r.k1 || "Unknown";
    const product = r.k2 || "Unknown";
    const entry = brandMap.get(brand) ?? { total: emptyCell(), products: new Map<string, MeasureCell>() };
    const p = entry.products.get(product) ?? emptyCell();
    p.sales += r.sales;
    entry.products.set(product, p);
    entry.total.sales += r.sales;
    brandMap.set(brand, entry);
  }
  // Quantity per (brand, product): brand×product two-dim RPC returns only sales, so pull quantity
  // from the brand-level month agg is not granular enough; instead query product qty by brand.
  // Reuse the two-dim agg approach won't carry qty — fetch product-level qty via salesByDimMonth("product").
  const productQtyRows = await salesByDimMonth(supabase, fy, "product", filters);
  const qtyByProduct = new Map<string, number>();
  for (const r of productQtyRows) qtyByProduct.set(r.dim, (qtyByProduct.get(r.dim) ?? 0) + r.quantity);

  const brandProduct: PivotRowData[] = [...brandMap.entries()]
    .map(([brand, e]) => {
      const row: PivotRowData = { name: brand, byMonth: new Map(), total: emptyCell() };
      for (const [, pcell] of e.products) row.total.sales += pcell.sales;
      row.total.quantity = [...e.products.keys()].reduce((a, p) => a + (qtyByProduct.get(p) ?? 0), 0);
      return row;
    })
    .filter((b) => b.total.sales !== 0 || b.total.quantity !== 0)
    .sort((a, b) => b.total.sales - a.total.sales);
  const brandProductChildren = new Map<string, PivotRowData[]>();
  for (const [brand, e] of brandMap) {
    const children: PivotRowData[] = [...e.products.entries()]
      .map(([product, pcell]) => {
        const row: PivotRowData = { name: product, byMonth: new Map(), total: emptyCell() };
        row.total.sales = pcell.sales;
        row.total.quantity = qtyByProduct.get(product) ?? 0;
        return row;
      })
      .filter((p) => p.total.sales !== 0 || p.total.quantity !== 0)
      .sort((a, b) => b.total.sales - a.total.sales);
    brandProductChildren.set(brand, children);
  }
  const brandProductGrand = grandTotal(brandProduct);

  // ── RIO'S VIEW source: rep × customer × date line detail (full, uncapped fact pull) ──
  const facts = facts_raw.map((r) => ({
    saleDate: (r.sale_date as string) ?? "",
    fiscalMonth: n(r.fiscal_month),
    rep: (r.sales_representative as string) ?? "Unassigned",
    customerCode: (r.customer_code as string) ?? "",
    customerName: (r.customer_name as string) ?? "",
    sales: n(r.amount),
  }));
  const customerLabel = (code: string, name: string) => (code ? `(${code}) ${name}`.trim() : name || "Unknown");

  // Annual customer target per rep, keyed `rep|(code) name`. v_target_by_month.customer is already
  // formatted "(CODE) Name" — the same shape customerLabel() produces — so we key on the full label
  // directly (no fragile prefix-stripping). This query is now filter-aware (see custTargetQ above).
  const custTargetByRep = new Map<string, number>();
  for (const r of custTargetRes.data ?? []) {
    const key = `${r.sales_representative ?? ""}|${r.customer ?? ""}`;
    custTargetByRep.set(key, (custTargetByRep.get(key) ?? 0) + n(r.target_amount));
  }

  // ── Daily target inputs (Fix 3): working-day spread of each rep's monthly target ──
  // Daily rep target = (rep's monthly target) ÷ (business days in that fiscal month), charged only on
  // business days (holiday-aware via calendar.is_business_day), 0 otherwise. So a date's rep target is
  // 0 on weekends/holidays and the even daily slice on working days — making Behind = sales − target
  // meaningful at the date/rep grain (customers inherit no target split, consistent with PBI).
  const [{ data: bizDaysData }, { data: calData }] = await Promise.all([
    supabase.from("v_calendar_month_bizdays").select("fiscal_month, business_days").eq("fiscal_year", fy),
    supabase.from("calendar").select("date, is_business_day").eq("fiscal_year", fy),
  ]);
  const bizDaysByMonth = new Map<number, number>();
  for (const r of (bizDaysData ?? []) as { fiscal_month: number; business_days: number }[]) {
    bizDaysByMonth.set(n(r.fiscal_month), n(r.business_days));
  }
  const isBizDay = new Map<string, boolean>();
  for (const r of (calData ?? []) as { date: string; is_business_day: boolean }[]) {
    isBizDay.set(String(r.date).slice(0, 10), !!r.is_business_day);
  }
  // Monthly target per (rep, fiscal_month) — reuses the filter-aware rep target already fetched.
  const repMonthTarget = new Map<string, number>();
  for (const t of repTgt) repMonthTarget.set(`${t.dim}|${t.fiscal_month}`, (repMonthTarget.get(`${t.dim}|${t.fiscal_month}`) ?? 0) + t.target);
  const dailyRepTarget = (rep: string, fiscalMonth: number, saleDate: string): number => {
    if (!isBizDay.get(saleDate)) return 0; // weekend/holiday → no target charged
    const monthly = repMonthTarget.get(`${rep}|${fiscalMonth}`) ?? 0;
    const bd = bizDaysByMonth.get(fiscalMonth) ?? 0;
    return monthly > 0 && bd > 0 ? monthly / bd : 0;
  };

  // Daily Sales & Target by Representative (Month → Date → Rep → Customer).
  const dailyMonthMap = new Map<number, DailyMonth>();
  for (const f of facts) {
    if (!f.saleDate) continue;
    let dm = dailyMonthMap.get(f.fiscalMonth);
    if (!dm) {
      dm = { fiscalMonth: f.fiscalMonth, label: fiscalMonthLabel(f.fiscalMonth, startMonth), dates: [], sales: 0, target: 0 };
      dailyMonthMap.set(f.fiscalMonth, dm);
    }
    let dd = dm.dates.find((d) => d.date === f.saleDate);
    if (!dd) {
      dd = {
        date: f.saleDate,
        label: new Date(f.saleDate + "T00:00:00").toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }),
        reps: [],
        sales: 0,
        target: 0,
      };
      dm.dates.push(dd);
    }
    let dr = dd.reps.find((x) => x.rep === f.rep);
    if (!dr) {
      // Charge the rep's daily working-day target once per (date, rep), then roll up to date/month.
      const repDayTarget = dailyRepTarget(f.rep, f.fiscalMonth, f.saleDate);
      dr = { rep: f.rep, customers: [], sales: 0, target: repDayTarget };
      dd.reps.push(dr);
      dd.target += repDayTarget;
      dm.target += repDayTarget;
    }
    const cust = customerLabel(f.customerCode, f.customerName);
    let dc = dr.customers.find((x) => x.customer === cust);
    if (!dc) {
      dc = { customer: cust, sales: 0, target: 0 };
      dr.customers.push(dc);
    }
    dc.sales += f.sales;
    dr.sales += f.sales;
    dd.sales += f.sales;
    dm.sales += f.sales;
  }
  const dailyMonths = [...dailyMonthMap.values()].sort((a, b) => a.fiscalMonth - b.fiscalMonth);
  for (const dm of dailyMonths) {
    dm.dates.sort((a, b) => a.date.localeCompare(b.date));
    for (const dd of dm.dates) dd.reps.sort((a, b) => a.rep.localeCompare(b.rep));
  }
  const dailyGrand = {
    sales: dailyMonths.reduce((a, m) => a + m.sales, 0),
    target: dailyMonths.reduce((a, m) => a + m.target, 0),
  };

  // Top 5 Behind Customer per Rep (rep × customer sales vs annual customer target).
  const repCustMap = new Map<string, { rep: string; customer: string; sales: number }>();
  for (const f of facts) {
    const cust = customerLabel(f.customerCode, f.customerName);
    const key = `${f.rep}|${cust}`;
    const entry = repCustMap.get(key) ?? { rep: f.rep, customer: cust, sales: 0 };
    entry.sales += f.sales;
    repCustMap.set(key, entry);
  }
  const repCustRows = [...repCustMap.values()].map((e) => {
    // e.customer is the "(code) name" label, matching v_target_by_month.customer exactly.
    const target = custTargetByRep.get(`${e.rep}|${e.customer}`) ?? 0;
    return { ...e, target, behind: e.sales - target };
  });
  const repsOrdered = [...new Set(repCustRows.map((r) => r.rep))].sort();
  const top5Behind: RepBehindGroup[] = repsOrdered.map((rep) => ({
    rep,
    rows: repCustRows
      .filter((r) => r.rep === rep)
      .sort((a, b) => a.behind - b.behind)
      .slice(0, 5)
      .map((r) => ({ customer: r.customer, sales: r.sales, target: r.target, behind: r.behind })),
  }));

  return {
    hasData,
    startMonth,
    salesMonths,
    quarterGroups,
    multiMonthQuarters,
    monthAchievement,
    monthAchievementTotal,
    brandProduct,
    brandProductGrand,
    brandProductChildren,
    reps,
    repsGrand,
    repsST,
    repsSTGrand,
    dailyMonths,
    dailyGrand,
    top5Behind,
  };
}
