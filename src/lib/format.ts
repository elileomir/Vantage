// Formatting helpers — South African Rand, matching the Power BI report register
// (comma thousands separators, no decimals, e.g. R11,848,885 — never wraps).

/** R11,848,885 — full rand, no decimals, comma-grouped, non-wrapping. */
export function rand(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const neg = value < 0;
  const body = Math.round(Math.abs(value)).toLocaleString("en-US");
  return `${neg ? "-" : ""}R${body}`;
}

/** R1.8M / R469K — compact rand for axes and dense labels. */
export function randCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}R${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}R${(abs / 1_000).toFixed(0)}K`;
  return `${sign}R${abs.toFixed(0)}`;
}

/** 110% — whole-number percent from a ratio (0.110 -> "11%"). Expects a ratio, not a pre-scaled value. */
export function percent(ratio: number | null | undefined, digits = 0): string {
  if (ratio == null || Number.isNaN(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Plain integer with comma thousands separators. */
export function count(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Math.round(value).toLocaleString("en-US");
}

/** Signed growth label with arrow, e.g. "▲ 25%" / "▼ 48%". */
export function growthLabel(ratio: number | null | undefined): { text: string; tone: "positive" | "negative" | "neutral" } {
  if (ratio == null || Number.isNaN(ratio)) return { text: "—", tone: "neutral" };
  if (ratio > 0.0001) return { text: `▲ ${percent(ratio)}`, tone: "positive" };
  if (ratio < -0.0001) return { text: `▼ ${percent(Math.abs(ratio))}`, tone: "negative" };
  return { text: "0%", tone: "neutral" };
}

/** RAG tone from an achievement ratio (1 = 100%). */
export function ragTone(achievement: number | null | undefined): "positive" | "warning" | "negative" | "neutral" {
  if (achievement == null || Number.isNaN(achievement)) return "neutral";
  if (achievement >= 1) return "positive";
  if (achievement >= 0.8) return "warning";
  return "negative";
}
