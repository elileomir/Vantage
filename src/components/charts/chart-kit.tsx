"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  AreaChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  LabelList,
} from "recharts";
import { rand, randCompact, percent } from "@/lib/format";

// Palette mirrors globals.css chart tokens.
export const PALETTE = {
  accent: "#a1145c",
  accentSoft: "#d44d8a",
  info: "#1d6baf",
  positive: "#16804b",
  warning: "#b45309",
  negative: "#c4321c",
  teal: "#2195a3",
  grid: "#edebe7",
  axis: "#999999",
  tail: "#cfcbc4",
};

const AXIS = { fontSize: 11, fill: "#777777" };

function TooltipBox({
  active,
  payload,
  label,
  valueFmt = rand,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string;
  valueFmt?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border bg-white px-3 py-2 text-xs shadow-md"
      style={{ borderColor: "#e5e3de" }}
    >
      {label != null && <p className="mb-1 font-semibold text-gray-900">{label}</p>}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-gray-500">
              <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-medium tabular-nums text-gray-900">
              {p.dataKey === "achievement" || p.dataKey === "cumulative"
                ? percent(Number(p.value))
                : valueFmt(Number(p.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Section wrapper. One surface, no nested cards. */
export function ChartCard({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-gray-500">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[0.8125rem] text-gray-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export interface ComboDatum {
  label: string;
  sales: number;
  target?: number;
  achievement?: number | null;
}

/** Clustered bars (sales / target) + achievement % line on a second axis. */
export function ComboBarLine({ data, height = 300 }: { data: ComboDatum[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 8, left: 4, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke={PALETTE.grid} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: PALETTE.grid }} interval={0} angle={-25} textAnchor="end" height={56} />
        <YAxis yAxisId="left" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={randCompact} width={48} />
        <YAxis yAxisId="right" orientation="right" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => percent(v)} width={44} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "#a1145c0d" }} />
        <Bar yAxisId="left" dataKey="sales" name="Sales" fill={PALETTE.accent} radius={[3, 3, 0, 0]} maxBarSize={34} />
        <Bar yAxisId="left" dataKey="target" name="Target" fill="#e7d4df" radius={[3, 3, 0, 0]} maxBarSize={34} />
        <Line yAxisId="right" dataKey="achievement" name="Achievement" stroke={PALETTE.info} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export interface RankDatum {
  name: string;
  value: number;
  muted?: boolean;
}

/** Horizontal ranking bars, descending, with value labels. Optional muted tail (Pareto).
 *  `format` is a string (not a function) so this client component is safe to render
 *  from a Server Component (functions cannot cross the server/client boundary). */
export function RankingBars({
  data,
  height,
  color = PALETTE.accent,
  format = "compact",
}: {
  data: RankDatum[];
  height?: number;
  color?: string;
  format?: "rand" | "compact" | "percent";
}) {
  const valueFmt =
    format === "percent" ? (v: number) => percent(v) : format === "rand" ? rand : randCompact;
  const h = height ?? Math.max(160, data.length * 30 + 24);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 8, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11.5, fill: "#555555" }}
          tickLine={false}
          axisLine={false}
          width={140}
          interval={0}
        />
        <Tooltip content={<TooltipBox valueFmt={valueFmt} />} cursor={{ fill: "#a1145c0d" }} />
        <Bar dataKey="value" name="Sales" radius={[0, 3, 3, 0]} maxBarSize={20}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.muted ? PALETTE.tail : color} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v) => valueFmt(Number(v))}
            style={{ fontSize: 11, fill: "#555555", fontWeight: 500 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface ParetoDatum {
  label: string;
  value: number;
  cumulative: number;
  inThreshold: boolean;
}

/** Pareto: descending bars + cumulative % line + threshold reference line. */
export function ParetoChart({ data, threshold = 0.8, height = 300 }: { data: ParetoDatum[]; threshold?: number; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 48, left: 4, bottom: 48 }}>
        <CartesianGrid vertical={false} stroke={PALETTE.grid} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#777777" }} tickLine={false} axisLine={{ stroke: PALETTE.grid }} interval={0} angle={-45} textAnchor="end" height={60} />
        <YAxis yAxisId="left" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={randCompact} width={48} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 1]} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => percent(v)} width={44} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "#a1145c0d" }} />
        <ReferenceLine yAxisId="right" y={threshold} stroke={PALETTE.warning} strokeDasharray="4 4" />
        <Bar yAxisId="left" dataKey="value" name="Sales" radius={[3, 3, 0, 0]} maxBarSize={30}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.inThreshold ? PALETTE.accent : PALETTE.tail} />
          ))}
        </Bar>
        <Line yAxisId="right" dataKey="cumulative" name="Cumulative %" stroke={PALETTE.info} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export interface TrendDatum {
  label: string;
  sales?: number | null;
  target?: number | null;
  forecast?: number | null;
}

/** Sales vs target trend with a dashed forecast continuation. */
export function TrendArea({ data, height = 280 }: { data: TrendDatum[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE.accent} stopOpacity={0.18} />
            <stop offset="100%" stopColor={PALETTE.accent} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={PALETTE.grid} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: PALETTE.grid }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={randCompact} width={48} />
        <Tooltip content={<TooltipBox />} cursor={{ stroke: PALETTE.grid }} />
        <Area dataKey="target" name="Target" stroke="#cbb6c2" strokeWidth={1.5} strokeDasharray="3 3" fill="none" connectNulls />
        <Area dataKey="sales" name="Sales" stroke={PALETTE.accent} strokeWidth={2.5} fill="url(#salesFill)" connectNulls />
        <Line dataKey="forecast" name="Forecast" stroke={PALETTE.accentSoft} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
      </AreaChart>
    </ResponsiveContainer>
  );
}
