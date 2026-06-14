#!/usr/bin/env node
// ============================================================================
// READ-ONLY cross-reference: live CIN7 pull vs a SICN export file. Writes nothing.
//   node --env-file=.env.local scripts/xref-cin7.mjs --from 2026-05-01 --to 2026-06-10
//
// Corrected rules (see reference/analysis/cin7-pipeline-reconciliation.md):
//   A) tax mode from detail.TaxCalculation (Inclusive: Total is gross; Exclusive: net)
//   B) issued docs only (Invoice AUTHORISED/PAID, CreditNote AUTHORISED); no order fallback
//   C) date by each document's own date
//   D) include AdditionalCharges (delivery fees, account 4000-1)
//   E) union SaleIDs from saleList AND saleCreditNoteList (standalone credit notes are
//      separate tasks absent from saleList)
// ============================================================================

const BASE = (process.env.CIN7_BASE_URL?.trim() || "https://inventory.dearsystems.com/ExternalApi/v2").replace(/\/+$/, "");
const H = {
  "api-auth-accountid": process.env.CIN7_ACCOUNT_ID?.trim(),
  "api-auth-applicationkey": process.env.CIN7_API_KEY?.trim(),
  "Content-Type": "application/json",
};
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const FROM = arg("--from", "2026-05-01");
const TO = arg("--to", "2026-06-10");
const DELAY = 280;
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

async function listSaleIds(endpoint) {
  const ids = new Set();
  let page = 1, total = Infinity, scanned = 0;
  while (scanned < total) {
    const resp = await get(endpoint, { Page: page, Limit: 100, UpdatedSince: FROM });
    total = resp.Total ?? 0;
    const list = resp.SaleList || resp.SaleCreditNoteList || resp.CreditNoteList || [];
    if (!list.length) break;
    for (const h of list) if (h.SaleID) ids.add(h.SaleID);
    scanned += list.length;
    console.error(`  ${endpoint} page ${page}: ${scanned}/${total} (${ids.size} unique ids)`);
    page += 1;
    await sleep(DELAY);
  }
  return ids;
}

const ISSUED_INV = new Set(["AUTHORISED", "PAID"]);
const ISSUED_CN = new Set(["AUTHORISED"]);

function docLines({ lines, sign, inclusive, docDate }) {
  const out = [];
  for (const l of lines || []) {
    const qty = num(l.Quantity), tax = num(l.Tax), t = num(l.Total);
    out.push({
      date: docDate,
      qty: sign * qty,
      amount: sign * (inclusive ? t - tax : t),
      tax: sign * tax,
      total: sign * (inclusive ? t : t + tax),
    });
  }
  return out;
}

const DOCS = [];
const SEEN_DOCS = new Set(); // Rule F: each document number counted once (CNs are reachable from multiple sale tasks)
function saleToRows(d) {
  const inclusive = String(d.TaxCalculation || "").toLowerCase() === "inclusive";
  const rows = [];
  for (const inv of d.Invoices || []) {
    if (!ISSUED_INV.has(String(inv.Status || "").toUpperCase())) continue;
    if (inv.InvoiceNumber && SEEN_DOCS.has(`I:${inv.InvoiceNumber}`)) continue;
    if (inv.InvoiceNumber) SEEN_DOCS.add(`I:${inv.InvoiceNumber}`);
    const dt = toDate(inv.InvoiceDate);
    const ls = [...docLines({ lines: inv.Lines, sign: 1, inclusive, docDate: dt }), ...docLines({ lines: inv.AdditionalCharges, sign: 1, inclusive, docDate: dt })];
    rows.push(...ls);
    DOCS.push({ date: dt, num: inv.InvoiceNumber, kind: "Invoice", status: inv.Status, customer: d.Customer, type: d.Type, source: d.SourceChannel, location: d.Location, n: ls.length, net: ls.reduce((a, r) => a + r.amount, 0) });
  }
  for (const cn of d.CreditNotes || []) {
    if (!ISSUED_CN.has(String(cn.Status || "").toUpperCase())) continue;
    if (cn.CreditNoteNumber && SEEN_DOCS.has(`C:${cn.CreditNoteNumber}`)) continue;
    if (cn.CreditNoteNumber) SEEN_DOCS.add(`C:${cn.CreditNoteNumber}`);
    const dt = toDate(cn.CreditNoteDate);
    const ls = [...docLines({ lines: cn.Lines, sign: -1, inclusive, docDate: dt }), ...docLines({ lines: cn.AdditionalCharges, sign: -1, inclusive, docDate: dt })];
    rows.push(...ls);
    DOCS.push({ date: dt, num: cn.CreditNoteNumber, kind: "Credit note", status: cn.Status, customer: d.Customer, type: d.Type, source: d.SourceChannel, location: d.Location, n: ls.length, net: ls.reduce((a, r) => a + r.amount, 0) });
  }
  return rows;
}

async function main() {
  console.error(`Window ${FROM} .. ${TO}`);
  console.error("Collecting SaleIDs (saleList ∪ saleCreditNoteList) ...");
  const a = await listSaleIds("saleList");
  const b = await listSaleIds("saleCreditNoteList");
  const ids = new Set([...a, ...b]);
  console.error(`saleList=${a.size}  creditNoteList=${b.size}  union=${ids.size}`);

  const rows = [];
  let i = 0;
  for (const id of ids) {
    try { rows.push(...saleToRows(await get("sale", { ID: id }))); }
    catch (e) { console.error(`  ! ${id}: ${e.message}`); }
    if (++i % 50 === 0) console.error(`  detail ${i}/${ids.size} -> ${rows.length} rows`);
    await sleep(DELAY);
  }
  const inWin = rows.filter((r) => r.date && r.date >= FROM && r.date <= TO);
  const byDay = {};
  for (const r of inWin) {
    (byDay[r.date] ||= { n: 0, amount: 0, tax: 0, total: 0, qty: 0 });
    const a2 = byDay[r.date];
    a2.n++; a2.amount += r.amount; a2.tax += r.tax; a2.total += r.total; a2.qty += r.qty;
  }
  console.log(JSON.stringify({
    window: [FROM, TO], rows: inWin.length, byDay,
    totals: inWin.reduce((a2, r) => ({ amount: a2.amount + r.amount, tax: a2.tax + r.tax, total: a2.total + r.total, qty: a2.qty + r.qty }), { amount: 0, tax: 0, total: 0, qty: 0 }),
    docs: DOCS.filter((x) => x.date >= FROM && x.date <= TO),
  }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
