// Server-rendered detail tables for the Daily page (PBI tableEx visuals).
// Pure presentational — no client interactivity. Uses the shared .data-table styling and
// RAG colouring (ragColor) to match the Power BI register.

import { rand, count, percent } from "@/lib/format";
import { ragColor } from "@/components/charts/theme";
import type {
  DailyPoint,
  CustomerDetailRow,
  ProductDetailRow,
  BrandSlice,
} from "@/lib/data/daily-page";

function fmtRowDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

/** Daily table: Date | _SUM_AMOUNT | DAILY_TARGET | DAILY_ACHIEVEMENT (RAG). */
export function DailyTable({ rows, monthTotal, totalTarget }: { rows: DailyPoint[]; monthTotal: number; totalTarget: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th className="text-right">Sales</th>
            <th className="text-right">Daily Target</th>
            <th className="text-right">Achievement</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.date}>
              <td><span className="font-medium text-gray-900">{fmtRowDate(d.date)}</span></td>
              <td className="text-right tabular-nums">{rand(d.sales)}</td>
              <td className="text-right tabular-nums text-gray-500">{d.dailyTarget > 0 ? rand(d.dailyTarget) : "—"}</td>
              <td className="text-right font-medium tabular-nums" style={{ color: d.achievement == null ? "#9ca3af" : ragColor(d.achievement) }}>
                {d.achievement == null ? "—" : percent(d.achievement)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td><span className="font-semibold text-gray-900">Total</span></td>
            <td className="text-right font-semibold tabular-nums text-gray-900">{rand(monthTotal)}</td>
            <td className="text-right font-semibold tabular-nums text-gray-900">{totalTarget > 0 ? rand(totalTarget) : "—"}</td>
            <td className="text-right font-semibold tabular-nums text-gray-900">{totalTarget > 0 ? percent(monthTotal / totalTarget) : "—"}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Customer detail: Customer | Rep | _SUM_AMOUNT | _SUM_TAX | _SUM_TOTAL. */
export function CustomerTable({ rows, limit = 50 }: { rows: CustomerDetailRow[]; limit?: number }) {
  const shown = rows.slice(0, limit);
  const totals = rows.reduce((a, r) => ({ s: a.s + r.sales, t: a.t + r.tax, g: a.g + r.total }), { s: 0, t: 0, g: 0 });
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Representative</th>
            <th className="text-right">Sales</th>
            <th className="text-right">Tax</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={`${r.customer}|${r.rep}`}>
              <td><span className="font-medium text-gray-900">{r.customer}</span></td>
              <td className="text-gray-500">{r.rep}</td>
              <td className="text-right tabular-nums">{rand(r.sales)}</td>
              <td className="text-right tabular-nums text-gray-500">{rand(r.tax)}</td>
              <td className="text-right tabular-nums text-gray-500">{rand(r.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}><span className="font-semibold text-gray-900">Total</span></td>
            <td className="text-right font-semibold tabular-nums text-gray-900">{rand(totals.s)}</td>
            <td className="text-right font-semibold tabular-nums text-gray-900">{rand(totals.t)}</td>
            <td className="text-right font-semibold tabular-nums text-gray-900">{rand(totals.g)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Brand detail: Brand | _SUM_AMOUNT. */
export function BrandTable({ rows }: { rows: BrandSlice[] }) {
  const total = rows.reduce((a, r) => a + r.sales, 0);
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Brand</th>
            <th className="text-right">Sales</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td><span className="font-medium text-gray-900">{r.name}</span></td>
              <td className="text-right tabular-nums">{rand(r.sales)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td><span className="font-semibold text-gray-900">Total</span></td>
            <td className="text-right font-semibold tabular-nums text-gray-900">{rand(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Product detail: Product | Brand | SKU | Rep | _SUM_AMOUNT | QUANTITY. */
export function ProductTable({ rows, limit = 50 }: { rows: ProductDetailRow[]; limit?: number }) {
  const shown = rows.slice(0, limit);
  const totals = rows.reduce((a, r) => ({ s: a.s + r.sales, q: a.q + r.quantity }), { s: 0, q: 0 });
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Brand</th>
            <th>SKU</th>
            <th>Representative</th>
            <th className="text-right">Sales</th>
            <th className="text-right">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={`${r.product}|${r.sku}|${r.rep}|${i}`}>
              <td><span className="font-medium text-gray-900">{r.product}</span></td>
              <td className="text-gray-500">{r.brand}</td>
              <td className="text-gray-500">{r.sku || "—"}</td>
              <td className="text-gray-500">{r.rep}</td>
              <td className="text-right tabular-nums">{rand(r.sales)}</td>
              <td className="text-right tabular-nums text-gray-500">{count(r.quantity)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}><span className="font-semibold text-gray-900">Total</span></td>
            <td className="text-right font-semibold tabular-nums text-gray-900">{rand(totals.s)}</td>
            <td className="text-right font-semibold tabular-nums text-gray-900">{count(totals.q)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
