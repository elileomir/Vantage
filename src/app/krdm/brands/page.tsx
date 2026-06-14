export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getActiveFiscalYear, fiscalYearLabel, getAsOfLabel } from "@/lib/data/queries";
import { parseFilters } from "@/lib/filters";
import { getBrandsPageData } from "@/lib/data/brands-page";
import { RankingBar } from "@/components/charts/echarts";
import { KRDM } from "@/components/charts/theme";
import { DecompositionTree } from "@/components/charts/decomp-tree";
import { ReportHeader } from "@/components/report-header";
import { ReportCard } from "@/components/report-card";
import { EmptyState } from "@/components/empty-state";
import { ParetoWithSlider } from "./_components/pareto-with-slider";

export default async function BrandProductPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const supabase = await createClient();
  const fy = filters.fy ?? (await getActiveFiscalYear());

  const [data, asOf] = await Promise.all([
    getBrandsPageData(supabase, fy, filters),
    getAsOfLabel(fy),
  ]);

  const asOfDate = asOf.replace(/^Data as of\s*/i, "");
  const header = (
    <ReportHeader title="BRANDS & PRODUCTS ANALYSIS" subtitle={`KRDM Stainless Steel Solutions · FY ${fiscalYearLabel(fy)}`} asOf={asOfDate} />
  );

  if (!data.hasData) {
    return (
      <div className="space-y-5">
        {header}
        <EmptyState title="No brand data" message="Run the CIN7 sync or import a sales workbook to populate this page." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      {/* PARAM_PARETO what-if slider + the threshold-driven Pareto visuals.
          Static siblings (Top Brands, Top Products, decomposition tree, totals)
          are rendered server-side and handed to the client island as slots. */}
      <ParetoWithSlider
        brandPareto={data.brandPareto}
        brandCount={data.brandCount}
        productMatrix={data.productMatrix}
        totalBrands={data.totalBrands}
        totalProducts={data.totalProducts}
        topBrandsSlot={
          <ReportCard title="TOP 5 BRANDS BY SALES">
            <RankingBar data={data.topBrands.slice(0, 5)} color={KRDM.cyan} height={320} />
          </ReportCard>
        }
        topProductsSlot={
          <ReportCard title="TOP 10 PRODUCTS BY SALES">
            <RankingBar data={data.topProducts} color={KRDM.cyan} height={360} />
          </ReportCard>
        }
        treeSlot={
          <ReportCard title="SALES BY BRAND AND PRODUCT" subtitle="Drill from total sales through brand to product">
            <DecompositionTree root={data.tree} levels={["Brand", "Product"]} rootLabel="Sales" />
          </ReportCard>
        }
      />
    </div>
  );
}
