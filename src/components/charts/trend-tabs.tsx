"use client";

import { useState } from "react";
import { TrendArea, type TrendDatum } from "./chart-kit";

export const TREND_TABS = ["FORECAST", "YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY", "DAILY"] as const;
export type TrendTab = (typeof TREND_TABS)[number];
export type TrendSeriesMap = Record<TrendTab, TrendDatum[]>;

/** PBI Executive trend granularity switch: FORECAST / YEARLY / QUARTERLY / MONTHLY / WEEKLY / DAILY. */
export function TrendTabs({ series }: { series: TrendSeriesMap }) {
  const [tab, setTab] = useState<TrendTab>("FORECAST");
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TREND_TABS.map((t) => {
          const active = t === tab;
          const has = (series[t]?.length ?? 0) > 0;
          return (
            <button
              key={t}
              type="button"
              disabled={!has}
              onClick={() => setTab(t)}
              className={has ? "rounded px-2.5 py-1 text-[0.6875rem] font-semibold tracking-[0.04em] cursor-pointer" : "rounded px-2.5 py-1 text-[0.6875rem] font-semibold tracking-[0.04em] opacity-40"}
              style={active ? { backgroundColor: "#a1145c", color: "#fff" } : { backgroundColor: "#f1eef0", color: "#8a8a8a" }}
            >
              {t}
            </button>
          );
        })}
      </div>
      <TrendArea data={series[tab] ?? []} />
    </>
  );
}
