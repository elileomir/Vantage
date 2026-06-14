"use client";

// KRDM ECharts wrapper library — themed, typed visuals replicating the Power BI report.
// One thin base wrapper + purpose-built components (Gauge, ComboBarLine, RankingBar,
// TrendLine, StackedAchievement, Pareto, Pie). All client-side (canvas renderer).

import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import { KRDM, ragColor } from "./theme";

// Re-export so existing client-component imports `{ KRDM, ragColor } from ".../echarts"` keep working.
// Server components MUST import these from "./theme" directly (this module is "use client").
export { KRDM, ragColor };

// Load echarts-for-react client-only (canvas needs the DOM; avoids SSR window errors).
const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => <div style={{ width: "100%" }} />,
});

// ECharts label/tooltip callback params are loosely typed; we read `.value` (+ occasionally `.dataIndex`).
type EChartsLabelParam = { value: number | string | (number | string)[]; dataIndex?: number };

const RAND = (v: number) =>
  "R" + Math.round(v).toLocaleString("en-ZA");
const PCT = (v: number) => Math.round(v * 100) + "%";

const baseGrid = { left: 8, right: 8, top: 28, bottom: 8, containLabel: true };
const axisLabel = { color: KRDM.greyText, fontSize: 11 };

function Base({ option, height = 280, className }: { option: EChartsOption; height?: number; className?: string }) {
  return (
    <ReactECharts
      option={option}
      notMerge
      lazyUpdate
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      className={className}
    />
  );
}

// ── Donut achievement gauge (ACHIEVE 100% / REMAINING) ──────────────────────
export function Gauge({ ratio, label = "OF TARGET", height = 220 }: { ratio: number | null; label?: string; height?: number }) {
  const pct = ratio == null ? 0 : Math.max(0, ratio);
  const achieved = Math.min(pct, 1);
  const over = Math.max(0, pct - 1);
  const remain = Math.max(0, 1 - pct);
  const color = ragColor(ratio);
  const option: EChartsOption = {
    series: [
      {
        type: "pie", radius: ["70%", "92%"], center: ["50%", "55%"], silent: true,
        label: { show: false }, labelLine: { show: false },
        data: [
          { value: achieved, itemStyle: { color } },
          // overshoot above target is GOOD — deep green, never red
          { value: over, itemStyle: { color: "#007A3D" } },
          { value: remain, itemStyle: { color: KRDM.grey } },
        ],
      },
    ],
    graphic: {
      type: "group", left: "center", top: "center",
      children: [
        { type: "text", style: { text: ratio == null ? "—" : PCT(ratio), font: "700 30px sans-serif", fill: color, textAlign: "center" }, top: -14 },
        { type: "text", style: { text: label, font: "600 11px sans-serif", fill: KRDM.greyText, textAlign: "center" }, top: 20 },
      ],
    } as EChartsOption["graphic"],
  };
  return <Base option={option} height={height} />;
}

// ── Combo bar + line, dual axis (sales bars + achievement% line) ────────────
export type ComboDatum = { label: string; bar: number; line?: number | null; target?: number | null };
export function ComboBarLine({ data, barName = "Sales", lineName = "Achievement", linePercent = true, height = 300 }: {
  data: ComboDatum[]; barName?: string; lineName?: string; linePercent?: boolean; height?: number;
}) {
  const option: EChartsOption = {
    grid: baseGrid,
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { top: 0, textStyle: { color: KRDM.greyText, fontSize: 11 }, data: [barName, lineName] },
    xAxis: { type: "category", data: data.map((d) => d.label), axisLabel: { ...axisLabel, interval: 0, rotate: data.length > 6 ? 30 : 0 }, axisTick: { show: false } },
    yAxis: [
      { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => RAND(v) }, splitLine: { lineStyle: { color: "#F1F1F1" } } },
      { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => (linePercent ? PCT(v) : RAND(v)) }, splitLine: { show: false } },
    ],
    series: [
      { name: barName, type: "bar", data: data.map((d) => Math.round(d.bar)), itemStyle: { color: KRDM.cyan, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 36 },
      { name: lineName, type: "line", yAxisIndex: 1, data: data.map((d) => (d.line == null ? null : linePercent ? d.line : Math.round(d.line))), smooth: false, symbol: "circle", symbolSize: 7, lineStyle: { color: KRDM.magenta, width: 2 }, itemStyle: { color: KRDM.magenta } },
    ],
  };
  return <Base option={option} height={height} />;
}

