"use client";

// Searchable single-select combobox — typeahead, keyboard nav, option counts, clearable.
// Built for large option sets (customers, products) where a native <select> is unusable.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronsUpDown, CornerDownLeft, Search, X } from "lucide-react";

export interface ComboItem {
  value: string;
  label: string;
  n?: number;
}

// Highlight the matched substring of the query within a label.
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-[3px] bg-[#A6261D]/15 px-px text-[#A6261D]">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export function Combobox({
  label, placeholder = "All", value, items, onChange, width = 180,
}: {
  label: string;
  placeholder?: string;
  value: string | null;
  items: ComboItem[];
  onChange: (v: string | null) => void;
  width?: number | string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = items.find((i) => i.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
    return base.slice(0, 200);
  }, [items, query]);

  useEffect(() => {
    if (open) { setQuery(""); setHi(0); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Keep the highlighted option scrolled into view as the user navigates.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${hi}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [hi, open]);

  function choose(v: string | null) { onChange(v); setOpen(false); }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const it = filtered[hi]; if (it) choose(it.value); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "Tab") setOpen(false);
  }

  return (
    <div className="relative flex flex-col gap-1" ref={ref} style={{ width }}>
      {label && <span className="slicer-label">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected ? selected.label : placeholder}`}
        className={`slicer-control group flex items-center justify-between gap-1.5 text-left ${
          selected ? "slicer-control--active" : "text-gray-500"
        }`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        {selected ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label={`Clear ${label}`}
            className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-gray-400 transition hover:bg-[#A6261D]/10 hover:text-[#A6261D]"
            onClick={(e) => { e.stopPropagation(); choose(null); }}
          >
            <X size={12} />
          </span>
        ) : (
          <ChevronsUpDown size={14} className={`shrink-0 text-gray-300 transition group-hover:text-gray-400 ${open ? "text-[#A6261D]" : ""}`} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985 }}
            transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full z-40 mt-1.5 w-[268px] origin-top overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.02]"
          >
            <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2.5">
              <Search size={14} className="shrink-0 text-gray-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setHi(0); }}
                onKeyDown={onKey}
                placeholder={`Search ${label.toLowerCase()}…`}
                aria-label={`Search ${label}`}
                aria-controls={listId}
                className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-300"
              />
              {query && (
                <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Clear search" className="shrink-0 text-gray-300 hover:text-gray-500">
                  <X size={13} />
                </button>
              )}
            </div>
            <ul ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
              <li role="option" aria-selected={!value}>
                <button onClick={() => choose(null)} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-gray-500 transition hover:bg-black/[0.03]">
                  <span className="italic">{placeholder}</span>
                  {!value && <Check size={14} className="text-[#A6261D]" />}
                </button>
              </li>
              {filtered.map((it, i) => (
                <li key={it.value} role="option" aria-selected={it.value === value}>
                  <button
                    data-idx={i}
                    onMouseEnter={() => setHi(i)}
                    onClick={() => choose(it.value)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition ${
                      i === hi ? "bg-[#A6261D]/[0.06]" : ""
                    } ${it.value === value ? "font-medium" : ""}`}
                  >
                    <span className="truncate text-gray-800"><Highlight text={it.label} query={query} /></span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {it.n != null && <span className="rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[10px] tabular-nums text-gray-400">{it.n}</span>}
                      {it.value === value && <Check size={14} className="text-[#A6261D]" />}
                    </span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="flex flex-col items-center gap-1 px-3 py-5 text-center">
                  <Search size={16} className="text-gray-300" />
                  <span className="text-xs text-gray-400">No matches for “{query}”</span>
                </li>
              )}
            </ul>
            <div className="flex items-center justify-between border-t border-black/5 bg-black/[0.015] px-3 py-1.5 text-[10px] text-gray-400">
              <span className="tabular-nums">{filtered.length} option{filtered.length === 1 ? "" : "s"}</span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-black/10 bg-white px-1 font-sans text-[9px] text-gray-500">↑↓</kbd>
                navigate
                <kbd className="ml-1 inline-flex items-center gap-0.5 rounded border border-black/10 bg-white px-1 font-sans text-[9px] text-gray-500"><CornerDownLeft size={8} /></kbd>
                select
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
