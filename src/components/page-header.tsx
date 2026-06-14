export function PageHeader({
  title,
  subtitle,
  asOf,
}: {
  title: string;
  subtitle?: string;
  asOf?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {asOf && (
        <span className="rounded-full px-3 py-1 text-xs font-medium text-gray-500" style={{ background: "#f5f4f1", border: "1px solid #edebe7" }}>
          {asOf}
        </span>
      )}
    </div>
  );
}