// ── Drop combo: sales columns (with LYS sub-label) + achievement% line ──────
// PBI "TOP 5 … WITH BIGGEST DROP IN SALES VS LAST YEAR".
export type DropDatum = { label: string; sales: number; lySales: number | null; achieve: number | null };
export function DropCombo({ data, height = 320 }: { data: DropDatum[]; height?: number }) {
  const option: EChartsOption = {
    grid: { ...baseGrid, top: 40, right: 44 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { top: 0, textStyle: { color: KRDM.greyText, fontSize: 11 }, data: ["Sales", "Achieve"] },
    xAxis: { type: "category", data: data.map((d) => d.label), axisLabel: { ...axisLabel, interval: 0, width: 80, overflow: "break", lineHeight: 13 }, axisTick: { show: false } },
    yAxis: [
      { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => RAND(v) }, splitLine: { lineStyle: { color: "#F1F1F1" } } },
      { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => PCT(v) }, splitLine: { show: false } },
    ],
    series: [
      {
        name: "Sales", type: "bar", data: data.map((d) => Math.round(d.sales)),
        itemStyle: { color: KRDM.cyan, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 42,
        label: {
          show: true, position: "top", fontSize: 9, color: KRDM.greyText, lineHeight: 12,
          formatter: (p: EChartsLabelParam) => {
            const d = p.dataIndex != null ? data[p.dataIndex] : undefined;
            return d ? `${RAND(d.sales)}\nLYS: ${d.lySales == null ? "-" : RAND(d.lySales)}` : "";
          },
        },
      },
      {
        name: "Achieve", type: "line", yAxisIndex: 1, data: data.map((d) => d.achieve),
        symbol: "circle", symbolSize: 7, lineStyle: { color: KRDM.magenta, width: 2.5 }, itemStyle: { color: KRDM.magenta }, connectNulls: true,
        label: { show: true, position: "top", fontSize: 10, fontWeight: "bold", color: KRDM.magenta, formatter: (p: EChartsLabelParam) => (p.value == null ? "" : PCT(Number(p.value))) },
      },
    ] as EChartsOption["series"],
  };
  return <Base option={option} height={height} />;
}

