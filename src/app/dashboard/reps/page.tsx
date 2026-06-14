// [2] SALES REPRESENTATIVE ANALYSIS — rebuilt to the Power BI page layout/story.
// Order: Representative Sales/Target/Achievement combo · Top 5 Reps + Rep Pareto ·
// Actual Sales decomp (Rep→Customer→Brand→Product) · LYTD-vs-CYTD decomp · Actual-vs-YTD-Target decomp.
// All FY-live, filter-aware via parseFilters → getRepsPageData.

import { getActiveFiscalYear, fiscalYearLabel } from "@/lib/data/queries";
import { getRepsPageData } from "@/lib/data/reps-page";
import { parseFilters } from "@/lib/filters";
import { RankingBar, RepTargetCombo, type RepTargetDatum } from "@/components/charts/echarts";
import { KRDM } from "@/components/charts/theme";
import { ParetoCard } from "@/components/charts/pareto-card";
import { DecompositionTree } from "@/components/charts/decomp-tree";
import { ReportHeader } from "@/components/report-header";
import { ReportCard } from "@/components/report-card";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

function fmtAsOf(iso: string | null) {
  if (!iso) return "No data loaded";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

const REP_LEVELS = ["Representative", "Customer", "Brand", "Product"];

export default async function SalesRepAnalysisPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const fy = filters.fy ?? (await getActiveFiscalYear());
  const data = await getRepsPageData(fy, filters);

  const header = (
    <ReportHeader title="SALES REPRESENTATIVE ANALYSIS" subtitle={`KRDM Stainless Steel Solutions · FY ${fiscalYearLabel(fy)}`} asOf={fmtAsOf(data.asOf)} />
  );

  if (!data.hasData) {
    return (
      <div className="space-y-5">
        {header}
        <EmptyState title="No sales loaded yet" message="Run the CIN7 sync or import a sales workbook to populate this dashboard." />
      </div>
    );
  }

  const combo: RepTargetDatum[] = data.reps.slice(0, 12).map((r) => ({ label: r.rep, sales: r.sales, target: r.target, difference: r.variance, achievement: r.achievement }));
  const top5 = data.reps.slice(0, 5).map((r) => ({ name: r.rep, value: r.sales }));
  const repPareto = data.reps.map((r) => ({ name: r.rep, value: r.sales }));
  const noLy = "Requires prior-year sales — FY2025 backfill is in progress.";

  return (
    <div className="space-y-5">
      {header}

      {/* REPRESENTATIVE SALES, TARGET AND ACHIEVEMENT */}
      <ReportCard title="REPRESENTATIVE SALES, TARGET AND ACHIEVEMENT" subtitle="Sales · Target · Difference (bars) · Achieve R 100% (line)">
        <RepTargetCombo data={combo} />
      </ReportCard>

      {/* TOP 5 + Rep Pareto */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard title="TOP 5 REPRESENTATIVE BY SALES">
          <RankingBar data={top5} color={KRDM.cyan} />
        </ReportCard>
        <ParetoCard title="PARETO ANALYSIS OF SALES REVENUE BY REPRESENTATIVE" data={repPareto} />
      </div>

      {/* ACTUAL SALES BY REPRESENTATIVE (Rep → Customer → Brand → Product) */}
      <ReportCard title="ACTUAL SALES BY REPRESENTATIVE" subtitle="Drill: Representative → Customer → Brand → Product">
        <DecompositionTree root={data.actualByRep} levels={REP_LEVELS} rootLabel="Sales" />
      </ReportCard>

      {/* LAST YEAR TO DATE SALES VS CURRENT SALES BY REPRESENTATIVE */}
      <ReportCard title="LAST YEAR TO DATE SALES VS CURRENT SALES BY REPRESENTATIVE" subtitle="Nodes show CY vs LY · Representative → Customer → Brand → Product">
        {!data.hasPriorYear && <p className="mb-2 px-1 text-xs text-amber-700">{noLy} Showing current YTD sales decomposition instead.</p>}
        <DecompositionTree root={data.growthByRep} levels={REP_LEVELS} rootLabel={data.hasPriorYear ? "YTD Growth vs Last Year" : "Current YTD Sales"} />
      </ReportCard>

      {/* ACTUAL SALES VS YTD TARGET BY REPRESENTATIVE */}
      <ReportCard title="ACTUAL SALES VS YTD TARGET BY REPRESENTATIVE" subtitle="Global YTD Sales vs Target Variance (sales − target) by representative">
        <DecompositionTree root={data.varianceByRep} levels={["Representative"]} rootLabel="Variance" />
      </ReportCard>

      <p className="pt-1 pb-3 text-center text-xs text-gray-400">© {new Date().getFullYear()} KRDM. Confidential and proprietary.</p>
    </div>
  );
}
