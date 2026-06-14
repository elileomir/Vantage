import { getActiveFiscalYear, getExecutiveData, getForecast } from "@/lib/data/queries";
import { getDashboardExtras } from "@/lib/data/dashboard-extras";
import { parseFilters } from "@/lib/filters";
import { rand, percent, growthLabel } from "@/lib/format";
import {
  Gauge, ComboBarLine, RankingBar, StackedAchievement,
  DropCombo, BehindBars, AchievementColumns, Sparkline,
  type ComboDatum, type DropDatum,
} from "@/components/charts/echarts";
import { KRDM, ragColor } from "@/components/charts/theme";
import { ExecTrend, type TrendDatum, type TrendSeriesMap } from "@/components/charts/exec-trend";
import { RepCustomerMatrix } from "@/app/dashboard/_components/rep-customer-matrix";
import { ReportHeader } from "@/components/report-header";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

function fmtAsOf(iso: string | null) {
  if (!iso) return "No data loaded";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}
const dayMonthUpper = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", { day: "2-digit", month: "long" }).toUpperCase();

function Card({ title, subtitle, children, className = "" }: { title?: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm ${className}`}>
      {title && <h3 className="text-base font-bold tracking-tight text-[#0f2a43]">{title}</h3>}
      {subtitle && <p className="mb-1 mt-0.5 text-xs text-gray-400">{subtitle}</p>}
      {!subtitle && title && <div className="mb-3" />}
      {children}
    </section>
  );
}
function NoData({ message }: { message: string }) {
  return <div className="flex h-[280px] items-center justify-center px-6 text-center text-xs text-gray-400">{message}</div>;
}

export default async function ExecutiveSummaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const fy = filters.fy ?? (await getActiveFiscalYear());
  const [data, extras] = await Promise.all([
    getExecutiveData(fy, filters),
    getDashboardExtras(fy, filters),
  ]);
  const { kpis } = data;
  const fc = await getForecast(fy, data.asOf);

  // ── Header ──────────────────────────────────────────────────────────────────
  const header = (
    <ReportHeader title="EXECUTIVE SUMMARY" subtitle={`KRDM Stainless Steel Solutions · FY ${data.fiscalYearLabel}`} asOf={fmtAsOf(data.asOf)} />
  );

  if (!data.hasData) {
    return (
      <div className="space-y-5">
        {header}
        <EmptyState title="No sales loaded yet" message="Run the CIN7 sync or import a sales workbook to populate this dashboard." />
      </div>
    );
  }

  // ── Overall-standing band ───────────────────────────────────────────────────
  const standingRange = data.periodStart && data.asOf ? `${dayMonthUpper(data.periodStart)} - ${dayMonthUpper(data.asOf)}` : "";
  const gapPct = kpis.achievement != null ? Math.max(0, 1 - kpis.achievement) : null;
  const growthVsLy = kpis.ly_sales != null ? kpis.ytd_sales - kpis.ly_sales : null;
  const salesBadge = growthLabel(kpis.yoy_growth);
  const sparkData = data.monthly.filter((m) => m.sales_amount > 0).map((m) => m.sales_amount);
  const progress = kpis.achievement != null ? Math.min(1, Math.max(0, kpis.achievement)) : 0;

  // ── Rep visuals ──────────────────────────────────────────────────────────
  const topReps: ComboDatum[] = data.reps.slice(0, 10).map((r) => ({ label: r.sales_representative, bar: r.sales_amount, line: r.achievement }));
  const repAchieveCols = data.reps.filter((r) => r.achievement != null).slice(0, 10).map((r) => ({ label: r.sales_representative, value: r.achievement as number }));
  const repAchieveStacked = data.reps.filter((r) => r.achievement != null).slice(0, 12).map((r) => ({ name: r.sales_representative, achieved: r.achievement as number }));

  // ── Brand / customer drop + behind ──────────────────────────────────────────
  const toDrop = (rows: { name: string; sales: number; lySales: number; achievement: number | null; dropVsLy: number | null }[]): DropDatum[] =>
    rows.filter((r) => r.dropVsLy != null && r.dropVsLy < 0).sort((a, b) => (a.dropVsLy as number) - (b.dropVsLy as number)).slice(0, 5)
      .map((r) => ({ label: r.name, sales: r.sales, lySales: r.lySales, achieve: r.achievement }));
  const toBehind = (rows: { name: string; behind: number }[]) =>
    rows.filter((r) => r.behind < 0).sort((a, b) => a.behind - b.behind).slice(0, 5).map((r) => ({ label: r.name, value: r.behind }));

  const brandsDrop = toDrop(extras.brandPerf);
  const brandsBehind = toBehind(extras.brandPerf);
  const customersDrop = toDrop(extras.customerPerf);
  const customersBehind = toBehind(extras.customerPerf);

  // ── Brand / product ranking ──────────────────────────────────────────────
  const topBrands = data.brands.slice(0, 12).map((b) => ({ name: b.name, value: b.sales_amount }));
  const topProducts = data.products.slice(0, 12).map((p) => ({ name: p.name.length > 28 ? p.name.slice(0, 27) + "…" : p.name, value: p.sales_amount }));

  // ── Customers card ───────────────────────────────────────────────────────
  const lyCust = extras.lyCustomerCount;
  const custYoy = lyCust > 0 ? (kpis.customer_count - lyCust) / lyCust : null;
  const custBadge = growthLabel(custYoy);

  // ── Forecast & trend tabs (run-rate × seasonal target curve) ────────────────
  const salesMonths = data.monthly.filter((m) => m.sales_amount > 0);
  const lastSalesMonth = Math.max(0, ...salesMonths.map((m) => m.fiscal_month));
  const achieve = kpis.achievement && kpis.achievement > 0 ? kpis.achievement : 1;
  const dailyRate = fc.bizDaysElapsed > 0 ? kpis.ytd_sales / fc.bizDaysElapsed : 0;
  const forecast: TrendDatum[] = data.monthly.map((m) => {
    const actual = m.sales_amount > 0 ? m.sales_amount : null;
    let proj: number | null = null;
    if (m.fiscal_month > lastSalesMonth) proj = m.target_amount > 0 ? achieve * m.target_amount : dailyRate * (fc.byMonthBizDays.get(m.fiscal_month) ?? 0);
    else if (m.fiscal_month === lastSalesMonth) proj = m.sales_amount;
    return { label: m.label, sales: actual, target: m.target_amount || null, forecast: proj };
  });
  const projectedFY =
    salesMonths.reduce((a, m) => a + m.sales_amount, 0) +
    data.monthly.filter((m) => m.fiscal_month > lastSalesMonth).reduce((a, m) => a + (m.target_amount > 0 ? achieve * m.target_amount : dailyRate * (fc.byMonthBizDays.get(m.fiscal_month) ?? 0)), 0);
  const monthly: TrendDatum[] = data.monthly.map((m) => ({ label: m.label, sales: m.sales_amount || null, target: m.target_amount || null }));
  const qMap = new Map<number, { s: number; t: number }>();
  for (const m of data.monthly) { const q = Math.floor((m.fiscal_month - 1) / 3) + 1; const e = qMap.get(q) ?? { s: 0, t: 0 }; e.s += m.sales_amount; e.t += m.target_amount; qMap.set(q, e); }
  const quarterly: TrendDatum[] = [...qMap.entries()].sort((a, b) => a[0] - b[0]).filter(([, v]) => v.s || v.t).map(([q, v]) => ({ label: `Q${q}`, sales: v.s || null, target: v.t || null }));
  const yearly: TrendDatum[] = [{ label: data.fiscalYearLabel, sales: kpis.ytd_sales || null, target: kpis.ytd_target || null }];
  const fmtDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", { day: "2-digit", month: "short" });
  const daily: TrendDatum[] = data.daily.map((d) => ({ label: fmtDay(d.date), sales: d.sales }));
  const wMap = new Map<string, number>();
  for (const d of data.daily) { const dt = new Date(d.date + "T00:00:00"); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); const wk = dt.toISOString().slice(0, 10); wMap.set(wk, (wMap.get(wk) ?? 0) + d.sales); }
  const weekly: TrendDatum[] = [...wMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([wk, s]) => ({ label: fmtDay(wk), sales: s }));
  const trendSeries: TrendSeriesMap = { FORECAST: forecast, YEARLY: yearly, QUARTERLY: quarterly, MONTHLY: monthly, WEEKLY: weekly, DAILY: daily };

  const noLy = "Requires prior-year sales — FY2025 backfill is in progress.";

  return (
    <div className="space-y-5">
      {header}

      {/* ── OVERALL STANDING ─────────────────────────────────────────────── */}
      <div>
        {standingRange && (
          <p className="mb-3 text-center text-sm font-bold tracking-[0.04em] text-[#0f2a43]">
            OVERALL STANDING FOR YEAR TO DATE RANGE {standingRange}
          </p>
        )}
        <section className="grid gap-px overflow-hidden rounded-2xl border border-black/[0.06] bg-black/[0.06] shadow-sm md:grid-cols-3">
          {/* Achievement */}
          <div className="flex flex-col bg-white p-5">
            <p className="text-center text-[11px] font-bold uppercase tracking-[0.12em] text-[#1f4e6b]">Overall Achievement</p>
            <Gauge ratio={kpis.achievement} height={190} />
            <div className="mt-2 grid grid-cols-2 gap-3 border-t border-black/[0.06] pt-3 text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Target Gap</p>
                <p className="text-lg font-bold tabular-nums text-[#0f2a43]">{gapPct == null ? "—" : percent(gapPct)}</p>
                <p className="text-xs tabular-nums text-gray-400">{rand(kpis.target_gap)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Growth vs LY</p>
                <p className="text-lg font-bold tabular-nums" style={{ color: growthVsLy == null ? "#0f2a43" : growthVsLy >= 0 ? KRDM.green : KRDM.redNeg }}>
                  {growthVsLy == null ? "—" : rand(growthVsLy)}
                </p>
                <p className="text-xs text-gray-400">{kpis.ly_sales == null ? "no prior-year data" : "vs Previous YTD"}</p>
              </div>
            </div>
          </div>

          {/* Sales */}
          <div className="flex flex-col bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1f4e6b]">Sales</p>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold tabular-nums text-[#0f2a43]">{rand(kpis.ytd_sales)}</span>
            </div>
            {salesBadge.text !== "—" && (
              <span
                className="mt-1.5 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                style={{ background: salesBadge.tone === "negative" ? KRDM.redNeg : salesBadge.tone === "positive" ? KRDM.green : "#9ca3af" }}
              >
                {salesBadge.text}
              </span>
            )}
            <div className="mt-2 flex-1">
              {sparkData.length > 1 ? <Sparkline data={sparkData} height={70} /> : <div className="h-[70px]" />}
            </div>
            <p className="mt-1 text-sm italic text-gray-500">
              LY Sales: <span className="font-semibold not-italic text-[#0f2a43]">{kpis.ly_sales != null ? rand(kpis.ly_sales) : "—"}</span>
            </p>
          </div>

          {/* Target */}
          <div className="flex flex-col bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1f4e6b]">Target</p>
            <span className="text-3xl font-bold tabular-nums text-[#0f2a43]">{rand(kpis.ytd_target)}</span>
            <div className="mt-auto">
              <div className="mb-1.5 flex items-center justify-between text-xs text-gray-400">
                <span>Achieved</span>
                <span className="font-semibold tabular-nums" style={{ color: ragColor(kpis.achievement) }}>{kpis.achievement == null ? "—" : percent(kpis.achievement)}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-black/[0.06]">
                <div className="h-full rounded-full transition-all" style={{ width: `${progress * 100}%`, background: ragColor(kpis.achievement) }} />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── REP PERFORMANCE ───────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Sales Representative" subtitle="Sales (bars) vs Achieve R 100% (line)"><ComboBarLine data={topReps} barName="Sales" lineName="Achieve R 100%" /></Card>
        <Card title="Sales Representative YTD Achievement" subtitle="YTD Sales / YTD Target">
          {repAchieveCols.length ? <AchievementColumns data={repAchieveCols} /> : <NoData message="No achievement data." />}
        </Card>
      </div>

      {/* ── BRANDS: drop vs LY + behind target ────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Top 5 Brand with Biggest Drop in Sales vs Last Year">{brandsDrop.length ? <DropCombo data={brandsDrop} /> : <NoData message={noLy} />}</Card>
        <Card title="Top 5 Brands with Furthest Behind the Target">{brandsBehind.length ? <BehindBars data={brandsBehind} /> : <NoData message="No brands behind target." />}</Card>
      </div>

      {/* ── CUSTOMERS: drop vs LY + behind target ─────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Top 5 Customer with Biggest Drop in Sales vs Last Year">{customersDrop.length ? <DropCombo data={customersDrop} /> : <NoData message={noLy} />}</Card>
        <Card title="Top 5 Customers with Furthest Behind the Target">{customersBehind.length ? <BehindBars data={customersBehind} /> : <NoData message="No customers behind target." />}</Card>
      </div>

      {/* ── SALES REP & CUSTOMER PERFORMANCE (matrix + customers card) ─────── */}
      <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
        <section className="flex flex-col items-center justify-center rounded-2xl border border-black/[0.06] bg-white p-5 text-center shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1f4e6b]">Customers</p>
          <p className="my-1 text-4xl font-bold tabular-nums text-[#0f2a43]">{kpis.customer_count}</p>
          {custBadge.text !== "—" && (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: custBadge.tone === "negative" ? KRDM.redNeg : custBadge.tone === "positive" ? KRDM.green : "#9ca3af" }}>
              {custBadge.text}
            </span>
          )}
          <p className="mt-3 text-xs italic text-gray-500">LY Customers: <span className="font-semibold not-italic text-[#0f2a43]">{lyCust > 0 ? lyCust : "—"}</span></p>
        </section>
        <Card title="Sales Rep & Customer Performance (vs Last Year)">
          <RepCustomerMatrix reps={extras.repCustomerMatrix} />
        </Card>
      </div>

      {/* ── FORECAST & TREND ──────────────────────────────────────────────── */}
      <Card title="Sales Forecast and Trend Analysis" subtitle={`Projected FY-end: ${rand(projectedFY)} (at ${percent(achieve)} achievement) · ${fc.bizDaysElapsed}/${fc.bizDaysTotal} working days elapsed`}>
        <ExecTrend series={trendSeries} />
      </Card>

      {/* ── ACHIEVEMENT STATS · BRAND SALES · PRODUCT SALES ───────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Achievement Stats by Reps" subtitle="Achieve vs Remaining">
          {repAchieveStacked.length ? <StackedAchievement data={repAchieveStacked} /> : <NoData message="No achievement data." />}
        </Card>
        <Card title="Brand Sales" subtitle="Top by sales"><RankingBar data={topBrands} /></Card>
        <Card title="Product Sales" subtitle="Top by sales"><RankingBar data={topProducts} /></Card>
      </div>

      <p className="pt-1 pb-3 text-center text-xs text-gray-400">© {new Date().getFullYear()} KRDM. Confidential and proprietary.</p>
    </div>
  );
}
