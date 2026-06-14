"use client";

// Power BI-faithful slicer system for the KRDM report:
//   • A compact top strip — FISCAL YEAR + REPRESENTATIVE + an "Additional Filter" toggle.
//   • A slide-over FILTER PANEL holding the remaining 9 slicers (Quarter, Month, Week Start,
//     Date, Brand, Product, Invoice/Credit, Customer, SKU) — mirrors the PBI filter pane.
// State lives in the URL; options are cross-filtered (each slicer constrained by every OTHER).

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { activeChips, type Filters } from "@/lib/filters";
import { getSlicerOptions, type SlicerOptions } from "@/lib/data/slicers";
import { Combobox, type ComboItem } from "@/components/filters/combobox";
import { X, RotateCcw, SlidersHorizontal, ChevronDown } from "lucide-react";

const FM_SHORT = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
const fmLabel = (v: string) => FM_SHORT[Number(v) - 1] ?? v;
const fyLabel = (fy: string) => { const s = Number(fy.replace(/\D/g, "")); return Number.isFinite(s) ? `${s}-${s + 1}` : fy; };
const dateLabel = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Number.isFinite(d) ? `${d} ${FM_SHORT[(m + 9) % 12]} ${y}` : iso; };

const EMPTY: SlicerOptions = { rep: [], brand: [], customer: [], product: [], sku: [], quarter: [], month: [], invoice: [], fiscalYears: [] };

