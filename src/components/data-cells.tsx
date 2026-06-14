// Table cell helpers shared across the tabular / performance matrices.
// RAG status always pairs color with a value + glyph (color is never the only signal).

import { rand, percent, ragTone } from "@/lib/format";

export function MoneyCell({ value, bold = false }: { value: number | null; bold?: boolean }) {
  const neg = (value ?? 0) < 0;
  return (
    <span
      className={`tabular-nums ${bold ? "font-semibold" : ""}`}
      style={{ color: neg ? "#c4321c" : undefined }}
    >
      {rand(value)}
    </span>
  );
}

export function AchievementCell({ achievement }: { achievement: number | null }) {
  if (achievement == null) return <span className="text-gray-300">—</span>;
  const tone = ragTone(achievement);
  const cls =
    tone === "positive" ? "badge-positive" : tone === "warning" ? "badge-warning" : "badge-negative";
  const glyph = tone === "positive" ? "▲" : tone === "warning" ? "►" : "▼";
  return (
    <span className={`badge ${cls} tabular-nums`}>
      <span aria-hidden>{glyph}</span>
      {percent(achievement)}
    </span>
  );
}

export function GrowthCell({ ratio }: { ratio: number | null }) {
  if (ratio == null) return <span className="text-gray-300">—</span>;
  const pos = ratio >= 0;
  return (
    <span className="tabular-nums" style={{ color: pos ? "#16804b" : "#c4321c" }}>
      {pos ? "▲" : "▼"} {percent(Math.abs(ratio))}
    </span>
  );
}
