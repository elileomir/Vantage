"use client";

import { useState } from "react";
import { rand } from "@/lib/format";

export interface TreeLeaf { name: string; value: number; }
export interface TreeBrand extends TreeLeaf { products: TreeLeaf[]; }

const H = 50;       // node height
const G = 18;       // vertical gap
const COL_W = 250;  // node width
const X = { root: 0, brand: 330, product: 680 };
const ACCENT = "#a1145c";

function curve(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

function Node({
  x, y, name, value, frac, bold, root, selected, onClick,
}: {
  x: number; y: number; name: string; value: number; frac: number;
  bold?: boolean; root?: boolean; selected?: boolean; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={onClick ? "cursor-pointer text-left" : "text-left"}
      style={{ position: "absolute", left: x, top: y, width: COL_W, height: H }}
    >
      <div
        className="h-2 rounded-sm"
        style={{ width: `${Math.max(frac * 100, value > 0 ? 4 : 0)}%`, minWidth: value > 0 ? 6 : 0, background: root || selected ? ACCENT : "#5aa9c9" }}
      />
      <div className="mt-1 truncate text-[0.8125rem] leading-tight" style={{ fontWeight: bold || selected ? 600 : 500, color: "#1a1a1a" }} title={name}>
        {name}
      </div>
      <div className="text-xs tabular-nums text-gray-500">{rand(value)}</div>
    </button>
  );
}

/** Power BI-style decomposition tree: Sales -> Brand -> Product, with curved connectors.
 *  Click a brand to drill its products. */
export function DecompositionTree({ total, totalLabel = "Sales", brands }: { total: number; totalLabel?: string; brands: TreeBrand[] }) {
  const [sel, setSel] = useState(0);
  const products = brands[sel]?.products ?? [];
  const nBrand = brands.length;
  const nProd = products.length;
  const rows = Math.max(nBrand, nProd, 1);
  const height = rows * (H + G);
  const maxB = Math.max(1, ...brands.map((b) => b.value));
  const maxP = Math.max(1, ...products.map((p) => p.value));
  const width = X.product + COL_W;

  // center y of node i within a column of n nodes (column block vertically centered)
  const cy = (i: number, n: number) => (height - n * (H + G)) / 2 + i * (H + G) + H / 2;
  const rootCy = height / 2;

  return (
    <div className="overflow-x-auto">
      <div className="relative" style={{ width, height, minWidth: width }}>
        <svg className="absolute inset-0" width={width} height={height} style={{ pointerEvents: "none" }} aria-hidden>
          {brands.map((b, i) => (
            <path key={`b${i}`} d={curve(X.root + COL_W, rootCy, X.brand, cy(i, nBrand))}
              fill="none" stroke={i === sel ? ACCENT : "#d4d1cb"} strokeWidth={i === sel ? 2 : 1.5} />
          ))}
          {products.map((p, i) => (
            <path key={`p${i}`} d={curve(X.brand + COL_W, cy(sel, nBrand), X.product, cy(i, nProd))}
              fill="none" stroke="#cfcbc4" strokeWidth={1.5} />
          ))}
        </svg>

        <Node x={X.root} y={rootCy - H / 2} name={totalLabel} value={total} frac={1} root bold />
        {brands.map((b, i) => (
          <Node key={`bn${i}`} x={X.brand} y={cy(i, nBrand) - H / 2} name={b.name} value={b.value} frac={b.value / maxB} selected={i === sel} onClick={() => setSel(i)} />
        ))}
        {products.map((p, i) => (
          <Node key={`pn${i}`} x={X.product} y={cy(i, nProd) - H / 2} name={p.name} value={p.value} frac={p.value / maxP} />
        ))}
      </div>
    </div>
  );
}
