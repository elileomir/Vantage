// Server-renderable KPI stat. Restrained: label, value, optional growth/sub. No gradient, no nested cards.

import { growthLabel } from "@/lib/format";

export function KpiStat({
  label,
  value,
  sub,
  growth,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  growth?: number | null;
  accent?: boolean;
}) {
  const g = growth !== undefined ? growthLabel(growth) : null;
  const toneClass =
    g?.tone === "positive" ? "badge-positive" : g?.tone === "negative" ? "badge-negative" : "badge-info";
  return (
    <div className="metric-card">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-gray-400">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className="text-2xl font-semibold tabular-nums tracking-tight"
          style={{ color: accent ? "#a1145c" : "#1a1a1a" }}
        >
          {value}
        </span>
        {g && g.text !== "—" && <span className={`badge ${toneClass}`}>{g.text}</span>}
      </div>
      {sub && <p className="mt-1 text-[0.8125rem] text-gray-400">{sub}</p>}
    </div>
  );
}
