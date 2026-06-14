"use client";

// Interactive PARAM_PARETO threshold control — replicates the PBI what-if slider, inline in the
// "Pareto Analysis of Sales Revenue by Brand" card (with an "About Pareto" popover), exactly like
// the Power BI page. Drives the Brand Pareto bar colouring + the Product Pareto table cumulative-%
// colouring reactively (source data passed in as props — no server round-trip).

import { useMemo, useState } from "react";
import { Pareto } from "@/components/charts/echarts";
import { KRDM } from "@/components/charts/theme";
import { PivotMatrix, type MatrixColumn, type MatrixRow } from "@/components/charts/pivot-matrix";
import { ParetoInfo } from "./pareto-info";
import { ReportCard } from "@/components/report-card";
import { rand, percent, count } from "@/lib/format";

type ParetoDatum = { name: string; value: number };
type ProductRow = { product: string; sales: number; quantity: number; cumulative: number };

const DEFAULT_THRESHOLD = 0.8;

/** Count members inside the threshold (cumulative-share-before-add < threshold). */
function brandsInThresholdFor(data: ParetoDatum[], threshold: number): number {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((acc, d) => acc + Math.max(0, d.value), 0) || 1;
  let run = 0, n = 0;
  for (const d of sorted) {
    if (run / total < threshold) n += 1;
    run += Math.max(0, d.value);
  }
  return n;
}

function ParetoControl({ threshold, setThreshold, brandsInThreshold, brandCount }: {
  threshold: number; setThreshold: (v: number) => void; brandsInThreshold: number; brandCount: number;
}) {
  const [info, setInfo] = useState(false);
  const pct = Math.round(threshold * 100);
  return (
    <div className="relative flex items-center gap-2.5">
      <span className="rounded-md bg-black/[0.05] px-2 py-1 text-xs font-semibold tabular-nums text-gray-600">{(threshold * 100).toFixed(2)}%</span>
      <input
        type="range" min={0} max={100} step={5} value={pct}
        onChange={(e) => setThreshold(Number(e.target.value) / 100)}
        aria-label="Pareto threshold"
        className="h-1.5 w-32 cursor-pointer appearance-none rounded-full"
        style={{ accentColor: "#1FA8C9", background: "#1FA8C926" }}
      />
      <button
        onClick={() => setInfo((o) => !o)}
        className="rounded-full px-3 py-1 text-xs font-semibold text-white transition"
        style={{ background: "#1FA8C9" }}
      >
        About Pareto
      </button>
      {info && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setInfo(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-[300px] rounded-xl border border-black/10 bg-white p-4 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18)]">
            <ParetoInfo threshold={threshold} brandsInThreshold={brandsInThreshold} brandCount={brandCount} />
          </div>
        </>
      )}
    </div>
  );
}

function TotalCard({ label, value }: { label: string; value: number }) {
  return (
    <section className="flex flex-col items-center justify-center rounded-2xl border border-black/[0.06] bg-white p-6 text-center shadow-sm" style={{ borderLeft: "4px solid #1d6baf" }}>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1f4e6b]">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-[#0f2a43]">{count(value)}</p>
    </section>
  );
}

export function ParetoWithSlider({
  brandPareto, brandCount, productMatrix, totalBrands, totalProducts,
  topBrandsSlot, topProductsSlot, treeSlot,
}: {
  brandPareto: ParetoDatum[];
  brandCount: number;
  productMatrix: ProductRow[];
  totalBrands: number;
  totalProducts: number;
  topBrandsSlot: React.ReactNode;
  topProductsSlot: React.ReactNode;
  treeSlot: React.ReactNode;
}) {
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const brandsInThreshold = useMemo(() => brandsInThresholdFor(brandPareto, threshold), [brandPareto, threshold]);

  const matrixColumns: MatrixColumn[] = useMemo(() => [
    { key: "sales", header: "Sales", align: "right", bar: true, format: (v) => rand(Number(v)) },
    { key: "quantity", header: "Quantity", align: "right", format: (v) => count(Number(v)) },
    {
      key: "cumulative", header: "Cumulative % of Total Sales", align: "right",
      format: (v) => percent(Number(v)),
      color: (v) => (Number(v) <= threshold ? KRDM.cyan : KRDM.greyText),
    },
  ], [threshold]);
  const matrixRows: MatrixRow[] = useMemo(() => productMatrix.map((p, i) => ({
    id: `${p.product}-${i}`, label: p.product, cells: { sales: p.sales, quantity: p.quantity, cumulative: p.cumulative },
  })), [productMatrix]);

  return (
    <div className="space-y-5">
      {/* Row 1 — Top 5 brands + Brand Pareto (slider + About Pareto inline) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {topBrandsSlot}
        <ReportCard
          title="PARETO ANALYSIS OF SALES REVENUE BY BRAND"
          action={<ParetoControl threshold={threshold} setThreshold={setThreshold} brandsInThreshold={brandsInThreshold} brandCount={brandCount} />}
        >
          <Pareto data={brandPareto} threshold={threshold} />
        </ReportCard>
      </div>

      {/* Row 2 — Top 10 products + Product Pareto table */}
      <div className="grid gap-4 lg:grid-cols-2">
        {topProductsSlot}
        <ReportCard title="PARETO ANALYSIS OF SALES REVENUE BY PRODUCT" subtitle={`${brandsInThreshold} of ${brandCount} brands drive ${Math.round(threshold * 100)}% of revenue`}>
          <PivotMatrix columns={matrixColumns} rows={matrixRows} labelHeader="Product" maxHeight={380} />
        </ReportCard>
      </div>

      {/* Row 3 — TOTAL BRAND / TOTAL PRODUCTS + Sales by Brand and Product tree */}
      <div className="grid gap-4 lg:grid-cols-[210px_1fr]">
        <div className="grid grid-rows-2 gap-4">
          <TotalCard label="Total Brand" value={totalBrands} />
          <TotalCard label="Total Products" value={totalProducts} />
        </div>
        {treeSlot}
      </div>
    </div>
  );
}
