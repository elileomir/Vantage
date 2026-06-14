#!/usr/bin/env node
// ============================================================================
// CIN7 Core (DEAR) -> public.sales LIVE SYNC
// ----------------------------------------------------------------------------
// Pulls sales from the CIN7 Core ExternalApi/v2, expands each sale into per-line
// rows (one row per invoice / credit-note line) and upserts them into the
// Supabase public.sales table via the Supabase Management API.
//
// USAGE:
//   # credentials come from .env.local (CIN7_* + SUPABASE_ACCESS_TOKEN)
//   node --env-file=.env.local scripts/sync-cin7-sales.mjs --from 2026-05-01 --to 2026-05-31
//   node --env-file=.env.local scripts/sync-cin7-sales.mjs --from 2026-05-01 --to 2026-05-31 --dry-run
//   node --env-file=.env.local scripts/sync-cin7-sales.mjs --from 2026-05-01 --to 2026-05-31 --limit 1000
//
// FLAGS:
//   --from YYYY-MM-DD   Start of date window (CreatedSince + invoice/order-date filter). Required.
//   --to   YYYY-MM-DD   End of date window (inclusive). Default: today.
//   --limit N           Max number of sales (headers) to process. Default 500 (safety cap).
//   --dry-run           Fetch + summarize, print sample rows, NO database writes.
//
// ENV:
//   CIN7_ACCOUNT_ID, CIN7_API_KEY, CIN7_BASE_URL   (CIN7 auth — never logged)
//   SUPABASE_ACCESS_TOKEN                          (Supabase Management API PAT — required for writes)
//   SUPABASE_PROJECT_REF                           (optional; defaults to the KRDM project ref)
//
// IDEMPOTENCY:
//   Deletes existing public.sales rows whose invoice_date falls within the
//   processed [minDate, maxDate] window, then batch-inserts the freshly fetched
//   rows. Re-running the same window is safe.
//
// IMPORTANT — FULL HISTORICAL BACKFILL IS A LONG JOB:
//   saleList has NO line items, so every sale requires its own detail call, and
//   CIN7 rate-limits aggressively (HTTP 429/503). With ~43k sales on record a
//   full backfill is many thousands of sequential, throttled requests. RUN IT
//   MONTH BY MONTH (e.g. --from 2026-05-01 --to 2026-05-31) rather than all at
//   once, and let the built-in backoff handle throttling.
// ============================================================================

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "cbrqfqxwexhoguoazhgh";
const PAT = process.env.SUPABASE_ACCESS_TOKEN || "";
const SUPA_API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

const CIN7_BASE = (process.env.CIN7_BASE_URL?.trim() || "https://inventory.dearsystems.com/ExternalApi/v2").replace(/\/+$/, "");
const CIN7_ACCOUNT_ID = process.env.CIN7_ACCOUNT_ID?.trim();
const CIN7_API_KEY = process.env.CIN7_API_KEY?.trim();

// Pacing between per-sale detail calls (ms). Keeps us friendly with the ~60/min limit.
const DETAIL_DELAY_MS = 350;
const PAGE_LIMIT = 100;
const INSERT_BATCH = 400;

// ── CLI args ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { from: null, to: null, limit: 500, dryRun: false, incremental: false, since: null, mode: "updated" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--incremental") out.incremental = true;
    else if (a === "--since") out.since = argv[++i];
    else if (a === "--from") out.from = argv[++i];
    else if (a === "--to") out.to = argv[++i];
    else if (a === "--limit") out.limit = Number(argv[++i]);
    else if (a === "--mode") out.mode = argv[++i]; // 'updated' (recent, full credit capture) | 'created' (older months)
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isValidDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Shift an ISO date back N days (for the saleList CreatedSince lookback buffer).
function isoMinusDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// ── Small utils ─────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toDate(v) {
  // CIN7 dates look like "2026-05-01T00:00:00"; we only keep the date part.
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function num(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// "(EO0018) EO Members : Nicholas Thiede" -> { code, name }
function parseCustomer(v) {
  const s = String(v ?? "").trim();
  if (!s) return { code: null, name: null };
  const m = s.match(/^\(([^)]+)\)\s*(.*)$/);
  if (m) return { code: m[1].trim(), name: (m[2] || "").trim() || null };
  return { code: null, name: s };
}

function sqlStr(v) {
  if (v === null || v === undefined) return "null";
  return `'${String(v).replace(/'/g, "''")}'`;
}

