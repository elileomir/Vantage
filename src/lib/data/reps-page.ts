// Server-side data layer for the Sales Representative Analysis page.
// Composes the existing filter-aware aggregation API (agg.ts) + the executive rep logic
// — no new RPCs. Mirrors the Power BI measures for that page:
//   _SUM_AMOUNT (per rep / per product), ACHIEVE R 100% (sales ÷ prorated YTD target),
//   REPRESENTATIVE_SALES_PARETO / PRODUCT_SALES_PARETO (cumulative share),
//   YTD Growth vs Last Year (Previous YTD Aligned), Global YTD Sales vs Target Variance.

import { createClient } from "@/lib/supabase/server";
import { type Filters } from "@/lib/filters";
import {
  salesAgg,
  salesByDimMonth,
  targetByDimMonth,
  prevYtdAlignedBy,
  fetchAllFacts,
} from "@/lib/data/agg";
import type { DecompNode } from "@/components/charts/decomp-tree";

const n = (v: unknown): number => (v == null ? 0 : Number(v));

const rand = (v: number): string => (v < 0 ? "-R" : "R") + Math.round(Math.abs(v)).toLocaleString("en-ZA");

// One raw fact row used to build the 4-level Brand → Product → SalesRep → Customer trees.
interface FactRow {
  brand: string;
  product: string;
  sales_representative: string;
  customer_name: string;
  amount: number;
}

// Cap of children kept per node at every level — keeps the tree performant while matching
// PBI's "top N" drill behaviour. Children are ranked by |value| desc before capping.
const TOP_PER_LEVEL = 12;

// Nest bounded fact rows into a 4-level DecompNode (Brand → Product → SalesRep → Customer).
// `value` for each node = SUM(amount) over its descendant rows. When a parallel LY map is
// supplied, each node's name is annotated with the CY/LY label ("CY: R… | LY: R…") so the
// PBI "LYTD VS CYTD SALES LABEL" surfaces in the node title (DecompositionTree is read-only).
function buildFourLevelTree(
  rootName: string,
  rows: FactRow[],
  opts: { lyRows?: FactRow[]; rootValue?: number; dims?: (keyof FactRow)[] } = {},
): DecompNode {
  const dims: (keyof FactRow)[] = opts.dims ?? ["brand", "product", "sales_representative", "customer_name"];

  // Recursively group rows by the dimension at `depth`, summing amount and ranking/capping children.
  function group(subset: FactRow[], depth: number): { nodes: DecompNode[]; total: number } {
    if (depth >= dims.length) return { nodes: [], total: subset.reduce((a, r) => a + r.amount, 0) };
    const buckets = new Map<string, FactRow[]>();
    for (const r of subset) {
      const key = (r[dims[depth]] as string) || "Unknown";
      const list = buckets.get(key) ?? [];
      list.push(r);
      buckets.set(key, list);
    }
    const nodes: DecompNode[] = [];
    for (const [name, list] of buckets) {
      const isLeaf = depth === dims.length - 1;
      const childGroup = isLeaf ? { nodes: undefined, total: list.reduce((a, r) => a + r.amount, 0) } : group(list, depth + 1);
      nodes.push({ name, value: childGroup.total, children: childGroup.nodes });
    }
    nodes.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    return { nodes: nodes.slice(0, TOP_PER_LEVEL), total: nodes.reduce((a, x) => a + x.value, 0) };
  }

  const { nodes, total } = group(rows, 0);

  // Annotate every node with the CY/LY label when LY rows are available. We re-key the LY rows
  // by the same dim path so each node can show "CY: R… | LY: R…" via its name suffix.
  if (opts.lyRows && opts.lyRows.length) {
    const lyTotalByPath = new Map<string, number>();
    for (const r of opts.lyRows) {
      let path = "";
      for (let d = 0; d < dims.length; d++) {
        path += "›" + ((r[dims[d]] as string) || "Unknown");
        lyTotalByPath.set(path, (lyTotalByPath.get(path) ?? 0) + r.amount);
      }
    }
    const annotate = (node: DecompNode, path: string) => {
      const key = path + "›" + node.name;
      const ly = lyTotalByPath.get(key) ?? 0;
      node.name = `${node.name}  ·  CY: ${rand(node.value)} | LY: ${rand(ly)}`;
      if (node.children) for (const c of node.children) annotate(c, key);
    };
    for (const node of nodes) annotate(node, "");
  }

  return { name: rootName, value: opts.rootValue ?? total, children: nodes };
}

