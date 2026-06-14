// Daily — the "Sales Tracker": daily Sales + working-day Target bars with Running Sales/Target lines,
// plus MTD and Current Day cards. Target is spread over SA business days only (weekends + public
// holidays excluded via calendar.is_business_day). Filter-aware via the global slicers.

export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getActiveFiscalYear, fiscalYearLabel, getAsOfLabel } from "@/lib/data/queries";
import { parseFilters } from "@/lib/filters";
import { getDailyTracker } from "@/lib/data/daily-page";
import { rand, percent } from "@/lib/format";
import { SalesTracker, type TrackerPoint } from "@/components/charts/echarts";
import { ReportHeader } from "@/components/report-header";
import { EmptyState } from "@/components/empty-state";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function trackerLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}-${MON[m - 1]}-${y}`;
}

function StatCard({ label, pct, sales, target }: { label: string; pct: number | null; sales: number; target: number }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm" style={{ borderLeft: "5px solid #26BFF1", border: "1px solid rgba(0,0,0,0.06)", borderLeftWidth: 5, borderLeftColor: "#26BFF1" }}>
      <p className="text-[13px] font-bold uppercase leading-tight tracking-wide text-[#64748b]">{label}</p>
      <p className="mt-2 text-4xl font-bold tabular-nums text-[#0f2a43]">{pct == null ? "—" : percent(pct, 2)}</p>
      <div className="mt-3 space-y-0.5 text-sm text-[#64748b]">
        <p>Sales: <span className="font-medium text-[#0f2a43]">{rand(sales)}</span></p>
        <p>Target: <span className="font-medium text-[#0f2a43]">{rand(target)}</span></p>
      </div>
    </section>
  );
}

export default async function DailyTrackingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const supabase = await createClient();
  const fy = filters.fy ?? (await getActiveFiscalYear());

  const [data, asOf] = await Promise.all([
    getDailyTracker(supabase, fy, filters),
    getAsOfLabel(fy),
  ]);

  const header = (
    <ReportHeader title="DAILY" subtitle={`KRDM Stainless Steel Solutions · FY ${fiscalYearLabel(fy)}`} asOf={asOf.replace(/^Data as of\s*/i, "")} />
  );

  if (!data.hasData) {
    return (
      <div className="space-y-5">
        {header}
        <EmptyState title="No daily sales yet" message="Run the CIN7 sync or import a sales workbook to populate the daily view." />
      </div>
    );
  }

  const points: TrackerPoint[] = data.points.map((p) => ({
    label: trackerLabel(p.date),
    sales: p.sales,
    target: p.target,
    runningSales: p.runningSales,
    runningTarget: p.runningTarget,
  }));

  return (
    <div className="space-y-5">
      {header}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <section className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
          <h3 className="mb-1 text-center text-base font-bold tracking-wide text-[#64748b]">SALES TRACKER</h3>
          <SalesTracker data={points} />
        </section>

        <div className="grid grid-rows-2 gap-4">
          <StatCard label={`MTD Sales - ${data.monthLabel}`} pct={data.mtd.pct} sales={data.mtd.sales} target={data.mtd.target} />
          <StatCard label="Current Day Sales" pct={data.currentDay?.pct ?? null} sales={data.currentDay?.sales ?? 0} target={data.currentDay?.target ?? 0} />
        </div>
      </div>
    </div>
  );
}
