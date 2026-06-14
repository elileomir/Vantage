// Page-specific data composition for the Brand & Product Analysis page.
// Composes the existing filter-aware aggregation API (salesAgg / salesKpis / salesByTwoDims)
// into the exact shapes the ECharts wrappers + DecompositionTree need. No new RPCs.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Filters } from "@/lib/filters";
import { salesAgg, salesKpis, salesByTwoDims, withPareto } from "@/lib/data/agg";
import type { DecompNode } from "@/components/charts/decomp-tree";

export interface BrandsPageData {
  hasData: boolean;
  totalSales: number;
  totalBrands: number;
  totalProducts: number;
  /** Top 10 brands by sales — RankingBar shape. */
  topBrands: { name: string; value: number }[];
  /** Top 10 products by sales — RankingBar shape. */
  topProducts: { name: string; value: number }[];
  /** All brands by sales — Pareto wrapper computes the cumulative line itself. */
  brandPareto: { name: string; value: number }[];
  /** Count of brands inside the 80% threshold (for the subtitle blurb). */
  brandsInThreshold: number;
  brandCount: number;
  /** Top ~20 products with cumulative share — PivotMatrix rows. */
  productMatrix: {
    product: string;
    sales: number;
    quantity: number;
    cumulative: number;
    inThreshold: boolean;
  }[];
  /** _SUM_AMOUNT -> Brand -> Product nested tree for the decomposition visual. */
  tree: DecompNode;
}

const PARETO_THRESHOLD = 0.8;

/** Build the Brand -> Product nested DecompNode tree from one (brand × product) query. */
function buildBrandProductTree(
  rows: { k1: string; k2: string; sales: number }[],
  totalSales: number,
  topBrands = 12,
  topProductsPerBrand = 10,
): DecompNode {
  const byBrand = new Map<string, { total: number; products: Map<string, number> }>();
  for (const r of rows) {
    const brand = r.k1 || "Unknown";
    const product = r.k2 || "Unknown";
    const entry = byBrand.get(brand) ?? { total: 0, products: new Map<string, number>() };
    entry.total += r.sales;
    entry.products.set(product, (entry.products.get(product) ?? 0) + r.sales);
    byBrand.set(brand, entry);
  }

  const children: DecompNode[] = [...byBrand.entries()]
    .map(([name, e]) => ({
      name,
      value: e.total,
      children: [...e.products.entries()]
        .map(([pName, value]) => ({ name: pName, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, topProductsPerBrand),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topBrands);

  return { name: "Sales", value: totalSales, children };
}

function truncate(label: string, max: number): string {
  return label.length > max ? label.slice(0, max - 1) + "…" : label;
}

export async function getBrandsPageData(
  supabase: SupabaseClient,
  fy: string,
  filters: Filters,
): Promise<BrandsPageData> {
  const [brands, products, kpis, brandProductRows] = await Promise.all([
    salesAgg(supabase, fy, "brand", filters),
    salesAgg(supabase, fy, "product", filters),
    salesKpis(supabase, fy, filters),
    salesByTwoDims(supabase, fy, "brand", "product", filters),
  ]);

  const brandRows = brands.filter((b) => b.dim);
  const productRows = products.filter((p) => p.dim);

  const topBrands = brandRows.slice(0, 10).map((b) => ({ name: truncate(b.dim, 28), value: b.sales }));
  const topProducts = productRows.slice(0, 10).map((p) => ({ name: truncate(p.dim, 30), value: p.sales }));

  const brandPareto = brandRows.map((b) => ({ name: truncate(b.dim, 16), value: b.sales }));
  const brandsInThreshold = withPareto(brandRows, PARETO_THRESHOLD).filter((b) => b.inThreshold).length;

  const productMatrix = withPareto(productRows.slice(0, 20), PARETO_THRESHOLD).map((p) => ({
    product: p.dim,
    sales: p.sales,
    quantity: p.quantity,
    cumulative: p.cumulative,
    inThreshold: p.inThreshold,
  }));

  const tree = buildBrandProductTree(brandProductRows, kpis.sales);

  return {
    hasData: kpis.sales !== 0 || brandRows.length > 0,
    totalSales: kpis.sales,
    totalBrands: kpis.brands,
    totalProducts: kpis.products,
    topBrands,
    topProducts,
    brandPareto,
    brandsInThreshold,
    brandCount: brandRows.length,
    productMatrix,
    tree,
  };
}
