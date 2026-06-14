// Shared report card with the PBI title register (uppercase bold navy). Server-safe.

export function ReportCard({ title, subtitle, children, className = "", action }: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h3 style={{ color: "#0f2a43" }} className="text-[13px] font-bold uppercase tracking-wide">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
