"use client";

import type { CustomerData } from "@/lib/data/vantage";

function formatZAR(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function TopCustomers({ data }: { data: CustomerData[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-[--radius-md] border border-dashed border-[--color-border] px-4 py-8 text-center text-sm text-[--color-fg-subtle]">
        No customer revenue data available for the selected filters.
      </div>
    );
  }

  const maxTotal = Math.max(...data.map((c) => c.total));

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Customer</th>
            <th className="text-right">Amount</th>
            <th className="text-right">Tax</th>
            <th className="text-right">Total</th>
            <th className="w-28">Share</th>
          </tr>
        </thead>
        <tbody>
          {data.map((c, i) => (
            <tr key={c.customer}>
              <td className="text-[--color-fg-faint] font-medium w-10">
                {i + 1}
              </td>
              <td className="font-medium text-[--color-fg] max-w-[200px] truncate">
                {c.customer}
              </td>
              <td className="text-right tabular-nums text-[--color-fg-muted]">
                {formatZAR(c.amount)}
              </td>
              <td className="text-right tabular-nums text-[--color-fg-subtle]">
                {formatZAR(c.tax)}
              </td>
              <td className="text-right tabular-nums font-semibold text-[--color-fg]">
                {formatZAR(c.total)}
              </td>
              <td>
                <div className="progress-track">
                  <div
                    className="progress-fill bg-[--color-accent]"
                    style={{ width: `${(c.total / maxTotal) * 100}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