// Fetch a bounded set of fact rows (filter-aware) for the 4-level trees.
async function fetchFactRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fy: string,
  filters: Filters,
): Promise<FactRow[]> {
  const data = await fetchAllFacts(supabase, {
    columns: "brand, product, sales_representative, customer_name, amount",
    fiscalYear: fy,
    filters,
  });
  return (data as Record<string, unknown>[]).map((r) => ({
    brand: String(r.brand ?? "Unknown"),
    product: String(r.product ?? "Unknown"),
    sales_representative: String(r.sales_representative ?? "Unassigned"),
    customer_name: String(r.customer_name ?? "Unknown"),
    amount: n(r.amount),
  }));
}

// Prior fiscal-year label, day-aligned cutoff (asof − 12 months). PBI aligns LY by the same
// day-of-fiscal-year window (Previous YTD Aligned), so we bound the prior-FY rows at that date.
function priorFy(fy: string): string {
  const m = fy.match(/(\d{4})/);
  return m ? fy.replace(m[1], String(Number(m[1]) - 1)) : fy;
}
function minusOneYear(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

async function fetchPriorYearFactRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fy: string,
  asOf: string | null,
  filters: Filters,
): Promise<FactRow[]> {
  const lyFy = priorFy(fy);
  const lyCutoff = minusOneYear(asOf);
  // Drop the fy filter (we override it) and re-apply the rest of the slicers to the prior FY.
  const { fy: _fy, ...rest } = filters;
  void _fy;
  const data = await fetchAllFacts(supabase, {
    columns: "brand, product, sales_representative, customer_name, amount, sale_date",
    fiscalYear: lyFy,
    filters: rest,
    extra: lyCutoff ? (q) => q.lte("sale_date", lyCutoff) : undefined,
  });
  return (data as Record<string, unknown>[]).map((r) => ({
    brand: String(r.brand ?? "Unknown"),
    product: String(r.product ?? "Unknown"),
    sales_representative: String(r.sales_representative ?? "Unassigned"),
    customer_name: String(r.customer_name ?? "Unknown"),
    amount: n(r.amount),
  }));
}

export interface RepStat {
  rep: string;
  sales: number; // _SUM_AMOUNT
  target: number; // DAILY_TARGET_YTD (Sales Aligned) — prorated YTD target
  achievement: number | null; // ACHIEVE R 100%
  lySales: number | null; // Previous YTD Aligned
  growth: number | null; // YTD Growth vs Last Year
  variance: number; // Global YTD Sales vs Target Variance (sales - target)
}
export interface RankStat {
  name: string;
  value: number;
}
export interface RepsPageData {
  fy: string;
  asOf: string | null;
  hasData: boolean;
  hasPriorYear: boolean;
  reps: RepStat[]; // sorted by sales desc
  products: RankStat[]; // sorted by sales desc
  totals: { sales: number; target: number; lySales: number | null };
  // Decomposition tree roots (pre-nested, ranked) for the three PBI decomposition visuals.
  // Trees A & B are 4-level Representative → Customer → Brand → Product (PBI drill order).
  actualByRep: DecompNode; // _SUM_AMOUNT → Rep → Customer → Brand → Product
  growthByRep: DecompNode; // YTD Growth vs Last Year → Rep → Customer → Brand → Product (CY/LY labelled)
  varianceByRep: DecompNode; // Global YTD Sales vs Target Variance → Rep (variance)
}

