// "About Pareto" explanatory panel — replicates the PBI HTML_PARETO_INFORMATION box.
// Static content; the threshold value is interpolated so it tracks the chart's 80% line.

export function ParetoInfo({ threshold = 0.8, brandsInThreshold, brandCount }: {
  threshold?: number;
  brandsInThreshold?: number;
  brandCount?: number;
}) {
  const pct = Math.round(threshold * 100);
  return (
    <div className="space-y-2 text-xs leading-relaxed text-gray-600">
      <p className="font-semibold text-gray-800">About Pareto (the 80/20 rule)</p>
      <p>
        The Pareto principle states that roughly{" "}
        <span className="font-semibold text-[#A6261D]">{pct}%</span> of effects come from{" "}
        <span className="font-semibold text-[#A6261D]">20%</span> of causes. Applied to sales, a
        small set of brands and products usually drives most of the revenue.
      </p>
      <p>
        The cumulative line shows the running share of total sales as members are added from
        highest to lowest. Bars left of the{" "}
        <span className="font-semibold text-[#A6261D]">{pct}%</span> threshold are the vital few
        that warrant the most attention.
      </p>
      {brandsInThreshold != null && brandCount != null && (
        <p className="rounded-lg bg-[#A6261D]/[0.05] px-3 py-2 font-medium text-gray-700">
          {brandsInThreshold} of {brandCount} brands drive {pct}% of revenue.
        </p>
      )}
    </div>
  );
}
