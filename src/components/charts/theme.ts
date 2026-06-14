// KRDM chart palette + RAG colour helper. PURE constants/functions, NO "use client" —
// so both server components (page.tsx inline styles) and client chart components can use them.
// (Values exported from a "use client" module become client references and cannot be called
//  or read during server render — keep these here, not in echarts.tsx.)

export const KRDM = {
  red: "#A6261D", // brand red (gauge fill, headline)
  cyan: "#1FA8C9", // sales bars
  magenta: "#C2185B", // achievement / accent line
  grey: "#E6E6E6", // remainder / track
  greyText: "#6B7280",
  green: "#00B050", // RAG green (>=100%)
  amber: "#FFC000", // RAG amber (80–100%)
  redNeg: "#E53935", // RAG red / negative
  ink: "#1F2937",
};

/** RAG colour for an achievement ratio (1 = 100%). */
export function ragColor(ratio: number | null | undefined): string {
  if (ratio == null) return KRDM.grey;
  if (ratio >= 1) return KRDM.green;
  if (ratio >= 0.8) return KRDM.amber;
  return KRDM.redNeg;
}
