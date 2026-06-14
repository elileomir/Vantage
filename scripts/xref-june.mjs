#!/usr/bin/env node
// ============================================================================
// READ-ONLY cross-reference: live CIN7 pull (June 1-9) vs the SICN export file.
// Writes NOTHING to the database. Proves the corrected mapping/inclusion rules
// reproduce reference/sales/SICN_June 2026.xlsx.
//
//   node --env-file=.env.local scripts/xref-june.mjs
//
// Corrected rules vs the current sync:
//   (A) Tax mode: respect detail.TaxCalculation.
//         Inclusive -> line.Total is GROSS: amount = Total - Tax, total = Total
//         Exclusive -> line.Total is NET:   amount = Total,        total = Total + Tax
//   (B) Inclusion: ONLY issued Invoices (Status AUTHORISED/PAID) and issued
//       CreditNotes (Status AUTHORISED). NO Order.Lines fallback (that fabricates
//       rows for un-invoiced orders, e.g. International Hotel School).
//   (C) Date: each line dated by its OWN document date (InvoiceDate / CreditNoteDate).
// ============================================================================

const BASE = (process.env.CIN7_BASE_URL?.trim() || "https://inventory.dearsystems.com/ExternalApi/v2").replace(/\/+$/, "");
const H = {
  "api-auth-accountid": process.env.CIN7_ACCOUNT_ID?.trim(),
  "api-auth-applicationkey": process.env.CIN7_API_KEY?.trim(),
  "Content-Type": "application/json",
};
const FROM = "2026-06-01";
const TO = "2026-06-09";
const DELAY = 300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toDate = (v) => { const m = String(v ?? "").match(/^(\d{4}-\d{2}-\d{2})/); return m ? m[1] : null; };
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

async function get(path, params = {}, tries = 0) {
  const u = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") u.searchParams.set(k, String(v));
  const r = await fetch(u, { headers: H });
  if (r.ok) return r.json();
  if ((r.status === 429 || r.status === 503) && tries < 6) {
    const wait = 1000 * 2 ** tries;
    console.error(`  throttled ${r.status}; wait ${wait}ms`);
    await sleep(wait);
    return get(path, params, tries + 1);
  }
  throw new Error(`CIN7 ${r.status} on ${path}`);
}

const ISSUED_INV = new Set(["AUTHORISED", "PAID"]);
const ISSUED_CN = new Set(["AUTHORISED"]);

function docLines({ lines, sign, kind, inclusive, docDate }) {
  const out = [];
  for (const l of lines || []) {
    const qty = num(l.Quantity);
    const tax = num(l.Tax);
    const lineTotal = num(l.Total);
    const net = inclusive ? lineTotal - tax : lineTotal;
    const gross = inclusive ? lineTotal : lineTotal + tax;
    out.push({
      date: docDate, kind,
      qty: sign * qty, amount: sign * net, tax: sign * tax, total: sign * gross,
      sku: l.SKU, product: l.Name,
    });
  }
  return out;
}

function saleToRows(detail) {
  const inclusive = String(detail.TaxCalculation || "").toLowerCase() === "inclusive";
  const rows = [];
  for (const inv of detail.Invoices || []) {
    if (!ISSUED_INV.has(String(inv.Status || "").toUpperCase())) continue;
    const docDate = toDate(inv.InvoiceDate);
    // Product lines + AdditionalCharges (delivery/freight fees, GL account 4000-1) — the
    // SICN report lists both. AdditionalCharges carry Total/Tax like lines.
    rows.push(...docLines({ lines: inv.Lines, sign: 1, kind: "Invoice", inclusive, docDate }));
    rows.push(...docLines({ lines: inv.AdditionalCharges, sign: 1, kind: "Invoice", inclusive, docDate }));
  }
  for (const cn of detail.CreditNotes || []) {
    if (!ISSUED_CN.has(String(cn.Status || "").toUpperCase())) continue;
    const docDate = toDate(cn.CreditNoteDate);
    rows.push(...docLines({ lines: cn.Lines, sign: -1, kind: "Credit note", inclusive, docDate }));
    rows.push(...docLines({ lines: cn.AdditionalCharges, sign: -1, kind: "Credit note", inclusive, docDate }));
  }
  return rows;
}

async function main() {
  console.error(`Pulling saleList UpdatedSince=${FROM} ...`);
  const headers = [];
  let page = 1, total = Infinity, scanned = 0;
  while (scanned < total) {
    const resp = await get("saleList", { Page: page, Limit: 100, UpdatedSince: FROM });
    total = resp.Total ?? 0;
    const list = resp.SaleList || [];
    if (!list.length) break;
    headers.push(...list);
    scanned += list.length;
    console.error(`  page ${page}: ${scanned}/${total}`);
    page += 1;
    await sleep(DELAY);
  }
  console.error(`Fetching detail for ${headers.length} sales ...`);
  const rows = [];
  let i = 0;
  for (const h of headers) {
    try {
      const d = await get("sale", { ID: h.SaleID });
      rows.push(...saleToRows(d));
    } catch (e) { console.error(`  ! ${h.SaleID}: ${e.message}`); }
    if (++i % 25 === 0) console.error(`  ${i}/${headers.length} -> ${rows.length} rows`);
    await sleep(DELAY);
  }
  const inWin = rows.filter((r) => r.date && r.date >= FROM && r.date <= TO);
  const byDay = {};
  for (const r of inWin) {
    (byDay[r.date] ||= { n: 0, amount: 0, tax: 0, total: 0, qty: 0 });
    const a = byDay[r.date];
    a.n++; a.amount += r.amount; a.tax += r.tax; a.total += r.total; a.qty += r.qty;
  }
  const out = { window: [FROM, TO], byDay, rows: inWin.length,
    totals: inWin.reduce((a, r) => ({ amount: a.amount + r.amount, tax: a.tax + r.tax, total: a.total + r.total, qty: a.qty + r.qty }), { amount: 0, tax: 0, total: 0, qty: 0 }) };
  console.log(JSON.stringify(out, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
