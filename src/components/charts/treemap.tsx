"use client";

import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { rand, percent } from "@/lib/format";

export interface TreemapDatum {
  name: string;
  value: number;
}

const COLORS = [
  "#a1145c", "#b8336f", "#1d6baf", "#2195a3", "#16804b",
  "#b45309", "#8a1150", "#d44d8a", "#3b8f6a", "#c4321c",
  "#5a7fb5", "#7a9a4e",
];

/* eslint-disable @typescript-eslint/no-explicit-any */
function Node(props: any) {
  const { x, y, width, height, name, value, index, total } = props;
  if (width <= 0 || height <= 0) return null;
  const fill = COLORS[(index ?? 0) % COLORS.length];
  const showName = width > 54 && height > 22;
  const showValue = width > 70 && height > 38;
  const share = total ? value / total : 0;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#ffffff" strokeWidth={2} rx={2} />
      {showName && (
        <text x={x + 7} y={y + 17} fill="#ffffff" fontSize={12} fontWeight={600} style={{ pointerEvents: "none" }}>
          {String(name).length > Math.floor(width / 8) ? String(name).slice(0, Math.floor(width / 8) - 1) + "…" : name}
        </text>
      )}
      {showValue && (
        <text x={x + 7} y={y + 33} fill="#ffffffcc" fontSize={11} style={{ pointerEvents: "none" }}>
          {rand(value)} · {percent(share)}
        </text>
      )}
    </g>
  );
}

function TipBox({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload ?? {};
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-md" style={{ borderColor: "#e5e3de" }}>
      <p className="font-semibold text-gray-900">{p.name}</p>
      <p className="tabular-nums text-gray-600">{rand(p.value)}</p>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Labeled treemap — rectangles sized by sales, biggest = top-left. Replaces the PBI decomposition tree. */
export function SalesTreemap({ data, height = 340 }: { data: TreemapDatum[]; height?: number }) {
  const total = data.reduce((a, d) => a + Math.max(0, d.value), 0) || 1;
  const withTotal = data.map((d) => ({ ...d, total }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap
        data={withTotal}
        dataKey="value"
        nameKey="name"
        stroke="#ffffff"
        isAnimationActive={false}
        content={<Node total={total} />}
      >
        <Tooltip content={<TipBox />} />
      </Treemap>
    </ResponsiveContainer>
  );
}