// ── Rep Sales/Target/Difference columns + Achievement line ──────────────────
// PBI "REPRESENTATIVE SALES, TARGET AND ACHIEVEMENT".
export type RepTargetDatum = { label: string; sales: number; target: number; difference: number; achievement: number | null };
export function RepTargetCombo({ data, height = 360 }: { data: RepTargetDatum[]; height?: number }) {
  const showLabels = data.length <= 8;
  const option: EChartsOption = {
    grid: { ...baseGrid, top: 36, right: 48 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { top: 0, textStyle: { color: KRDM.greyText, fontSize: 11 }, data: ["Sales", "Target", "Difference", "Achievement"] },
    xAxis: { type: "category", data: data.map((d) => d.label), axisLabel: { ...axisLabel, interval: 0, rotate: data.length > 6 ? 25 : 0, width: 90, overflow: "truncate" }, axisTick: { show: false } },
    yAxis: [
      { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => RAND(v) }, splitLine: { lineStyle: { color: "#F1F1F1" } } },
      { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => PCT(v) }, splitLine: { show: false } },
    ],
    series: [
      { name: "Sales", type: "bar", data: data.map((d) => Math.round(d.sales)), itemStyle: { color: KRDM.cyan, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 30, label: { show: showLabels, position: "top", fontSize: 9, color: KRDM.greyText, formatter: (p: EChartsLabelParam) => RAND(Number(p.value)) } },
      { name: "Target", type: "bar", data: data.map((d) => Math.round(d.target)), itemStyle: { color: KRDM.magenta, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 30, label: { show: showLabels, position: "top", fontSize: 9, color: KRDM.magenta, formatter: (p: EChartsLabelParam) => RAND(Number(p.value)) } },
      { name: "Difference", type: "bar", data: data.map((d) => Math.round(d.difference)), itemStyle: { color: "#BDBDBD", borderRadius: [3, 3, 3, 3] }, barMaxWidth: 30, label: { show: showLabels, position: "bottom", fontSize: 9, color: KRDM.greyText, formatter: (p: EChartsLabelParam) => RAND(Number(p.value)) } },
      { name: "Achievement", type: "line", yAxisIndex: 1, data: data.map((d) => d.achievement), symbol: "circle", symbolSize: 7, lineStyle: { color: "#EC407A", width: 2.5 }, itemStyle: { color: "#EC407A" }, connectNulls: true, label: { show: showLabels, position: "top", fontSize: 10, fontWeight: "bold", color: "#EC407A", formatter: (p: EChartsLabelParam) => (p.value == null ? "" : PCT(Number(p.value))) } },
    ] as EChartsOption["series"],
  };
  return <Base option={option} height={height} />;
}

// ── Behind-target columns (negative values, value labels) ───────────────────
// PBI "TOP 5 … WITH FURTHEST BEHIND THE TARGET".
export function BehindBars({ data, color = KRDM.cyan, height = 320 }: { data: { label: string; value: number }[]; color?: string; height?: number }) {
  const allNeg = data.length > 0 && data.every((d) => d.value < 0);
  const option: EChartsOption = {
    grid: { ...baseGrid, top: 24, right: 16 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => RAND(Number(v)) },
    xAxis: { type: "category", data: data.map((d) => d.label), axisLabel: { ...axisLabel, interval: 0, width: 84, overflow: "break", lineHeight: 13 }, axisTick: { show: false }, axisLine: { lineStyle: { color: "#E5E5E5" } } },
    yAxis: { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => RAND(v) }, splitLine: { lineStyle: { color: "#F1F1F1" } } },
    series: [
      {
        type: "bar", data: data.map((d) => Math.round(d.value)), itemStyle: { color, borderRadius: [3, 3, 3, 3] }, barMaxWidth: 48,
        label: { show: true, position: allNeg ? "bottom" : "top", fontSize: 10, color: KRDM.greyText, formatter: (p: EChartsLabelParam) => RAND(Number(p.value)) },
      },
    ] as EChartsOption["series"],
  };
  return <Base option={option} height={height} />;
}

// ── Achievement % columns (RAG-coloured, % labels) ──────────────────────────
// PBI "SALES REPRESENTATIVE YTD ACHIEVEMENT (YTD SALES/YTD TARGET)".
export function AchievementColumns({ data, height = 300 }: { data: { label: string; value: number }[]; height?: number }) {
  const option: EChartsOption = {
    grid: { ...baseGrid, top: 28 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => PCT(Number(v)) },
    xAxis: { type: "category", data: data.map((d) => d.label), axisLabel: { ...axisLabel, interval: 0, rotate: data.length > 6 ? 25 : 0, width: 90, overflow: "truncate" }, axisTick: { show: false } },
    yAxis: { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => PCT(v) }, splitLine: { lineStyle: { color: "#F1F1F1" } } },
    series: [
      {
        type: "bar", data: data.map((d) => ({ value: d.value, itemStyle: { color: ragColor(d.value), borderRadius: [3, 3, 0, 0] } })), barMaxWidth: 64,
        label: { show: true, position: "top", fontSize: 11, fontWeight: "bold", color: KRDM.greyText, formatter: (p: EChartsLabelParam) => PCT(Number(p.value)) },
      },
    ] as EChartsOption["series"],
  };
  return <Base option={option} height={height} />;
}

