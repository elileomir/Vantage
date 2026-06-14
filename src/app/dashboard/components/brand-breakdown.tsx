"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import type { BrandData } from "@/lib/data/vantage";

const COLORS = [
  "#a1145c",
  "#1d6baf",
  "#16804b",
  "#b45309",
  "#d44d8a",
  "#c4321c",
  "#2195a3",
  "#3b8f6a",
];

function formatZAR(value: number): string {
  if (value >= 1_000_000) return `R ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R ${(value / 1_000).toFixed(0)}K`;
  return `R ${value}`;
}

function subscribe() {
  return () => undefined;
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function BrandBreakdown({ data }: { data: BrandData[] }) {
  const isClient = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );
  const chartData = useMemo(
    () => [...data].sort((a, b) => b.amount - a.amount),
    [data]
  );

  if (chartData.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-[--radius-md] border border-dashed border-[--color-border] text-sm text-[--color-fg-subtle]">
        No brand revenue data available for the selected filters.
      </div>
    );
  }

  if (!isClient) {
    return <div className="h-[280px] w-full rounded-[--radius-md] bg-[--color-bg-inset]" />;
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#edebe7"
            horizontal={false}
          />
          <XAxis
            type="number"
            tickFormatter={formatZAR}
            tick={{ fill: "#777777", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="brand"
            tick={{ fill: "#1a1a1a", fontSize: 12, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e3de",
              borderRadius: "10px",
              fontSize: "13px",
              color: "#1a1a1a",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
            formatter={(value) => [formatZAR(Number(value)), "Revenue"]}
          />
          <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={22}>
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
