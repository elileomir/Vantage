"use client";

import { useSyncExternalStore } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { DailyDataPoint } from "@/lib/data/vantage";

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

export function DailyChart({ data }: { data: DailyDataPoint[] }) {
  const isClient = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  if (data.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-[--radius-md] border border-dashed border-[--color-border] text-sm text-[--color-fg-subtle]">
        No daily sales data available for the selected filters.
      </div>
    );
  }

  if (!isClient) {
    return <div className="h-[320px] w-full rounded-[--radius-md] bg-[--color-bg-inset]" />;
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a1145c" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#a1145c" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="targetFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1d6baf" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#1d6baf" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#edebe7" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#777777", fontSize: 12 }}
            axisLine={{ stroke: "#e5e3de" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatZAR}
            tick={{ fill: "#777777", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={65}
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
            formatter={(value) => [formatZAR(Number(value))]}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", color: "#555555" }}
            iconType="circle"
            iconSize={8}
          />
          <Area
            type="monotone"
            dataKey="accum_sales"
            name="Accumulated Sales"
            stroke="#a1145c"
            fill="url(#salesFill)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="accum_target"
            name="Accumulated Target"
            stroke="#1d6baf"
            fill="url(#targetFill)"
            strokeWidth={2}
            strokeDasharray="6 3"
          />
          <Line
            type="monotone"
            dataKey="daily_sales"
            name="Daily Sales"
            stroke="#16804b"
            strokeWidth={1.5}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