// ── Horizontal ranking bars (Top N) ─────────────────────────────────────────
export function RankingBar({ data, valueFormat = "rand", color = KRDM.cyan, height = 300 }: {
  data: { name: string; value: number }[]; valueFormat?: "rand" | "pct" | "num"; color?: string; height?: number;
}) {
  const fmt = (v: number) => (valueFormat === "rand" ? RAND(v) : valueFormat === "pct" ? PCT(v) : Math.round(v).toLocaleString());
  const sorted = [...data].sort((a, b) => a.value - b.value); // ECharts y-category renders bottom-up
  const option: EChartsOption = {
    grid: { ...baseGrid, left: 8, right: 56 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => fmt(Number(v)) },
    xAxis: { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => fmt(v) }, splitLine: { lineStyle: { color: "#F1F1F1" } } },
    yAxis: { type: "category", data: sorted.map((d) => d.name), axisLabel: { ...axisLabel, width: 120, overflow: "truncate" }, axisTick: { show: false } },
    series: [
      {
        type: "bar", data: sorted.map((d) => ({ value: Math.round(d.value), itemStyle: { color: valueFormat === "pct" ? ragColor(d.value) : color } })),
        barMaxWidth: 22, itemStyle: { borderRadius: [0, 3, 3, 0] },
        label: { show: true, position: "right", formatter: (p: EChartsLabelParam) => fmt(Number(p.value)), color: KRDM.greyText, fontSize: 10 },
      },
    ] as EChartsOption["series"],
  };
  return <Base option={option} height={height} />;
}

// ── Trend line (one or two series, optional second axis as %) ───────────────
export type TrendPoint = { x: string; y: number | null; y2?: number | null };
export function TrendLine({ data, yName = "Sales", y2Name, y2Percent = true, area = true, height = 280 }: {
  data: TrendPoint[]; yName?: string; y2Name?: string; y2Percent?: boolean; area?: boolean; height?: number;
}) {
  const hasY2 = data.some((d) => d.y2 != null) && !!y2Name;
  const option: EChartsOption = {
    grid: baseGrid,
    tooltip: { trigger: "axis" },
    legend: hasY2 ? { top: 0, textStyle: axisLabel, data: [yName, y2Name as string] } : undefined,
    xAxis: { type: "category", boundaryGap: false, data: data.map((d) => d.x), axisLabel: { ...axisLabel, rotate: data.length > 10 ? 30 : 0 }, axisTick: { show: false } },
    yAxis: [
      { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => RAND(v) }, splitLine: { lineStyle: { color: "#F1F1F1" } } },
      ...(hasY2 ? [{ type: "value" as const, axisLabel: { ...axisLabel, formatter: (v: number) => (y2Percent ? PCT(v) : RAND(v)) }, splitLine: { show: false } }] : []),
    ],
    series: [
      { name: yName, type: "line", data: data.map((d) => (d.y == null ? null : Math.round(d.y))), smooth: true, symbol: "circle", symbolSize: 5, lineStyle: { color: KRDM.red, width: 2 }, itemStyle: { color: KRDM.red }, areaStyle: area ? { color: "rgba(166,38,29,0.10)" } : undefined },
      ...(hasY2 ? [{ name: y2Name as string, type: "line" as const, yAxisIndex: 1, data: data.map((d) => (d.y2 == null ? null : y2Percent ? d.y2 : Math.round(d.y2))), smooth: false, symbol: "circle", symbolSize: 5, lineStyle: { color: KRDM.magenta, width: 2, type: "dashed" as const }, itemStyle: { color: KRDM.magenta } }] : []),
    ],
  };
  return <Base option={option} height={height} />;
}

