"use client";

import { useState } from "react";
import { TrendLine, ForecastChart, type TrendPoint, type ForecastPoint } from "./echarts";

export type TrendDatum = { label: string; sales: number | null; target?: number | null; forecast?: number | null };
export type TrendSeriesMap = Record<string, TrendDatum[]>;

const TABS = ["FORECAST", "YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY", "DAILY"] as const;

export function ExecTrend({ series }: { series: TrendSeriesMap }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("FORECAST");
  const data = series[tab] ?? [];
  const hasTarget = data.some((d) => d.target != null);
  const isForecast = tab === "FORECAST";
  const points: TrendPoint[] = data.map((d) => ({ x: d.label, y: d.sales ?? null, y2: d.target ?? null }));
  const forecastPoints: ForecastPoint[] = data.map((d) => ({ x: d.label, actual: d.sales ?? null, forecast: d.forecast ?? null, target: d.target ?? null }));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide transition ${
              t === tab ? "bg-[#A6261D] text-white" : "bg-black/5 text-gray-500 hover:bg-black/10"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {isForecast
        ? <ForecastChart data={forecastPoints} />
        : <TrendLine data={points} yName="Sales" y2Name={hasTarget ? "Target" : undefined} y2Percent={false} area />}
    </div>
  );
}
