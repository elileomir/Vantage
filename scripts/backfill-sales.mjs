#!/usr/bin/env node
// ============================================================================
// CORRECTIVE + COMPLETING BACKFILL of public.sales from CIN7.
// Uses the validated shared expansion (Rules A–F). Runs in date-range stages so
// the full 2024+ history can be filled without one giant job or clobbering prior stages.
//
//   # Stage 1 (current FY, also purges old buggy data):
//   node --env-file=.env.local scripts/backfill-sales.mjs --created-since 2025-11-01 --keep-from 2026-03-01 --purge-all
//   # Stage 2 (prior FY):
//   node --env-file=.env.local scripts/backfill-sales.mjs --created-since 2024-12-01 --keep-from 2025-03-01 --keep-to 2026-02-28
//   # Stage 3 (FY2024 tail):
//   node --env-file=.env.local scripts/backfill-sales.mjs --created-since 2023-10-01 --keep-from 2024-01-01 --keep-to 2025-02-28
//
//   Flags: --dry-run (no write, validates), --resume (reuse checkpoint, skip fetched).
//
// Index: saleList ∪ saleCreditNoteList, CreatedSince=<created-since>, kept only if the header
//   shows an issued invoice (CombinedInvoiceStatus contains INVOICED) or credit note
//   (CreditNoteStatus AUTHORISED) — skips quotes/drafts/voided to save detail calls (Rule E + B).
// Write: replaces public.sales for [keep-from, keep-to] only (range-scoped, idempotent);
//   --purge-all additionally wipes everything first (use on the first stage).
// ============================================================================

import fs from "node:fs";
import { expandSale } from "./lib/cin7-expand.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const CREATED_SINCE = arg("--created-since", "2024-01-01");
const KEEP_FROM = arg("--keep-from", "2024-01-01");
const KEEP_TO = arg("--keep-to", "2999-12-31");
const UPDATED_UNTIL = arg("--updated-until", null); // bound the index for historical stages
const PURGE_ALL = process.argv.includes("--purge-all");
const DRY = process.argv.includes("--dry-run");
const RESUME = process.argv.includes("--resume");

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "cbrqfqxwexhoguoazhgh";
const PAT = process.env.SUPABASE_ACCESS_TOKEN || "";
const SUPA_API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
const BASE = (process.env.CIN7_BASE_URL?.trim() || "https://inventory.dearsystems.com/ExternalApi/v2").replace(/\/+$/, "");
const H = { "api-auth-accountid": process.env.CIN7_ACCOUNT_ID?.trim(), "api-auth-applicationkey": process.env.CIN7_API_KEY?.trim(), "Content-Type": "application/json" };

const tag = KEEP_FROM.replace(/-/g, ""); // checkpoint identity = the stage's keep-from
const ROWS_CKPT = `.tmp/backfill-rows-${tag}.jsonl`;
const DONE_CKPT = `.tmp/backfill-done-${tag}.txt`;
const PRODUCT_CACHE = ".tmp/product-master.json";
const INSERT_BATCH = 400;
const MIN_GAP = 900; // ~60/min to respect CIN7's hard cap and minimise 429 backoff churn

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let nextAt = 0;
async function paced() { const now = Date.now(); const wait = Math.max(0, nextAt - now); nextAt = Math.max(now, nextAt) + MIN_GAP; if (wait) await sleep(wait); }

async function get(path, params = {}, tries = 0) {
  await paced();
  const u = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") u.searchParams.set(k, String(v));
  const r = await fetch(u, { headers: H });
  if (r.ok) return r.json();
  if ((r.status === 429 || r.status === 503) && tries < 8) {
    const ra = Number(r.headers.get("retry-after"));
    const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1000 * 2 ** tries;
    console.error(`  throttled ${r.status}; wait ${wait}ms (retry ${tries + 1})`);
    await sleep(wait);
    return get(path, params, tries + 1);
  }
  throw new Error(`CIN7 ${r.status} on ${path}`);
}

