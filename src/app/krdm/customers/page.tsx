export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import {
  getActiveFiscalYear,
  getAsOfLabel,
  getFiscalStartMonth,
  fiscalYearLabel,
} from "@/lib/data/queries";
import { parseFilters } from "@/lib/filters";
import { getCustomerAnalysis } from "@/lib/data/customers-page";
import { ReportHeader } from "@/components/report-header";
import { EmptyState } from "@/components/empty-state";
import { CustomerMatrixView } from "./_components/customer-matrix-view";

export default async function CustomerAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const fy = filters.fy ?? (await getActiveFiscalYear());
  const supabase = await createClient();
  const startMonth = await getFiscalStartMonth();

  // The page is ONE Power BI matrix (SalesRep → Brand → Customer × Month), sourced from the
  // SQL-aggregated get_customer_matrix RPC (filter-aware, tiny payload — immune to the 1000-row cap).
  const [matrix, asOf] = await Promise.all([
    getCustomerAnalysis(supabase, fy, filters, startMonth),
    getAsOfLabel(fy),
  ]);

  const header = (
    <ReportHeader title="CUSTOMER ANALYSIS" subtitle={`KRDM Stainless Steel Solutions · FY ${fiscalYearLabel(fy)}`} asOf={asOf.replace(/^Data as of\s*/i, "")} />
  );

  if (!matrix.hasData) {
    return (
      <div className="space-y-5">
        {header}
        <EmptyState
          title="No customer sales yet"
          message="Run the CIN7 sync or import a sales workbook to populate this page."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}
      <CustomerMatrixView
        reps={matrix.reps}
        months={matrix.months}
        fyLabel={matrix.fyLabel}
        monthTotals={matrix.monthTotals}
        grandTotal={matrix.grandTotal}
      />
    </div>
  );
}