// ── CIN7 fetch (inline; mirrors src/lib/cin7/client.ts) ──────────────────────

function assertCin7Env() {
  const missing = [];
  if (!CIN7_ACCOUNT_ID) missing.push("CIN7_ACCOUNT_ID");
  if (!CIN7_API_KEY) missing.push("CIN7_API_KEY");
  if (missing.length) {
    throw new Error(
      `Missing required CIN7 environment variable(s): ${missing.join(", ")}. ` +
        `Set them in .env.local (see .env.example) or pass --env-file=.env.local.`
    );
  }
}

async function cin7Fetch(path, params = {}, { maxRetries = 5, baseDelayMs = 1000 } = {}) {
  const url = new URL(`${CIN7_BASE}/${String(path).replace(/^\/+/, "")}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  let attempt = 0;
  for (;;) {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "api-auth-accountid": CIN7_ACCOUNT_ID,
        "api-auth-applicationkey": CIN7_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) return res.json();

    const throttled = res.status === 429 || res.status === 503;
    if (throttled && attempt < maxRetries) {
      const ra = res.headers.get("retry-after");
      let delay = ra ? Number(ra) * 1000 : baseDelayMs * 2 ** attempt;
      if (!Number.isFinite(delay) || delay <= 0) delay = baseDelayMs * 2 ** attempt;
      attempt += 1;
      console.log(`  throttled (${res.status}); backing off ${Math.round(delay)}ms (retry ${attempt}/${maxRetries})`);
      await sleep(delay);
      continue;
    }

    let body = "";
    try {
      body = (await res.text()).slice(0, 400);
    } catch {
      body = "<unreadable body>";
    }
    // Never echo auth headers.
    throw new Error(`CIN7 ${res.status} ${res.statusText} on GET /${path}${body ? ` — ${body}` : ""}`);
  }
}

// ── Supabase Management API (mirrors scripts/import-sales.mjs) ────────────────

async function runSql(query) {
  const res = await fetch(SUPA_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAT}`,
      "Content-Type": "application/json",
      "User-Agent": "krdm-cin7-sync/1.0",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${text.slice(0, 400)}`);
  return text;
}

// ── Product master (brand/category) lookup ───────────────────────────────────

// CIN7 v2 has no report/bulk-line API and no Brand on sale lines, so we fetch the
// full product master once (GET /product) and map ProductID/SKU -> Brand + Category.
const PRODUCT_BY_ID = new Map();
const PRODUCT_BY_SKU = new Map();

async function loadProductMaster() {
  let page = 1;
  let total = Infinity;
  let loaded = 0;
  while (loaded < total) {
    const resp = await cin7Fetch("product", { Page: page, Limit: 1000, IncludeDeprecated: "true" });
    total = resp.Total ?? 0;
    const products = Array.isArray(resp.Products) ? resp.Products : [];
    if (products.length === 0) break;
    for (const p of products) {
      const rec = {
        brand: p.Brand != null && String(p.Brand).trim() ? String(p.Brand).trim() : null,
        category: p.Category != null && String(p.Category).trim() ? String(p.Category).trim() : null,
      };
      if (p.ID) PRODUCT_BY_ID.set(p.ID, rec);
      if (p.SKU != null) PRODUCT_BY_SKU.set(String(p.SKU).trim(), rec);
    }
    loaded += products.length;
    page += 1;
    await sleep(DETAIL_DELAY_MS);
  }
  console.log(`Product master loaded: ${PRODUCT_BY_ID.size} by ID, ${PRODUCT_BY_SKU.size} by SKU.`);
}

// ── Brand / rep derivation ───────────────────────────────────────────────────

// Resolve brand/category for a sale line via the product master (by ProductID, then SKU).
function lookupProduct(line) {
  if (!line || typeof line !== "object") return { brand: null, category: null };
  const byId = line.ProductID ? PRODUCT_BY_ID.get(line.ProductID) : null;
  if (byId) return byId;
  const bySku = line.SKU != null ? PRODUCT_BY_SKU.get(String(line.SKU).trim()) : null;
  if (bySku) return bySku;
  // last resort: a Brand field if the API ever provides one on the line
  const cand = line.Brand ?? line.brand ?? null;
  return { brand: cand ? String(cand).trim() || null : null, category: null };
}

function deriveRep(saleDetail, header) {
  const cand =
    saleDetail?.SalesRepresentative ??
    saleDetail?.SalesRep ??
    header?.SalesRepresentative ??
    null;
  const s = cand == null ? "" : String(cand).trim();
  return s || null;
}

// ── Normalize one sale detail into per-line rows ─────────────────────────────

// Build rows for a set of document lines (invoice or credit note).
// `sign` = +1 for invoices, -1 for credit notes (nets credit notes negative).
function linesToRows({ lines, sign, kind, header, detail, docDate, docDue, statusOverride }) {
  const rows = [];
  const { code, name } = parseCustomer(header.Customer ?? detail.Customer);
  const rep = deriveRep(detail, header);
  const orderNumber = header.OrderNumber ?? detail?.Order?.SaleOrderNumber ?? null;
  const orderDate = toDate(header.OrderDate ?? detail.SaleOrderDate);
  const invoiceDate = toDate(docDate ?? header.InvoiceDate ?? header.OrderDate);
  const dueDate = toDate(docDue ?? header.InvoiceDueDate);
  const status = statusOverride ?? header.Status ?? detail.Status ?? null;

  for (const line of lines || []) {
    const qty = num(line.Quantity);
    const net = num(line.Total); // line Total is pre-tax (net) in this API
    const tax = num(line.Tax);
    const gross = net + tax;
    const prod = lookupProduct(line);
    rows.push({
      cin7_sale_id: header.SaleID ?? detail.ID ?? null,
      order_number: orderNumber ? String(orderNumber) : null,
      invoice_date: invoiceDate,
      order_date: orderDate,
      invoice_due_date: dueDate,
      customer_code: code,
      customer_name: name,
      sales_representative: rep,
      brand: prod.brand,
      category: prod.category,
      product: line.Name != null && String(line.Name).trim() ? String(line.Name).trim() : null,
      sku: line.SKU != null && String(line.SKU).trim() ? String(line.SKU).trim() : null,
      quantity: sign * qty,
      amount: sign * net,
      tax: sign * tax,
      total: sign * gross,
      invoice_credit_note: kind,
      status,
      combined_invoice_status: header.CombinedInvoiceStatus ?? null,
      credit_note_status: header.CreditNoteStatus ?? null,
    });
  }
  return rows;
}

// Expand a full sale detail into rows. Prefers issued Invoices + CreditNotes
// (the billed truth that Power BI reconciles against). Falls back to Order.Lines
// when a sale has no invoice/credit-note documents yet, classifying by whether
// the header indicates a credit note.
function saleToRows(header, detail) {
  const rows = [];
  const invoices = Array.isArray(detail.Invoices) ? detail.Invoices : [];
  const creditNotes = Array.isArray(detail.CreditNotes) ? detail.CreditNotes : [];

  for (const inv of invoices) {
    rows.push(
      ...linesToRows({
        lines: inv.Lines,
        sign: 1,
        kind: "Invoice",
        header,
        detail,
        docDate: inv.InvoiceDate,
        docDue: inv.InvoiceDueDate,
        statusOverride: inv.Status ?? header.Status,
      })
    );
  }

  for (const cn of creditNotes) {
    rows.push(
      ...linesToRows({
        lines: cn.Lines,
        sign: -1,
        kind: "Credit note",
        header,
        detail,
        docDate: cn.CreditNoteDate,
        docDue: null,
        statusOverride: cn.Status ?? header.Status,
      })
    );
  }

  // Fallback: no documents materialised — use the order lines so the sale isn't lost.
  if (rows.length === 0 && detail.Order && Array.isArray(detail.Order.Lines)) {
    const isCredit = Boolean(header.CreditNoteNumber);
    rows.push(
      ...linesToRows({
        lines: detail.Order.Lines,
        sign: isCredit ? -1 : 1,
        kind: isCredit ? "Credit note" : "Invoice",
        header,
        detail,
        docDate: header.InvoiceDate ?? header.OrderDate,
        docDue: header.InvoiceDueDate,
      })
    );
  }

  return rows;
}

// Keep a sale if its invoice-or-order date lands in [from,to].
function inWindow(header, from, to) {
  const d = toDate(header.InvoiceDate) ?? toDate(header.OrderDate);
  if (!d) return false;
  return d >= from && d <= to;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  assertCin7Env();

  const from = args.from;
  const to = args.to || todayISO();
  if (!isValidDate(from)) {
    console.error("Required: --from YYYY-MM-DD (e.g. --from 2026-05-01). Optional --to, --limit, --dry-run.");
    process.exit(1);
  }
  if (!isValidDate(to)) {
    console.error(`Invalid --to value: ${to}`);
    process.exit(1);
  }
  const limit = Number.isFinite(args.limit) && args.limit > 0 ? args.limit : 500;

  console.log(`CIN7 sync window: ${from} .. ${to}  (max ${limit} sales, ${args.dryRun ? "DRY RUN" : "LIVE"})`);
  console.log(`CIN7 base: ${CIN7_BASE}`);

  // Load product master once for brand/category mapping.
  console.log("Loading product master for brand mapping ...");
  await loadProductMaster();

  // ── Page the sale index by UpdatedSince ──
  // Use UpdatedSince (not CreatedSince) so we catch ANY sale TOUCHED in/after the window —
  // including older sales that just received a CREDIT NOTE in this window (CIN7's SICN /
  // "Sales Credit Note" report lists credits by their own date). We fetch all such sales;
  // writeRows then keeps only the line rows whose document date falls in [from,to].
  // Best run with SHORT (monthly) windows so this stays small and under the 5,000/day quota.
  // 'updated' mode (recent months): UpdatedSince catches sales touched in the window
  // (incl. credit notes on older sales). 'created' mode (older months): CreatedSince with a
  // 90-day lookback + header-date filter — used when UpdatedSince would return the entire history.
  const useCreated = args.mode === "created";
  const createdSince = isoMinusDays(from, 90);
  const headers = [];
  let page = 1;
  let total = Infinity;
  let scanned = 0;
  while (headers.length < limit) {
    const params = useCreated
      ? { Page: page, Limit: PAGE_LIMIT, CreatedSince: createdSince }
      : { Page: page, Limit: PAGE_LIMIT, UpdatedSince: from };
    const resp = await cin7Fetch("saleList", params);
    total = resp.Total ?? 0;
    const list = Array.isArray(resp.SaleList) ? resp.SaleList : [];
    if (list.length === 0) break;
    scanned += list.length;
    for (const h of list) {
      if (useCreated && !inWindow(h, from, to)) continue;
      headers.push(h);
      if (headers.length >= limit) break;
    }
    console.log(`  page ${page}: scanned ${scanned}/${total} (mode=${args.mode}), selected ${headers.length}`);
    if (scanned >= total) break;
    page += 1;
    await sleep(DETAIL_DELAY_MS);
  }

  console.log(`Selected ${headers.length} sales for detail fetch (keeping [${from},${to}] document lines).`);

  // ── Fetch detail per sale -> rows ──
  const rows = [];
  let processed = 0;
  for (const h of headers) {
    let detail;
    try {
      detail = await cin7Fetch("sale", { ID: h.SaleID });
    } catch (err) {
      console.error(`  ! sale ${h.SaleID} (${h.OrderNumber ?? "?"}): ${err.message}`);
      await sleep(DETAIL_DELAY_MS);
      continue;
    }
    const saleRows = saleToRows(h, detail);
    rows.push(...saleRows);
    processed += 1;
    if (processed % 25 === 0 || processed === headers.length) {
      console.log(`  detail ${processed}/${headers.length} sales -> ${rows.length} line rows`);
    }
    await sleep(DETAIL_DELAY_MS);
  }

  if (rows.length === 0) {
    console.log("No line rows produced for this window. Nothing to write.");
    if (!args.dryRun && PAT) {
      await writeSyncLog({ from, to, fetched: processed, upserted: 0, status: "succeeded", note: "no rows in window" });
    }
    return;
  }

  // ── Summary ──
  const dates = rows.map((r) => r.invoice_date).filter(Boolean).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  const sumAmount = rows.reduce((a, r) => a + r.amount, 0);
  const sumQty = rows.reduce((a, r) => a + r.quantity, 0);
  const invCount = rows.filter((r) => r.invoice_credit_note === "Invoice").length;
  const cnCount = rows.filter((r) => r.invoice_credit_note === "Credit note").length;

  console.log("");
  console.log(`Sales processed:   ${processed}`);
  console.log(`Line rows:         ${rows.length}  (${invCount} invoice, ${cnCount} credit note)`);
  console.log(`Row date range:    ${minDate} .. ${maxDate}`);
  console.log(`Sum(amount, net):  ${sumAmount.toLocaleString("en-ZA", { style: "currency", currency: "ZAR" })}`);
  console.log(`Sum(quantity):     ${sumQty.toLocaleString()}`);

  if (args.dryRun) {
    console.log("\nDRY RUN — no DB writes. Sample row:");
    console.log(JSON.stringify(rows[0], null, 2));
    return;
  }

  if (!PAT) throw new Error("SUPABASE_ACCESS_TOKEN env required for DB writes.");

  await writeRows(rows, minDate, maxDate, processed, from, to);
}

// ── Shared insert helpers ────────────────────────────────────────────────────

const SALES_COLS = [
  "cin7_sale_id", "order_number", "invoice_date", "order_date", "invoice_due_date",
  "customer_code", "customer_name", "sales_representative",
  "brand", "category", "product", "sku", "quantity", "amount", "tax", "total",
  "invoice_credit_note", "status", "combined_invoice_status", "credit_note_status",
];
const NUM_COLS = new Set(["quantity", "amount", "tax", "total"]);
const DATE_COLS = new Set(["invoice_date", "order_date", "invoice_due_date"]);

function rowToValues(rec) {
  return `(${SALES_COLS.map((c) => {
    const v = rec[c];
    if (NUM_COLS.has(c)) return Number(v ?? 0);
    if (DATE_COLS.has(c)) return v ? `date '${v}'` : "null";
    return sqlStr(v);
  }).join(",")})`;
}

async function insertSalesRows(rows) {
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const batch = rows.slice(i, i + INSERT_BATCH);
    await runSql(`insert into public.sales (${SALES_COLS.join(",")}) values\n${batch.map(rowToValues).join(",\n")};`);
  }
}

// FULL backfill write: replace EXACTLY the [from,to] window.
// IMPORTANT: delete and insert are clamped to [from,to]. Rows whose invoice/order date
// falls OUTSIDE the window (e.g. a sale ordered in-window but invoiced later) are dropped
// here so they cannot delete/overwrite a neighbouring fiscal period — they belong to, and
// are picked up by, the backfill for their own window.
async function writeRows(rows, _minDate, _maxDate, salesFetched, from, to) {
  const inWindow = rows.filter((r) => {
    const d = r.invoice_date || r.order_date;
    return d && d >= from && d <= to;
  });
  console.log(`\nReplacing public.sales window [${from}, ${to}] with ${inWindow.length} in-window rows (dropped ${rows.length - inWindow.length} out-of-window) ...`);
  await runSql(`delete from public.sales where coalesce(invoice_date, order_date) between date '${from}' and date '${to}';`);
  let inserted = 0;
  for (let i = 0; i < inWindow.length; i += INSERT_BATCH) {
    const batch = inWindow.slice(i, i + INSERT_BATCH);
    await insertSalesRows(batch);
    inserted += batch.length;
    console.log(`  inserted ${inserted}/${inWindow.length}`);
  }
  await writeSyncLog({ from, to, fetched: salesFetched, upserted: inserted, status: "succeeded", minDate: from, maxDate: to });
  const check = await runSql(
    `select count(*) n, round(sum(amount))::bigint total_amount, round(sum(quantity))::bigint qty
     from public.sales where coalesce(invoice_date, order_date) between date '${from}' and date '${to}';`
  );
  console.log("Post-sync verification:", check);
}

// DELTA write: replace ONLY this sale's lines (keyed by order_number, fallback SaleID).
// Untouched sales are never modified. A now-empty sale (voided to nothing) is just removed.
async function upsertSale(header, rows) {
  const orderNum = header.OrderNumber ? String(header.OrderNumber) : null;
  const saleId = header.SaleID ?? null;
  const keys = [];
  if (orderNum) keys.push(`order_number = ${sqlStr(orderNum)}`);
  if (saleId) keys.push(`cin7_sale_id = ${sqlStr(saleId)}`);
  if (keys.length === 0) return; // cannot key this sale; skip
  await runSql(`delete from public.sales where ${keys.join(" or ")};`);
  if (rows.length > 0) await insertSalesRows(rows);
}

async function writeSyncLog({ from, to, fetched, upserted, status, minDate, maxDate, note }) {
  const metadata = { window: `${from}..${to}`, rows_range: minDate && maxDate ? `${minDate}..${maxDate}` : null, note: note ?? null };
  await runSql(
    `insert into public.sync_log (sync_type, started_at, completed_at, records_fetched, records_upserted, status, metadata)
     values ('cin7_sales', now(), now(), ${Number(fetched) || 0}, ${Number(upserted) || 0}, ${sqlStr(status)},
             ${sqlStr(JSON.stringify(metadata))}::jsonb);`
  );
}

// ── Delta-sync cursor ─────────────────────────────────────────────────────────

async function readCursor() {
  const res = await runSql(`select to_char(last_updated_since, 'YYYY-MM-DD') c from public.cin7_sync_state where id = 1;`);
  try { return JSON.parse(res)?.[0]?.c ?? null; } catch { return null; }
}
async function writeCursor(since, salesSeen, status) {
  await runSql(
    `update public.cin7_sync_state set last_updated_since = ${sqlStr(since)}::timestamptz,
       last_run_at = now(), last_status = ${sqlStr(status)}, sales_seen = ${Number(salesSeen) || 0} where id = 1;`
  );
}

// ── Incremental (delta) sync ─────────────────────────────────────────────────

async function runIncremental() {
  assertCin7Env();
  if (!args.dryRun && !PAT) throw new Error("SUPABASE_ACCESS_TOKEN env required for DB writes.");

  const runStart = todayISO();
  let since = args.since || (PAT || args.dryRun ? await readCursor() : null);
  if (!since) {
    console.error("Incremental needs a starting point. Provide --since YYYY-MM-DD for the first run");
    console.error("(use the date of your last full backfill). After that the cursor advances automatically.");
    process.exit(1);
  }

  console.log(`Incremental sync: sales updated since ${since}  (${args.dryRun ? "DRY RUN" : "LIVE"})`);
  console.log("Loading product master for brand mapping ...");
  await loadProductMaster();

  // Page the changed-sale index (UpdatedSince = new + modified + voided sales).
  const headers = [];
  let page = 1, total = Infinity, scanned = 0;
  const cap = Number.isFinite(args.limit) && args.limit > 0 ? args.limit : 100000;
  while (headers.length < cap) {
    const resp = await cin7Fetch("saleList", { Page: page, Limit: PAGE_LIMIT, UpdatedSince: since });
    total = resp.Total ?? 0;
    const list = Array.isArray(resp.SaleList) ? resp.SaleList : [];
    if (list.length === 0) break;
    scanned += list.length;
    for (const h of list) { headers.push(h); if (headers.length >= cap) break; }
    console.log(`  page ${page}: ${scanned}/${total} changed sales`);
    if (scanned >= total) break;
    page += 1;
    await sleep(DETAIL_DELAY_MS);
  }

  console.log(`${headers.length} new/changed sales since ${since}.`);
  if (headers.length === 0) {
    if (!args.dryRun && PAT) { await writeCursor(runStart, 0, "succeeded"); await writeSyncLog({ from: since, to: runStart, fetched: 0, upserted: 0, status: "succeeded", note: "incremental (no changes)" }); }
    console.log("Up to date — nothing to change.");
    return;
  }

  let processed = 0, upsertedSales = 0, upsertedRows = 0;
  for (const h of headers) {
    let detail;
    try { detail = await cin7Fetch("sale", { ID: h.SaleID }); }
    catch (err) { console.error(`  ! sale ${h.SaleID} (${h.OrderNumber ?? "?"}): ${err.message}`); await sleep(DETAIL_DELAY_MS); continue; }
    const rows = saleToRows(h, detail);
    processed += 1;
    if (args.dryRun) {
      if (processed <= 3) console.log(`  would upsert ${h.OrderNumber ?? h.SaleID} -> ${rows.length} line rows (brand e.g. ${rows[0]?.brand ?? "—"})`);
    } else {
      await upsertSale(h, rows);
      upsertedSales += 1;
      upsertedRows += rows.length;
    }
    if (processed % 25 === 0 || processed === headers.length) {
      console.log(`  ${processed}/${headers.length} sales processed (${upsertedRows} rows upserted)`);
    }
    await sleep(DETAIL_DELAY_MS);
  }

  if (!args.dryRun && PAT) {
    await writeCursor(runStart, upsertedSales, "succeeded");
    await writeSyncLog({ from: since, to: runStart, fetched: processed, upserted: upsertedRows, status: "succeeded", note: "incremental" });
    console.log("Post-sync verification:", await runSql(`select count(*) n, round(sum(amount))::bigint total from public.sales;`));
  }
  console.log(`\nIncremental done: ${upsertedSales} sales upserted (${upsertedRows} line rows). Cursor advanced to ${runStart}.`);
}

// ── Entry point ──────────────────────────────────────────────────────────────

const run = args.incremental ? runIncremental : main;
run().catch((err) => {
  console.error(`\nFatal: ${err.message}`);
  process.exit(1);
});