// Slicers that live inside the slide-over panel (everything except FY + Rep on the top strip).
const PANEL_KEYS: (keyof Filters)[] = ["quarter", "month", "weekStart", "date", "dateFrom", "dateTo", "brand", "product", "invoice", "customer", "sku"];

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const spString = sp.toString();
  const [opts, setOpts] = useState<SlicerOptions>(EMPTY);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  const current: Filters = useMemo(() => {
    const f: Filters = {};
    for (const k of ["fy", "rep", "brand", "customer", "quarter", "month", "weekStart", "date", "dateFrom", "dateTo", "product", "sku", "invoice"] as (keyof Filters)[]) {
      const v = sp.get(k);
      if (v) f[k] = v;
    }
    return f;
  }, [sp]);

  // Cross-filtered options: re-fetch on ANY filter change so each slicer is constrained by all others.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      let fy = current.fy ?? "";
      if (!fy) {
        const { data } = await supabase.from("v_month_totals").select("fiscal_year").gt("sales_amount", 0).order("fiscal_year", { ascending: false }).limit(1);
        fy = (data?.[0]?.fiscal_year as string) || "FY2026";
      }
      const [so, wk] = await Promise.all([
        getSlicerOptions(supabase, { ...current, fy }),
        // Week-start options from the calendar (≤366 rows — safe under the 1000-row cap).
        supabase.from("calendar").select("week_start_date").eq("fiscal_year", fy).order("week_start_date"),
      ]);
      if (cancelled) return;
      setOpts(so);
      const ws = [...new Set(((wk.data ?? []) as { week_start_date: string }[]).map((r) => String(r.week_start_date).slice(0, 10)).filter(Boolean))];
      setWeeks(ws);
    })();
    return () => { cancelled = true; };
  }, [spString]); // eslint-disable-line react-hooks/exhaustive-deps

  function setParams(updates: Partial<Record<keyof Filters, string | null>>) {
    const p = new URLSearchParams(spString);
    for (const [k, v] of Object.entries(updates)) { if (v) p.set(k, v); else p.delete(k); }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }
  const set = (k: keyof Filters, v: string | null) => setParams({ [k]: v });
  function clearPanel() {
    const updates: Partial<Record<keyof Filters, string | null>> = {};
    for (const k of PANEL_KEYS) updates[k] = null;
    setParams(updates);
  }
  function clearAll() {
    const p = new URLSearchParams();
    if (current.fy) p.set("fy", current.fy);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  const ci = (xs: { value: string; label: string; n: number }[]): ComboItem[] => xs.map((o) => ({ value: o.value, label: o.label, n: o.n }));
  const panelCount = activeChips(current).filter((c) => PANEL_KEYS.includes(c.key)).length;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
      {/* FISCAL YEAR */}
      <label className="flex items-center gap-2.5">
        <span className="topbar-label">Fiscal Year</span>
        <div className="relative">
          <select
            value={current.fy ?? ""}
            onChange={(e) => set("fy", e.target.value || null)}
            className={`topbar-select ${current.fy ? "topbar-select--active" : ""}`}
          >
            <option value="">Active</option>
            {opts.fiscalYears.map((f) => <option key={f} value={f}>{fyLabel(f)}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </label>

      {/* REPRESENTATIVE */}
      <div className="flex items-center gap-2.5">
        <span className="topbar-label">Representative</span>
        <Combobox label="" placeholder="All" value={current.rep ?? null} items={ci(opts.rep)} onChange={(v) => set("rep", v)} width={200} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {panelCount > 0 && (
          <button onClick={clearAll} className="flex h-9 items-center gap-1.5 rounded-[10px] border border-[#A6261D]/30 px-3 text-sm font-medium text-[#A6261D] transition hover:bg-[#A6261D]/[0.06]">
            <RotateCcw size={13} /> Reset
          </button>
        )}
        {/* Additional Filter toggle */}
        <button
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          className={`flex h-9 items-center gap-2 rounded-[10px] border px-3.5 text-sm font-semibold transition ${
            panelOpen
              ? "border-[#1FA8C9] bg-[#1FA8C9] text-white"
              : "border-[#1FA8C9]/40 bg-[#1FA8C9]/10 text-[#0e7490] hover:bg-[#1FA8C9]/15"
          }`}
        >
          <SlidersHorizontal size={15} />
          {panelOpen ? "Close Filter Pane" : "Additional Filter"}
          {panelCount > 0 && (
            <span className={`grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold ${panelOpen ? "bg-white text-[#0e7490]" : "bg-[#A6261D] text-white"}`}>
              {panelCount}
            </span>
          )}
        </button>
      </div>

      {/* Slide-over filter panel */}
      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[1px]"
              onClick={() => setPanelOpen(false)}
            />
            <motion.aside
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
              className="fixed inset-y-0 right-0 z-50 flex w-[380px] max-w-[92vw] flex-col bg-white shadow-[0_0_40px_-8px_rgba(0,0,0,0.25)]"
            >
              <div className="flex items-center justify-between border-b border-black/[0.07] px-5 py-4">
                <h2 className="text-base font-bold tracking-[0.08em] text-[#0f2a43]">FILTER PANEL</h2>
                <button onClick={() => setPanelOpen(false)} aria-label="Close filter panel" className="grid h-7 w-7 place-items-center rounded-md text-gray-400 transition hover:bg-black/[0.04] hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <PanelSelect label="Quarter" value={current.quarter ?? ""} onChange={(v) => set("quarter", v || null)} options={opts.quarter.map((o) => ({ v: o.value, l: o.value }))} />
                  <PanelSelect label="Month" value={current.month ?? ""} onChange={(v) => set("month", v || null)} options={opts.month.map((o) => ({ v: o.value, l: fmLabel(o.value) }))} />
                </div>

                <PanelSelect label="Week Start" value={current.weekStart ?? ""} onChange={(v) => set("weekStart", v || null)} options={weeks.map((w) => ({ v: w, l: dateLabel(w) }))} />

                <div className="flex flex-col gap-1.5">
                  <span className="panel-label">Date</span>
                  <div className="topbar-select flex items-center gap-1.5 px-2.5">
                    <input type="date" value={current.dateFrom ?? ""} max={current.dateTo || undefined} onChange={(e) => set("dateFrom", e.target.value || null)} aria-label="From date" className="w-full bg-transparent text-sm text-gray-700 outline-none [color-scheme:light]" />
                    <span className="text-gray-300">–</span>
                    <input type="date" value={current.dateTo ?? ""} min={current.dateFrom || undefined} onChange={(e) => set("dateTo", e.target.value || null)} aria-label="To date" className="w-full bg-transparent text-sm text-gray-700 outline-none [color-scheme:light]" />
                  </div>
                </div>

                <PanelCombo label="Brand" placeholder="All" value={current.brand ?? null} items={ci(opts.brand)} onChange={(v) => set("brand", v)} />
                <PanelCombo label="Product" placeholder="All" value={current.product ?? null} items={ci(opts.product)} onChange={(v) => set("product", v)} />
                <PanelSelect label="Invoice / Credit" value={current.invoice ?? ""} onChange={(v) => set("invoice", v || null)} options={opts.invoice.map((o) => ({ v: o.value, l: o.value }))} />
                <PanelCombo label="Customer" placeholder="All" value={current.customer ?? null} items={ci(opts.customer)} onChange={(v) => set("customer", v)} />
                <PanelCombo label="SKU" placeholder="All" value={current.sku ?? null} items={ci(opts.sku)} onChange={(v) => set("sku", v)} />
              </div>

              <div className="flex items-center justify-between border-t border-black/[0.07] px-5 py-3.5">
                <span className="text-xs text-gray-400">{panelCount} active filter{panelCount === 1 ? "" : "s"}</span>
                <button onClick={clearPanel} disabled={panelCount === 0} className="flex items-center gap-1.5 rounded-[10px] border border-black/10 px-3 py-1.5 text-sm font-medium text-gray-600 transition enabled:hover:border-[#A6261D]/40 enabled:hover:text-[#A6261D] disabled:opacity-40">
                  <RotateCcw size={13} /> Clear filters
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Native-select slicer styled to match the panel.
function PanelSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="panel-label">{label}</span>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`topbar-select w-full ${value ? "topbar-select--active" : ""}`}>
          <option value="">All</option>
          {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>
    </label>
  );
}

// Searchable combobox slicer for the panel (full-width).
function PanelCombo({ label, placeholder, value, items, onChange }: { label: string; placeholder: string; value: string | null; items: ComboItem[]; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="panel-label">{label}</span>
      <Combobox label="" placeholder={placeholder} value={value} items={items} onChange={onChange} width="100%" />
    </div>
  );
}