export async function getRepsPageData(fy: string, filters: Filters = {}): Promise<RepsPageData> {
  const supabase = await createClient();

  // Report as-of (last sale date, FY-scoped) — anchors the prorated YTD target + day-aligned prior-YTD window.
  const asOf =
    (
      await supabase
        .from("v_sales_fact")
        .select("sale_date")
        .eq("fiscal_year", fy)
        .order("sale_date", { ascending: false })
        .limit(1)
    ).data?.[0]?.sale_date ?? null;

  const [repSales, repTgt, productAgg, repLy, factRows, lyFactRows] = await Promise.all([
    salesByDimMonth(supabase, fy, "sales_representative", filters),
    targetByDimMonth(supabase, fy, "sales_representative", filters),
    salesAgg(supabase, fy, "product", filters),
    asOf ? prevYtdAlignedBy(supabase, fy, asOf, "sales_representative", filters) : Promise.resolve([]),
    fetchFactRows(supabase, fy, filters),
    asOf ? fetchPriorYearFactRows(supabase, fy, asOf, filters) : Promise.resolve([]),
  ]);

  // Working-day prorated per-rep YTD target (PBI ACHIEVE R 100% denominator), filter-aware via slicers.
  // ytd_target_aligned_by(p_dim='rep') returns the full per-rep prorated target; fall back to the
  // sales-aligned month sum when the RPC is unavailable.
  const aligned = new Set<number>();
  for (const r of repSales) if (r.sales > 0) aligned.add(r.fiscal_month);

  const repProrated = new Map<string, number>();
  if (asOf) {
    const { data: tg } = await supabase.rpc("ytd_target_aligned_by", { p_fy: fy, p_asof: asOf, p_dim: "rep" });
    for (const r of (tg ?? []) as { key: string; target: number }[]) repProrated.set(r.key, n(r.target));
  }

  const rs = new Map<string, number>();
  const rtFallback = new Map<string, number>();
  for (const r of repSales) {
    const rep = r.dim || "Unassigned";
    rs.set(rep, (rs.get(rep) ?? 0) + r.sales);
  }
  for (const r of repTgt) {
    if (!aligned.has(r.fiscal_month)) continue;
    const rep = r.dim || "Unassigned";
    rtFallback.set(rep, (rtFallback.get(rep) ?? 0) + r.target);
  }
  const rl = new Map<string, number>();
  for (const r of repLy) if (r.dim) rl.set(r.dim, r.sales);

  const hasPriorYear = repLy.some((r) => r.sales > 0) || lyFactRows.some((r) => r.amount > 0);

  const reps: RepStat[] = [...rs.keys()]
    .map((rep) => {
      const sales = rs.get(rep) ?? 0;
      const target = repProrated.get(rep) ?? rtFallback.get(rep) ?? 0;
      const ly = rl.get(rep);
      const lySales = ly != null && ly > 0 ? ly : null;
      return {
        rep,
        sales,
        target,
        achievement: target > 0 ? sales / target : null,
        lySales,
        growth: lySales != null ? (sales - lySales) / lySales : null,
        variance: sales - target,
      };
    })
    .filter((r) => r.sales !== 0 || r.target !== 0)
    .sort((a, b) => b.sales - a.sales);

  const products: RankStat[] = productAgg
    .filter((p) => p.dim)
    .map((p) => ({ name: p.dim, value: p.sales }));

  const totalSales = reps.reduce((a, r) => a + r.sales, 0);
  const totalTarget = reps.reduce((a, r) => a + r.target, 0);
  const totalLy = hasPriorYear ? reps.reduce((a, r) => a + (r.lySales ?? 0), 0) : null;

  // ── Decomposition trees (pre-nested DecompNode, ranked) ──────────────────
  // PBI drill order on this page: Representative → Customer → Brand → Product.
  const REP_FIRST: (keyof FactRow)[] = ["sales_representative", "customer_name", "brand", "product"];

  // a) Actual Sales (_SUM_AMOUNT) → Rep → Customer → Brand → Product (4-level).
  const actualByRep: DecompNode = buildFourLevelTree("Sales", factRows, { rootValue: totalSales, dims: REP_FIRST });

  // b) YTD Growth vs Last Year → Rep → Customer → Brand → Product (4-level).
  //    Root = current − LY when prior-year data exists; otherwise current YTD (graceful degradation).
  //    Every node carries the LYTD-vs-CYTD label ("CY: R… | LY: R…") via its name when LY is present.
  const lyTotal = lyFactRows.reduce((a, r) => a + r.amount, 0);
  const growthRoot = hasPriorYear ? totalSales - lyTotal : totalSales;
  const growthByRep: DecompNode = buildFourLevelTree(
    hasPriorYear ? "YTD Growth vs Last Year" : "Current YTD Sales",
    factRows,
    { rootValue: growthRoot, lyRows: hasPriorYear ? lyFactRows : undefined, dims: REP_FIRST },
  );

  // c) Actual vs YTD Target Variance by Representative: root variance, → Rep (sales - target per rep).
  const varianceByRep: DecompNode = {
    name: "YTD Sales vs Target Variance",
    value: totalSales - totalTarget,
    children: reps.map((r) => ({ name: r.rep, value: r.variance })),
  };

  return {
    fy,
    asOf,
    hasData: totalSales !== 0,
    hasPriorYear,
    reps,
    products,
    totals: { sales: totalSales, target: totalTarget, lySales: totalLy },
    actualByRep,
    growthByRep,
    varianceByRep,
  };
}
