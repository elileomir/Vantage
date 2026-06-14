import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { VantageLogo } from "./vantage-logo";

export function LegalShell({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white" style={{ color: "#0A2A31" }}>
      <header className="border-b border-[#EAF2F4]">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/"><VantageLogo size={26} /></Link>
          <Link href="/" className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "#51707A" }}>
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm" style={{ color: "#8aa3aa" }}>Last updated: {updated}</p>
        <div className="mt-4 rounded-xl border border-[#E3EEF0] bg-[#F4FBFC] p-4 text-sm" style={{ color: "#51707A" }}>
          This is a starting template provided for convenience and is <b>not legal advice</b>. Please have it reviewed by qualified legal counsel before relying on it.
        </div>
        <div className="legal-prose mt-8 space-y-6 text-[15px] leading-relaxed" style={{ color: "#33535b" }}>
          {children}
        </div>
      </main>

      <footer className="border-t border-[#EAF2F4]">
        <div className="mx-auto max-w-3xl px-5 py-8 text-sm" style={{ color: "#8aa3aa" }}>
          © {new Date().getFullYear()} Vantage · iAutomateDev. ·{" "}
          <Link href="/terms" className="hover:text-[#0E6478]">Terms</Link> ·{" "}
          <Link href="/privacy" className="hover:text-[#0E6478]">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 text-lg font-bold" style={{ color: "#0A2A31" }}>{heading}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
