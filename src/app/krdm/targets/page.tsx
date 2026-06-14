export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import {
  getActiveFiscalYear,
  getFiscalStartMonth,
  fiscalYearLabel,
  fiscalMonthLabel,
  getAsOfLabel,
} from "@/lib/data/queries";
import { targetByDimMonth, salesByDimMonth, repTargetLines } from "@/lib/data/agg";
import { rand, percent, count } from "@/lib/format";
import { KpiStat } from "@/components/kpi";
import { ChartCard } from "@/components/charts/chart-kit";
import { AchievementCell, MoneyCell } from "@/components/data-cells";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TargetEditor } from "./target-matrix";

export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const fy = await getActiveFiscalYear();
  const startMonth = await getFiscalStartMonth();

  // Role gate (RLS enforces the same on write).
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = auth?.user
    ? await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle()
    : { data: null };
  const canEdit = profile?.role === "admin" || profile?.role === "manager";

  // Rep-level rollup: annual target + YTD actual per rep (filter-aware RPCs, small + untruncated).
  const [repTgt, repSales, asOf] = await Promise.all([
    targetByDimMonth(supabase, fy, "sales_representative", {}),
    salesByDimMonth(supabase, fy, "sales_representative", {}),
    getAsOfLabel(fy),
  ]);
  const targetByRep = new Map<string, number>();
  for (const r of repTgt) targetByRep.set(r.dim, (targetByRep.get(r.dim) ?? 0) + r.target);
  const salesByRep = new Map<string, number>();
  for (const r of repSales) salesByRep.set(r.dim, (salesByRep.get(r.dim) ?? 0) + r.sales);

  const repRows = [...targetByRep.entries()]
    .map(([rep, annual]) => ({ rep, annual, ytd: salesByRep.get(rep) ?? 0 }))
    .sort((a, b) => b.annual - a.annual);

  const subtitle = `Sales targets by representative · customer & brand breakdown · FY ${fiscalYearLabel(fy)}`;

  if (repRows.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Target Management" subtitle={subtitle} asOf={asOf} />
        <EmptyState title="No targets loaded" message="Import a target workbook (npm run import:targets) to populate this page." />
      </div>
    );
  }

  const repOptions = repRows.map((r) => r.rep);
  const selectedRep = (Array.isArray(sp.trep) ? sp.trep[0] : sp.trep) || repOptions[0];
  const lines = await repTargetLines(supabase, fy, selectedRep);
  const monthLabels = Array.from({ length: 12 }, (_, i) => fiscalMonthLabel(i + 1, startMonth));

  const totalAnnual = repRows.reduce((a, r) => a + r.annual, 0);
  const totalYtd = repRows.reduce((a, r) => a + r.ytd, 0);
  const totalCustomers = new Set(lines.map((l) => l.customer)).size;

  return (
    <div className="space-y-6">
      <PageHeader title="Target Management" subtitle={subtitle} asOf={asOf} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiStat label="Annual Target" value={rand(totalAnnual)} accent sub={`FY ${fiscalYearLabel(fy)}`} />
        <KpiStat label="Representatives" value={count(repRows.length)} sub="With a target plan" />
        <KpiStat label="YTD Actual" value={rand(totalYtd)} sub="Sales to date" />
        <KpiStat label="% of Annual" value={totalAnnual > 0 ? percent(totalYtd / totalAnnual) : "—"} sub="Actual ÷ annual target" />
      </div>

      <ChartCard title="Plan by Representative" subtitle="Annual target vs sales to date">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Representative</th>
                <th className="text-right">Annual Target</th>
                <th className="text-right">YTD Actual</th>
                <th className="text-right">% of Annual</th>
              </tr>
            </thead>
            <tbody>
              {repRows.map((r) => (
                <tr key={r.rep}>
                  <td><span className="font-medium text-gray-900">{r.rep}</span></td>
                  <td className="text-right"><MoneyCell value={r.annual} /></td>
                  <td className="text-right"><MoneyCell value={r.ytd} /></td>
                  <td className="text-right"><AchievementCell achievement={r.annual > 0 ? r.ytd / r.annual : null} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td><span className="font-semibold text-gray-900">Total</span></td>
                <td className="text-right"><MoneyCell value={totalAnnual} bold /></td>
                <td className="text-right"><MoneyCell value={totalYtd} bold /></td>
                <td className="text-right"><AchievementCell achievement={totalAnnual > 0 ? totalYtd / totalAnnual : null} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </ChartCard>

      <ChartCard
        title="Targets by Customer & Brand"
        subtitle={`${selectedRep} · ${totalCustomers} customer${totalCustomers === 1 ? "" : "s"} · edit per month inline`}
      >
        <TargetEditor fy={fy} rep={selectedRep} repOptions={repOptions} monthLabels={monthLabels} lines={lines} canEdit={canEdit} />
      </ChartCard>
    </div>
  );
}