async function runSql(query) {
  const res = await fetch(SUPA_API, { method: "POST", headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json", "User-Agent": "krdm-backfill/1.0" }, body: JSON.stringify({ query }) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${text.slice(0, 400)}`);
  return text;
}

async function loadProductMaster() {
  const byId = new Map(), bySku = new Map();
  if (fs.existsSync(PRODUCT_CACHE)) {
    const j = JSON.parse(fs.readFileSync(PRODUCT_CACHE, "utf8"));
    for (const [k, v] of j.byId) byId.set(k, v);
    for (const [k, v] of j.bySku) bySku.set(k, v);
    console.error(`Product master (cache): ${byId.size} by ID, ${bySku.size} by SKU.`);
    return { productById: byId, productBySku: bySku };
  }
  let page = 1, total = Infinity, loaded = 0;
  while (loaded < total) {
    const resp = await get("product", { Page: page, Limit: 1000, IncludeDeprecated: "true" });
    total = resp.Total ?? 0;
    const products = resp.Products || [];
    if (!products.length) break;
    for (const p of products) {
      const rec = { brand: p.Brand?.trim() || null, category: p.Category?.trim() || null };
      if (p.ID) byId.set(p.ID, rec);
      if (p.SKU != null) bySku.set(String(p.SKU).trim(), rec);
    }
    loaded += products.length; page += 1;
  }
  fs.writeFileSync(PRODUCT_CACHE, JSON.stringify({ byId: [...byId], bySku: [...bySku] }));
  console.error(`Product master loaded+cached: ${byId.size} by ID, ${bySku.size} by SKU.`);
  return { productById: byId, productBySku: bySku };
}

// keep header only if it has an issued invoice or an authorised credit note
const issuedHeader = (h) =>
  String(h.CombinedInvoiceStatus || "").toUpperCase().includes("INVOICED") ||
  String(h.CreditNoteStatus || "").toUpperCase() === "AUTHORISED";

// Index by UpdatedSince=KEEP_FROM: catches EVERY sale with any document dated >= KEEP_FROM
// (incl. older orders invoiced/credited in-window). CreatedSince misses those — proven by the
// FY2026 dry-run (−23 docs, mostly credit notes). Correctness over fewer calls.
async function collectSaleIds() {
  const ids = new Set();
  for (const [endpoint, key] of [["saleList", "SaleList"], ["saleCreditNoteList", "SaleCreditNoteList"]]) {
    let page = 1, total = Infinity, scanned = 0, kept = 0;
    while (scanned < total) {
      const resp = await get(endpoint, { Page: page, Limit: 100, UpdatedSince: KEEP_FROM, UpdatedUntil: UPDATED_UNTIL });
      total = resp.Total ?? 0;
      const list = resp[key] || resp.SaleList || [];
      if (!list.length) break;
      for (const h of list) if (h.SaleID && issuedHeader(h)) { ids.add(h.SaleID); kept++; }
      scanned += list.length;
      if (page % 10 === 0 || scanned >= total) console.error(`  ${endpoint}: ${scanned}/${total} (issued kept ${kept})`);
      page += 1;
    }
  }
  return [...ids];
}

function fmt(rows) {
  const t = rows.reduce((a, r) => ({ amount: a.amount + r.amount, tax: a.tax + r.tax, total: a.total + r.total, qty: a.qty + r.quantity }), { amount: 0, tax: 0, total: 0, qty: 0 });
  const docs = new Set(rows.map((r) => `${r.invoice_credit_note}:${r.document_number}`)).size;
  return `amount=${t.amount.toFixed(2)} tax=${t.tax.toFixed(2)} total=${t.total.toFixed(2)} qty=${t.qty} docs=${docs} rows=${rows.length}`;
}

async function main() {
  if (!DRY && !PAT) throw new Error("SUPABASE_ACCESS_TOKEN required for DB writes.");
  fs.mkdirSync(".tmp", { recursive: true });
  console.error(`Stage: CreatedSince=${CREATED_SINCE}  keep=[${KEEP_FROM}, ${KEEP_TO}]  purgeAll=${PURGE_ALL}  ${DRY ? "DRY" : "LIVE"}`);

  const ctx = await loadProductMaster();
  console.error("Collecting issued SaleIDs ...");
  const ids = await collectSaleIds();
  console.error(`Unique issued sales to fetch: ${ids.length}`);

  const done = new Set();
  if (RESUME && fs.existsSync(DONE_CKPT)) {
    for (const l of fs.readFileSync(DONE_CKPT, "utf8").split("\n")) if (l.trim()) done.add(l.trim());
    console.error(`Resuming: ${done.size} already fetched.`);
  } else { fs.writeFileSync(ROWS_CKPT, ""); fs.writeFileSync(DONE_CKPT, ""); }

  const rowsOut = fs.createWriteStream(ROWS_CKPT, { flags: "a" });
  const doneOut = fs.createWriteStream(DONE_CKPT, { flags: "a" });
  let i = 0, fetched = 0;
  for (const id of ids) {
    i++;
    if (done.has(id)) continue;
    try {
      const detail = await get("sale", { ID: id });
      const rows = expandSale(detail, { productById: ctx.productById, productBySku: ctx.productBySku });
      for (const r of rows) rowsOut.write(JSON.stringify(r) + "\n");
      doneOut.write(id + "\n");
      fetched++;
    } catch (e) { console.error(`  ! ${id}: ${e.message}`); }
    if (i % 100 === 0) console.error(`  detail ${i}/${ids.length} (fetched ${fetched})`);
  }
  rowsOut.end(); doneOut.end();
  await new Promise((r) => rowsOut.on("finish", r));

  // Load checkpoint; dedupe by document number (Rule F). A document's lines are written
  // CONTIGUOUSLY (per sale expansion); the same document reachable from another sale task —
  // or a re-fetched sale — appears as a SEPARATE contiguous run. Keep the FIRST run of each
  // document number, skip later runs. This preserves legitimately-repeated lines within a
  // document while removing whole-document duplicates from any source.
  const allRows = fs.readFileSync(ROWS_CKPT, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const seenDoc = new Set();
  const kept = [];
  let curDk = null, accepting = false;
  for (const r of allRows) {
    const inRange = r.invoice_date && r.invoice_date >= KEEP_FROM && r.invoice_date <= KEEP_TO;
    const dk = `${r.invoice_credit_note === "Credit note" ? "C" : "I"}:${r.document_number}`;
    if (dk !== curDk) { // new contiguous run
      curDk = dk;
      accepting = inRange && !seenDoc.has(dk);
      if (accepting) seenDoc.add(dk);
    }
    if (accepting) kept.push(r);
  }
  console.error(`\nKept (in range): ${fmt(kept)}`);
  const win = kept.filter((r) => r.invoice_date >= "2026-05-01" && r.invoice_date <= "2026-06-10");
  if (win.length) { console.error(`VALIDATION May01-Jun10: ${fmt(win)}`); console.error(`  expected:               amount=4884453.07 tax=705276.72 total=5589729.79 qty=14761 docs=1038`); }

  if (DRY) { console.error("DRY RUN — no DB writes."); return; }

  console.error(PURGE_ALL ? "Purging ALL public.sales then inserting range ..." : `Replacing public.sales for [${KEEP_FROM}, ${KEEP_TO}] ...`);
  if (PURGE_ALL) await runSql("delete from public.sales;");
  else await runSql(`delete from public.sales where invoice_date between date '${KEEP_FROM}' and date '${KEEP_TO}';`);

  const COLS = ["cin7_sale_id", "order_number", "invoice_date", "order_date", "invoice_due_date", "customer_code", "customer_name", "sales_representative", "brand", "category", "product", "sku", "quantity", "amount", "tax", "total", "invoice_credit_note", "status"];
  const NUM = new Set(["quantity", "amount", "tax", "total"]);
  const DATE = new Set(["invoice_date", "order_date", "invoice_due_date"]);
  const sqlStr = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
  const val = (r) => `(${COLS.map((c) => (NUM.has(c) ? Number(r[c] ?? 0) : DATE.has(c) ? (r[c] ? `date '${r[c]}'` : "null") : sqlStr(r[c]))).join(",")})`;
  let ins = 0;
  for (let b = 0; b < kept.length; b += INSERT_BATCH) {
    const batch = kept.slice(b, b + INSERT_BATCH);
    await runSql(`insert into public.sales (${COLS.join(",")}) values\n${batch.map(val).join(",\n")};`);
    ins += batch.length;
    if (ins % 4000 === 0 || ins === kept.length) console.error(`  inserted ${ins}/${kept.length}`);
  }
  await runSql(`insert into public.sync_log (sync_type, started_at, completed_at, records_fetched, records_upserted, status, metadata)
    values ('cin7_backfill', now(), now(), ${fetched}, ${ins}, 'succeeded', ${sqlStr(JSON.stringify({ created_since: CREATED_SINCE, keep: [KEEP_FROM, KEEP_TO] }))}::jsonb);`);
  console.error("Post-backfill:", await runSql(`select count(*) n, round(sum(amount))::bigint amount, min(invoice_date) min_d, max(invoice_date) max_d from public.sales;`));
}

main().catch((e) => { console.error(`Fatal: ${e.message}`); process.exit(1); });
