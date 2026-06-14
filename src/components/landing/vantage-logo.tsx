// Vantage brand logo — a teal "vantage point": a bold V with a focal dot at the summit.
// Generated mark (no external asset). Brand = deep teal-blue (#0E6478) → bright (#18A8C4), light mode.

export function VantageMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="vg" x1="6" y1="34" x2="34" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0C4A5A" />
          <stop offset="1" stopColor="#18A8C4" />
        </linearGradient>
      </defs>
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="11" fill="url(#vg)" />
      {/* V */}
      <path d="M11.5 13 L20 27.5 L28.5 13" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* focal "vantage point" dot */}
      <circle cx="31.4" cy="10.6" r="2.5" fill="#fff" />
    </svg>
  );
}

export function VantageLogo({ size = 30, color = "#0A2A31", subtle = false }: { size?: number; color?: string; subtle?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <VantageMark size={size} />
      <span style={{ fontSize: size * 0.66, fontWeight: 800, letterSpacing: "-0.02em", color }}>
        Vantage
        {!subtle && <span style={{ color: "#18A8C4" }}>.</span>}
      </span>
    </span>
  );
}
