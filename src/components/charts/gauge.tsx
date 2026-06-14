"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { percent } from "@/lib/format";

const TONE = {
  positive: "#16804b",
  warning: "#b45309",
  negative: "#c4321c",
  neutral: "#999999",
};

/** Donut achievement gauge. Ring fills to min(value,100%); center shows the true %. */
export function AchievementGauge({
  achievement,
  size = 168,
}: {
  achievement: number | null;
  size?: number;
}) {
  const tone =
    achievement == null
      ? "neutral"
      : achievement >= 1
        ? "positive"
        : achievement >= 0.8
          ? "warning"
          : "negative";
  const color = TONE[tone];
  const filled = achievement == null ? 0 : Math.min(Math.max(achievement, 0), 1);
  const data = [
    { name: "achieved", value: filled },
    { name: "remaining", value: 1 - filled },
  ];
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius="74%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill={color} />
            <Cell fill="#efece8" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums" style={{ color }}>
          {achievement == null ? "—" : percent(achievement)}
        </span>
        <span className="mt-0.5 text-[0.6875rem] font-medium uppercase tracking-wider text-gray-400">
          of target
        </span>
      </div>
    </div>
  );
}
