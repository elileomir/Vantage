#!/usr/bin/env node
// Import a KRDM sales export workbook (CIN7 "Sale Lines" style export) into public.sales.
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/import-sales.mjs "reference/sales/SICN_May 2026.xlsx"
//   ... --dry-run            # parse + summarize, no DB writes
//
// The export has a few metadata rows then a header row with columns:
//   Date, Customer, Account, Brand, Product, Sales representative, Invoice due, SKU,
//   Document #, Invoice/ credit note, Currency, Base currency amount, Base currency total,
//   Base currency tax, Tax, Quantity, Amount, Total
//
// Idempotent per file: deletes existing public.sales rows whose invoice_date is within the
// file's [min,max] date range, then inserts the parsed rows. Re-running a month is safe.
//
// Writes go through the Supabase Management API (the wired MCP transport is broken in this env).

import XLSX from "xlsx";
import { readFileSync } from "node:fs";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "cbrqfqxwexhoguoazhgh";
const PAT = process.env.SUPABASE_ACCESS_TOKEN || "";
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Provide a workbook path. Example: node scripts/import-sales.mjs 'reference/sales/SICN_May 2026.xlsx'");
  process.exit(1);
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  // "01-May-2026"
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const mm = MONTHS[m[2].toLowerCase()];
    if (mm) return `${m[3]}-${String(mm).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  // ISO already
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function num(v) {
  if (v === null || v === undefined || v === "" || v === "-") return 0;
  const n = Number(String(v).replace(/,/g, "").replace(/[R\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// "(AM0006)Amazon" | "(TA0011) Takealot.com (MP)" -> {code, name}
function parseCustomer(v) {
  const s = String(v ?? "").trim();
  const m = s.match(/^\(([^)]+)\)\s*(.*)$/);
  if (m) return { code: m[1].trim(), name: (m[2] || "").trim() || m[1].trim() };
  return { code: null, name: s || null };
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const r = rows[i].map((x) => String(x).toLowerCase());
    if (r.includes("date") && r.includes("customer") && r.includes("amount")) return i;
  }
  return -1;
}

function sqlStr(v) {
  if (v === null || v === undefined) return "null";
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function runSql(query) {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json", "User-Agent": "krdm-import/1.0" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${text.slice(0, 400)}`);
  return text;
}

function main() {
  const wb = XLSX.read(readFileSync(file), { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  const h = findHeaderRow(rows);
  if (h < 0) throw new Error("Could not locate header row (need Date/Customer/Amount).");
  const cols = rows[h].map((c) => String(c).trim());
  const idx = (name) => cols.findIndex((c) => c.toLowerCase() === name.toLowerCase());

  const map = {
    date: idx("Date"),
    customer: idx("Customer"),
    brand: idx("Brand"),
    product: idx("Product"),
    rep: idx("Sales representative"),
    due: idx("Invoice due"),
    sku: idx("SKU"),
    doc: idx("Document #"),
    type: idx("Invoice/ credit note"),
    currency: idx("Currency"),
    tax: idx("Tax"),
    qty: idx("Quantity"),
    amount: idx("Amount"),
    total: idx("Total"),
  };

  const records = [];
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i];
    const date = parseDate(r[map.date]);
    if (!date) continue;
    const { code, name } = parseCustomer(r[map.customer]);
    records.push({
      order_number: String(r[map.doc] ?? "").trim() || null,
      invoice_date: date,
      order_date: date,
      invoice_due_date: parseDate(r[map.due]),
      customer_code: code,
      customer_name: name,
      sales_representative: String(r[map.rep] ?? "").trim() || null,
      brand: String(r[map.brand] ?? "").trim() || null,
      product: String(r[map.product] ?? "").trim() || null,
      sku: String(r[map.sku] ?? "").trim() || null,
      quantity: num(r[map.qty]),
      amount: num(r[map.amount]),
      tax: num(r[map.tax]),
      total: num(r[map.total]),
      invoice_credit_note: String(r[map.type] ?? "").trim() || null,
      status: "COMPLETED",
    });
  }

  const dates = records.map((r) => r.invoice_date).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  const sumAmount = records.reduce((a, r) => a + r.amount, 0);
  const sumQty = records.reduce((a, r) => a + r.quantity, 0);

  console.log(`Parsed ${records.length} rows from ${file}`);
  console.log(`Date range: ${minDate} .. ${maxDate}`);
  console.log(`Sum(amount) = ${sumAmount.toLocaleString("en-ZA", { style: "currency", currency: "ZAR" })}`);
  console.log(`Sum(quantity) = ${sumQty.toLocaleString()}`);

  if (dryRun) {
    console.log("Dry run, no DB writes. Sample:", JSON.stringify(records[0], null, 2));
    return;
  }
  if (!PAT) throw new Error("SUPABASE_ACCESS_TOKEN env required for DB writes.");

  return importRecords(records, minDate, maxDate);
}

async function importRecords(records, minDate, maxDate) {
  console.log(`Deleting existing public.sales rows in [${minDate}, ${maxDate}] ...`);
  await runSql(
    `delete from public.sales where coalesce(invoice_date, order_date) between date '${minDate}' and date '${maxDate}';`
  );

  const colsOrder = [
    "order_number", "invoice_date", "order_date", "invoice_due_date",
    "customer_code", "customer_name", "sales_representative",
    "brand", "product", "sku", "quantity", "amount", "tax", "total",
    "invoice_credit_note", "status",
  ];
  const batchSize = 400;
  let inserted = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const values = batch
      .map((rec) => {
        const cells = colsOrder.map((c) => {
          const v = rec[c];
          if (["quantity", "amount", "tax", "total"].includes(c)) return Number(v ?? 0);
          if (["invoice_date", "order_date", "invoice_due_date"].includes(c)) return v ? `date '${v}'` : "null";
          return sqlStr(v);
        });
        return `(${cells.join(",")})`;
      })
      .join(",\n");
    const sql = `insert into public.sales (${colsOrder.join(",")}) values\n${values};`;
    await runSql(sql);
    inserted += batch.length;
    console.log(`  inserted ${inserted}/${records.length}`);
  }

  // sync_log entry
  await runSql(
    `insert into public.sync_log (sync_type, started_at, completed_at, records_fetched, records_upserted, status, metadata)
     values ('xlsx_import', now(), now(), ${records.length}, ${records.length}, 'succeeded',
             jsonb_build_object('source', ${sqlStr(file)}, 'range', ${sqlStr(`${minDate}..${maxDate}`)}));`
  );

  const check = await runSql(
    `select count(*) n, round(sum(amount))::bigint total_amount, round(sum(quantity))::bigint qty
     from public.sales where coalesce(invoice_date, order_date) between date '${minDate}' and date '${maxDate}';`
  );
  console.log("Post-import verification:", check);
}

await main();
