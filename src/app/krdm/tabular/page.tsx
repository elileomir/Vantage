// Tabular Summary (PBI page 5) — rebuilt with the shared PivotMatrix.
// Every matrix is configured data-driven; RIO'S VIEW is a visually distinct band.

import { createClient } from "@/lib/supabase/server";
import { getActiveFiscalYear, getAsOfLabel, getFiscalStartMonth, fiscalYearLabel, fiscalMonthLabel } from "@/lib/data/queries";
import { parseFilters } from "@/lib/filters";
import { getTabularPageData } from "@/lib/data/tabular-page";
import { PivotMatrix, type MatrixColumn, type MatrixRow } from "@/components/charts/pivot-matrix";
import { ReportHeader } from "@/components/report-header";
import { ReportCard } from "@/components/report-card";
import { EmptyState } from "@/components/empty-state";
import { buildSalesQtyMatrix, buildSalesTargetBehindMatrix } from "./_components/matrix-builders";

export const dynamic = "force-dynamic";

export default async function TabularSummaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const fy = filters.fy ?? (await getActiveFiscalYear());
  const startMonth = await getFiscalStartMonth();
  const supabase = await createClient();

  const [data, asOf] = await Promise.all([getTabularPageData(supabase, fy, filters, startMonth), getAsOfLabel(fy)]);
  const header = (
    <ReportHeader title="TABULAR SUMMARY" subtitle={`KRDM Stainless Steel Solutions · FY ${fiscalYearLabel(fy)}`} asOf={asOf.replace(/^Data as of\s*/i, "")} />
  );

  if (!data.hasData) {
    return (
      <div className="space-y-5">
        {header}
        <EmptyState title="No sales recorded yet" message="Run the CIN7 sync or import a sales workbook to populate the tabular matrices." />
      </div>
    );
  }

  // ── SALES AND TARGET PER FISCAL YEAR ──────────────────────────────────────
  // PBI orientation: month COLUMNS (Quarter · Month → Sales, YTD Target, YTD %, Target, %),
  // single fiscal-year ROW. Each month carries its own measures.
  const fyMonths = [...data.monthAchievement].sort((a, b) => a.fiscalMonth - b.fiscalMonth);
  const fyCols: MatrixColumn[] = fyMonths.flatMap((m) => {
    const g = `Q${m.quarter} · ${m.label}`;
    const k = `m${m.fiscalMonth}`;
    return [
      { key: `${k}_sales`, header: "Sales", group: g, format: "money" },
      { key: `${k}_ytdt`, header: "YTD Target", group: g, format: "money" },
      { key: `${k}_ytdp`, header: "YTD %", group: g, format: "pct", color: "rag" },
      { key: `${k}_tgt`, header: "Target", group: g, format: "money" },
      { key: `${k}_pct`, header: "%", group: g, format: "pct", color: "rag" },
    ] as MatrixColumn[];
  });
  const fyCells: Record<string, number | null> = {};
  for (const m of fyMonths) {
    const k = `m${m.fiscalMonth}`;
    fyCells[`${k}_sales`] = m.sales;
    fyCells[`${k}_ytdt`] = m.dailyTargetYtd;
    fyCells[`${k}_ytdp`] = m.ytdAchievement;
    fyCells[`${k}_tgt`] = m.target;
    fyCells[`${k}_pct`] = m.achievement;
  }
  const fyRows: MatrixRow[] = [{ id: "fy", label: fiscalYearLabel(fy), cells: fyCells }];

  // ── Sales by Brands & Products (Brand → Product, Sales | Quantity) ──
  const brandProduct = buildSalesQtyMatrix(
    data.brandProduct,
    data.brandProductGrand,
    data.quarterGroups,
    data.multiMonthQuarters,
    startMonth,
    data.brandProductChildren,
  );

  // ── Sales by Representative (Sales | Quantity per month + total) ──
  const repsSQ = buildSalesQtyMatrix(data.reps, data.repsGrand, data.quarterGroups, data.multiMonthQuarters, startMonth);

  // ── Sales & Target by Representative (Sales | Target | Behind) ──
  const repsSTB = buildSalesTargetBehindMatrix(data.repsST, data.repsSTGrand, data.quarterGroups, data.multiMonthQuarters, startMonth);

  // ── RIO'S VIEW — Daily Sales & Target by Representative (Month → Date → Rep → Customer) ──
  const dailyCols: MatrixColumn[] = [
    { key: "sales", header: "Sales", format: "money" },
    { key: "target", header: "Target", format: "money" },
    { key: "behind", header: "Behind", format: "money", color: "behind" },
  ];
  const dailyRows: MatrixRow[] = data.dailyMonths.map((dm) => ({
    id: `dm${dm.fiscalMonth}`,
    label: fiscalMonthLabel(dm.fiscalMonth, startMonth),
    cells: { sales: dm.sales, target: dm.target, behind: dm.sales - dm.target },
    children: dm.dates.map((dd) => ({
      id: `dm${dm.fiscalMonth}-${dd.date}`,
      label: dd.label,
      cells: { sales: dd.sales, target: dd.target, behind: dd.sales - dd.target },
      children: dd.reps.map((dr) => ({
        id: `dm${dm.fiscalMonth}-${dd.date}-${dr.rep}`,
        label: dr.rep,
        cells: { sales: dr.sales, target: dr.target, behind: dr.sales - dr.target },
        children: dr.customers.map((dc) => ({
          id: `dm${dm.fiscalMonth}-${dd.date}-${dr.rep}-${dc.customer}`,
          label: dc.customer,
          cells: { sales: dc.sales, target: dc.target, behind: dc.sales - dc.target },
        })),
      })),
    })),
  }));
  dailyRows.push({
    id: "__grand",
    label: "Total",
    isTotal: true,
    cells: { sales: data.dailyGrand.sales, target: data.dailyGrand.target, behind: data.dailyGrand.sales - data.dailyGrand.target },
  });

  // ── RIO'S VIEW — Top 5 Behind Customer per Rep (Rep → Customer) ──
  const behindCols: MatrixColumn[] = [
    { key: "sales", header: "Sales", format: "money" },
    { key: "target", header: "Target", format: "money" },
    { key: "behind", header: "Behind", format: "money", color: "behind" },
  ];
  const behindRows: MatrixRow[] = data.top5Behind
    .filter((g) => g.rows.length > 0)
    .map((g) => {
      const s = g.rows.reduce((a, r) => a + r.sales, 0);
      const t = g.rows.reduce((a, r) => a + r.target, 0);
      return {
        id: `rep:${g.rep}`,
        label: g.rep,
        cells: { sales: s, target: t, behind: s - t },
        children: g.rows.map((r) => ({
          id: `rep:${g.rep}-${r.customer}`,
          label: r.customer,
          cells: { sales: r.sales, target: r.target, behind: r.behind },
        })),
      };
    });

  return (
    <div className="space-y-5">
      {header}

      <ReportCard title="SALES AND TARGET PER FISCAL YEAR">
        <PivotMatrix columns={fyCols} rows={fyRows} labelHeader="Year" defaultExpanded />
      </ReportCard>

      <ReportCard title="SALES BY BRANDS AND PRODUCTS">
        <PivotMatrix columns={brandProduct.columns} rows={brandProduct.rows} labelHeader="Brand / Product" />
      </ReportCard>

      <ReportCard title="SALES BY REPRESENTATIVE">
        <PivotMatrix columns={repsSQ.columns} rows={repsSQ.rows} labelHeader="SalesRep" />
      </ReportCard>

      {/* RIO'S VIEW band (brand pink) */}
      <div className="rounded-xl py-3 text-center text-sm font-bold uppercase tracking-[0.2em] text-white shadow-sm" style={{ background: "#D91C5C" }}>
        Rio&apos;s View
      </div>

      <ReportCard title="SALES & TARGET BY REPRESENTATIVE">
        <PivotMatrix columns={repsSTB.columns} rows={repsSTB.rows} labelHeader="SalesRep" />
      </ReportCard>

      <ReportCard title="DAILY SALES & TARGET BY REPRESENTATIVE">
        <PivotMatrix columns={dailyCols} rows={dailyRows} labelHeader="MonthShort / Date / Rep / Customer" maxHeight={620} />
      </ReportCard>

      <ReportCard title="TOP 5 BEHIND CUSTOMER PER REP">
        {behindRows.length ? (
          <PivotMatrix columns={behindCols} rows={behindRows} labelHeader="SalesRep / Customer" defaultExpanded />
        ) : (
          <p className="py-6 text-center text-xs text-gray-400">No customers behind target.</p>
        )}
      </ReportCard>

      <p className="pt-1 pb-3 text-center text-xs text-gray-400">© {new Date().getFullYear()} KRDM. Confidential and proprietary.</p>
    </div>
  );
}
