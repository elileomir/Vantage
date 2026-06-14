"use client";

// Reusable Pareto card with the PBI PARAM_PARETO what-if slider + "About Pareto" popover inline
// in the card header. Threshold is local state (default 0.80) and recolours the Pareto bars live.

import { useState } from "react";
import { Pareto } from "@/components/charts/echarts";
import { ReportCard } from "@/components/report-card";

export function ParetoCard({ title, data, height = 320 }: {
  title: string;
  data: { name: string; value: number }[];
  height?: number;
}) {
  const [threshold, setThreshold] = useState(0.8);
  const [info, setInfo] = useState(false);
  const pct = Math.round(threshold * 100);

  const control = (
    <div className="relative flex items-center gap-2.5">
      <span className="rounded-md bg-black/[0.05] px-2 py-1 text-xs font-semibold tabular-nums text-gray-600">{(threshold * 100).toFixed(2)}%</span>
      <input
        type="range" min={0} max={100} step={5} value={pct}
        onChange={(e) => setThreshold(Number(e.target.value) / 100)}
        aria-label="Pareto threshold"
        className="h-1.5 w-32 cursor-pointer appearance-none rounded-full"
        style={{ accentColor: "#1FA8C9", background: "#1FA8C926" }}
      />
      <button onClick={() => setInfo((o) => !o)} className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: "#1FA8C9" }}>
        About Pareto
      </button>
      {info && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setInfo(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-[280px] rounded-xl border border-black/10 bg-white p-4 text-xs leading-relaxed text-gray-600 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18)]">
            <p className="mb-1 font-semibold text-gray-800">The Pareto principle (80/20)</p>
            <p>Bars are ranked by sales, high to low. The line tracks the cumulative share of total sales. Bars left of the <span className="font-semibold" style={{ color: "#1FA8C9" }}>{pct}%</span> cutoff are the “vital few” driving most of the revenue; drag the slider to change the threshold.</p>
          </div>
        </>
      )}
    </div>
  );

  return (
    <ReportCard title={title} action={control}>
      <Pareto data={data} threshold={threshold} height={height} />
    </ReportCard>
  );
}