// ── Forecast: solid actual + dashed projection to FY-end + faint target ─────
export type ForecastPoint = { x: string; actual: number | null; forecast: number | null; target?: number | null };
export function ForecastChart({ data, height = 300 }: { data: ForecastPoint[]; height?: number }) {
  // Bridge the dashed forecast to the last actual point so the projection connects visually.
  let lastActualIdx = -1;
  data.forEach((d, i) => { if (d.actual != null) lastActualIdx = i; });
  const forecastSeries = data.map((d, i) => (i === lastActualIdx ? d.actual : i > lastActualIdx ? d.forecast : null));
  const option: EChartsOption = {
    grid: baseGrid,
    tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "—" : RAND(Number(v))) },
    legend: { top: 0, textStyle: axisLabel, data: ["Actual", "Forecast", "Target"] },
    xAxis: { type: "category", boundaryGap: false, data: data.map((d) => d.x), axisLabel: { ...axisLabel, rotate: data.length > 8 ? 30 : 0 }, axisTick: { show: false } },
    yAxis: { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => RAND(v) }, splitLine: { lineStyle: { color: "#F1F1F1" } } },
    series: [
      { name: "Actual", type: "line", data: data.map((d) => (d.actual == null ? null : Math.round(d.actual))), smooth: true, symbol: "circle", symbolSize: 6, lineStyle: { color: KRDM.red, width: 2.5 }, itemStyle: { color: KRDM.red }, areaStyle: { color: "rgba(166,38,29,0.10)" }, connectNulls: false },
      { name: "Forecast", type: "line", data: forecastSeries.map((v) => (v == null ? null : Math.round(v))), smooth: true, symbol: "emptyCircle", symbolSize: 6, lineStyle: { color: KRDM.magenta, width: 2, type: "dashed" }, itemStyle: { color: KRDM.magenta }, connectNulls: true },
      { name: "Target", type: "line", data: data.map((d) => (d.target == null ? null : Math.round(d.target))), smooth: true, symbol: "none", lineStyle: { color: "#C9CDD3", width: 1.5, type: "dotted" }, connectNulls: true },
    ],
  };
  return <Base option={option} height={height} />;
}

// ── 100%-stacked achievement bar (ACHIEVE R 100% + YT_REMAINING) ────────────
export function StackedAchievement({ data, height = 300 }: { data: { name: string; achieved: number }[]; height?: number }) {
  const sorted = [...data].sort((a, b) => a.achieved - b.achieved);
  const option: EChartsOption = {
    grid: { ...baseGrid, right: 48 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => PCT(Number(v)) },
    xAxis: { type: "value", max: 1, axisLabel: { ...axisLabel, formatter: (v: number) => PCT(v) }, splitLine: { lineStyle: { color: "#F1F1F1" } } },
    yAxis: { type: "category", data: sorted.map((d) => d.name), axisLabel: { ...axisLabel, width: 120, overflow: "truncate" }, axisTick: { show: false } },
    series: [
      { name: "Achieved", type: "bar", stack: "a", data: sorted.map((d) => ({ value: Math.min(d.achieved, 1), itemStyle: { color: ragColor(d.achieved) } })), label: { show: true, position: "insideRight", formatter: (p: EChartsLabelParam) => PCT(Number(p.value)), color: "#fff", fontSize: 10 } },
      { name: "Remaining", type: "bar", stack: "a", data: sorted.map((d) => Math.max(0, 1 - d.achieved)), itemStyle: { color: KRDM.grey } },
    ] as EChartsOption["series"],
  };
  return <Base option={option} height={height} />;
}

// ── Pareto: descending bars + cumulative-share line + threshold marker ──────
export type ParetoDatum = { name: string; value: number };
export function Pareto({ data, threshold = 0.8, height = 320 }: { data: ParetoDatum[]; threshold?: number; height?: number }) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((a, d) => a + d.value, 0) || 1;
  let run = 0;
  const cum = sorted.map((d) => { run += d.value; return run / total; });
  const option: EChartsOption = {
    grid: baseGrid,
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    legend: { top: 0, textStyle: axisLabel, data: ["Sales", "Cumulative %"] },
    xAxis: { type: "category", data: sorted.map((d) => d.name), axisLabel: { ...axisLabel, rotate: 40, width: 80, overflow: "truncate" }, axisTick: { show: false } },
    yAxis: [
      { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => RAND(v) }, splitLine: { lineStyle: { color: "#F1F1F1" } } },
      { type: "value", min: 0, max: 1, axisLabel: { ...axisLabel, formatter: (v: number) => PCT(v) }, splitLine: { show: false } },
    ],
    series: [
      { name: "Sales", type: "bar", data: sorted.map((d, i) => ({ value: Math.round(d.value), itemStyle: { color: cum[i] <= threshold ? KRDM.cyan : KRDM.grey } })), barMaxWidth: 30 },
      {
        name: "Cumulative %", type: "line", yAxisIndex: 1, data: cum, smooth: false, symbol: "circle", symbolSize: 5,
        lineStyle: { color: KRDM.magenta, width: 2 }, itemStyle: { color: KRDM.magenta },
        markLine: { silent: true, symbol: "none", data: [{ yAxis: threshold }], lineStyle: { color: KRDM.red, type: "dashed" }, label: { formatter: PCT(threshold), color: KRDM.red } },
      },
    ],
  };
  return <Base option={option} height={height} />;
}

