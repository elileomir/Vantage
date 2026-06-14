"use client";

// Generic N-level Power BI-style decomposition tree: a left-to-right drill. Each level is a ranked
// column of its parent's children; click a node to expand the next dimension. Data is supplied
// pre-nested (the page fetches it server-side). Self-contained — no round-trips, no graph lib.

import { useState } from "react";

export type DecompNode = { name: string; value: number; children?: DecompNode[] };

const KRDM_RED = "#A6261D";
const CYAN = "#1FA8C9";
const rand = (v: number) => (v < 0 ? "-R" : "R") + Math.round(Math.abs(v)).toLocaleString("en-ZA");

export function DecompositionTree({ root, levels, rootLabel = "Total", height = 380 }: {
  root: DecompNode; levels: string[]; rootLabel?: string; height?: number;
}) {
  const [path, setPath] = useState<DecompNode[]>([root]);
  const selectAt = (colIdx: number, node: DecompNode) => setPath((p) => [...p.slice(0, colIdx + 1), node]);

  const columns: { title: string; nodes: DecompNode[]; selected?: DecompNode; colIdx: number }[] = [
    { title: rootLabel, nodes: [root], selected: path[0], colIdx: 0 },
  ];
  for (let i = 0; i < levels.length; i++) {
    const parent = path[i];
    if (!parent?.children?.length) break;
    columns.push({ title: levels[i], nodes: parent.children, selected: path[i + 1], colIdx: i + 1 });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2" style={{ minHeight: height }}>
      {columns.map((col) => {
        const ranked = [...col.nodes].sort((a, b) => b.value - a.value);
        const max = Math.max(...ranked.map((n) => Math.abs(n.value)), 1);
        return (
          <div key={col.colIdx} className="flex min-w-[210px] flex-1 flex-col">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{col.title}</div>
            <div className="flex flex-col gap-1 overflow-y-auto pr-1" style={{ maxHeight: height }}>
              {ranked.map((node) => {
                const isSel = col.selected?.name === node.name;
                const canDrill = !!node.children?.length;
                return (
                  <button
                    key={node.name}
                    onClick={() => selectAt(col.colIdx, node)}
                    className={`group relative overflow-hidden rounded-lg border px-2.5 py-1.5 text-left transition ${
                      isSel ? "border-[#A6261D]/50 bg-[#A6261D]/[0.04]" : "border-black/5 bg-white hover:border-[#A6261D]/30"
                    }`}
                  >
                    <span className="absolute inset-y-0 left-0 opacity-[0.12]" style={{ width: `${(Math.abs(node.value) / max) * 100}%`, background: isSel ? KRDM_RED : CYAN }} />
                    <span className="relative flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-gray-800">{node.name}{canDrill && <span className="ml-1 text-gray-300 group-hover:text-[#A6261D]">›</span>}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-gray-500">{rand(node.value)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
