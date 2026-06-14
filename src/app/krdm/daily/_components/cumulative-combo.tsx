"use client";

// Cumulative combo for the Daily page: ACCUM_DAILY_SALES + ACCUM_DAILY_TARGET running totals by Date.
// Both series are Rand on a single axis (PBI shows accrued sales vs accrued target). Built on the same
// canvas ECharts renderer the shared wrappers use, with the KRDM palette.

import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import { KRDM } from "@/components/charts/echarts";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => <div style={{ width: "100%" }} />,
});

const RAND = (v: number) => "R" + Math.round(v).toLocaleString("en-ZA");

export interface CumulativePoint {
  label: string;
  sales: number;
  target: number;
}

export function CumulativeCombo({ data, height = 300 }: { data: CumulativePoint[]; height?: number }) {
  const option: EChartsOption = {
    grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "—" : RAND(Number(v))) },
    legend: {
      top: 0,
      textStyle: { color: KRDM.greyText, fontSize: 11 },
      data: ["Accum. Sales", "Accum. Target"],
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: data.map((d) => d.label),
      axisLabel: { color: KRDM.greyText, fontSize: 11, rotate: data.length > 12 ? 30 : 0 },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: KRDM.greyText, fontSize: 11, formatter: (v: number) => RAND(v) },
      splitLine: { lineStyle: { color: "#F1F1F1" } },
    },
    series: [
      {
        name: "Accum. Sales",
        type: "line",
        data: data.map((d) => Math.round(d.sales)),
        smooth: true,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { color: KRDM.cyan, width: 2.5 },
        itemStyle: { color: KRDM.cyan },
        areaStyle: { color: "rgba(31,168,201,0.10)" },
      },
      {
        name: "Accum. Target",
        type: "line",
        data: data.map((d) => Math.round(d.target)),
        smooth: false,
        symbol: "none",
        lineStyle: { color: KRDM.magenta, width: 2, type: "dashed" },
        itemStyle: { color: KRDM.magenta },
      },
    ],
  };
  return (
    <ReactECharts
      option={option}
      notMerge
      lazyUpdate
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
    />
  );
}
