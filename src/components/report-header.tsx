// Shared PBI-style report header: the real KRDM logo + page title + "Data as of".
// Inline styles → immune to Tailwind JIT/cache state; identical across every report page.

import Image from "next/image";

export function KrdmLogo() {
  // Real KRDM "Innovative Homeware" logo (public/krdm-logo.png, 640×443, transparent pink badge).
  return <Image src="/krdm-logo.png" alt="KRDM — Innovative Homeware" width={67} height={46} priority style={{ height: 46, width: "auto", display: "block" }} />;
}

export function ReportHeader({ title, subtitle, asOf }: { title: string; subtitle: string; asOf: string }) {
  return (
    <header
      style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", padding: "14px 20px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <KrdmLogo />
        <div style={{ borderLeft: "3px solid #D91C5C", paddingLeft: 16 }}>
          <h1 style={{ color: "#0f2a43", fontSize: 20, fontWeight: 800, lineHeight: 1.15, letterSpacing: "0.1em", margin: 0 }}>{title}</h1>
          <p style={{ color: "#1f4e6b", fontSize: 12, fontWeight: 500, marginTop: 2 }}>{subtitle}</p>
        </div>
      </div>
      <span style={{ color: "#1FA8C9", fontSize: 14, fontWeight: 600 }}>Data as of: {asOf}</span>
    </header>
  );
}