// ── Sales Tracker (daily Sales/Target bars + Running Sales/Target lines) ────
// PBI/Excel Daily "SALES TRACKER". Left axis = daily Rand, right axis = cumulative Rand.
export type TrackerPoint = { label: string; sales: number; target: number; runningSales: number; runningTarget: number };
export function SalesTracker({ data, height = 460 }: { data: TrackerPoint[]; height?: number }) {
  const option: EChartsOption = {
    grid: { left: 8, right: 8, top: 44, bottom: 64, containLabel: true },
    tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "-" : RAND(Number(v))) },
    legend: { bottom: 0, textStyle: { color: KRDM.greyText, fontSize: 11 }, data: ["Sales", "Target", "Running Sales", "Running Target"] },
    xAxis: { type: "category", data: data.map((d) => d.label), axisLabel: { color: KRDM.greyText, fontSize: 9, rotate: 90, interval: 0 }, axisTick: { show: false } },
    yAxis: [
      { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => RAND(v) }, splitLine: { lineStyle: { color: "#F1F1F1" } } },
      { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => RAND(v) }, splitLine: { show: false } },
    ],
    series: [
      { name: "Sales", type: "bar", data: data.map((d) => Math.round(d.sales)), itemStyle: { color: "#4FBEE0" }, barMaxWidth: 15, barGap: "-20%" },
      { name: "Target", type: "bar", data: data.map((d) => Math.round(d.target)), itemStyle: { color: "#B6B9BD" }, barMaxWidth: 15 },
      { name: "Running Sales", type: "line", yAxisIndex: 1, data: data.map((d) => Math.round(d.runningSales)), symbol: "none", smooth: false, lineStyle: { color: "#E23B2E", width: 2.5 }, itemStyle: { color: "#E23B2E" } },
      { name: "Running Target", type: "line", yAxisIndex: 1, data: data.map((d) => Math.round(d.runningTarget)), symbol: "none", smooth: false, lineStyle: { color: "#F2C037", width: 2, type: "dotted" }, itemStyle: { color: "#F2C037" } },
    ] as EChartsOption["series"],
  };
  return <Base option={option} height={height} />;
}

// ── Sparkline (tiny area line, no axes) — Exec "Sales" card ─────────────────
export function Sparkline({ data, height = 60, color = KRDM.magenta }: { data: number[]; height?: number; color?: string }) {
  const option: EChartsOption = {
    grid: { left: 2, right: 2, top: 6, bottom: 2 },
    xAxis: { type: "category", show: false, boundaryGap: false, data: data.map((_, i) => i) },
    yAxis: { type: "value", show: false, scale: true },
    tooltip: { show: false },
    series: [
      { type: "line", data, smooth: true, symbol: "none", lineStyle: { color, width: 2 }, areaStyle: { color: "rgba(194,24,91,0.12)" } },
    ],
  };
  return <Base option={option} height={height} />;
}

// ── Pie / donut (brand share) ───────────────────────────────────────────────
export function Pie({ data, height = 280, donut = true }: { data: { name: string; value: number }[]; height?: number; donut?: boolean }) {
  const palette = [KRDM.cyan, KRDM.red, KRDM.magenta, KRDM.amber, KRDM.green, "#7E57C2", "#26A69A", "#EC407A", "#42A5F5", "#8D6E63"];
  const option: EChartsOption = {
    tooltip: { trigger: "item", valueFormatter: (v) => RAND(Number(v)) },
    legend: { type: "scroll", orient: "vertical", right: 0, top: "center", textStyle: { ...axisLabel, fontSize: 10 } },
    series: [
      {
        type: "pie", radius: donut ? ["45%", "75%"] : "75%", center: ["38%", "52%"],
        data: [...data].sort((a, b) => b.value - a.value).map((d, i) => ({ ...d, itemStyle: { color: palette[i % palette.length] } })),
        label: { show: false }, labelLine: { show: false },
      },
    ],
  };
  return <Base option={option} height={height} />;
}
