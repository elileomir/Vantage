#!/usr/bin/env node
// Backfill sales.combined_invoice_status + credit_note_status from CIN7 saleList (headers only —
// cheap, no per-sale detail fetch). Lets revenue be defined like the "Sales Credit Note" report.
//
// Usage: SUPABASE_ACCESS_TOKEN=sbp_... node --env-file=.env.local scripts/backfill-invoice-status.mjs
// (CIN7_ACCOUNT_ID / CIN7_API_KEY / CIN7_BASE_URL come from .env.local)

import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";

const PAT = process.env.SUPABASE_ACCESS_TOKEN || "";
const REF = process.env.SUPABASE_PROJECT_REF || "cbrqfqxwexhoguoazhgh";
const AID = process.env.CIN7_ACCOUNT_ID || "";
const KEY = process.env.CIN7_API_KEY || "";
const BASE = (process.env.CIN7_BASE_URL || "https://inventory.dearsystems.com/ExternalApi/v2").replace(/\/+$/, "");
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const CREATED_SINCE = process.argv.includes("--since") ? process.argv[process.argv.indexOf("--since") + 1] : "2023-01-01";

if (!PAT || !AID || !KEY) { console.error("Missing SUPABASE_ACCESS_TOKEN / CIN7 creds"); process.exit(1); }

const sh = (cmd) => execSync(cmd, { maxBuffer: 1 << 28 }).toString();
function cin7Page(page) {
  const url = `${BASE}/saleList?Page=${page}&Limit=500&CreatedSince=${CREATED_SINCE}`;
  const out = sh(`curl -s --max-time 120 ${JSON.stringify(url)} -H ${JSON.stringify("api-auth-accountid: " + AID)} -H ${JSON.stringify("api-auth-applicationkey: " + KEY)}`);
  return JSON.parse(out);
}
function runSql(sql) {
  const tmp = `/tmp/bfis_${Math.abs((sql.length * 2654435761) % 1e9)}.json`;
  writeFileSync(tmp, JSON.stringify({ query: sql }));
  const out = sh(`curl -s -H ${JSON.stringify("Authorization: Bearer " + PAT)} -H "Content-Type: application/json" -X POST ${JSON.stringify(API)} --data @${tmp}`);
  unlinkSync(tmp);
  if (/"message"\s*:/.test(out) && !out.startsWith("[")) throw new Error("SQL failed: " + out.slice(0, 300));
  return out;
}
const sqlStr = (v) => (v == null || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);

// 1. Pull all sale headers.
const map = new Map(); // SaleID -> {cis, cns}
let page = 1, total = null;
for (;;) {
  const d = cin7Page(page);
  total = total ?? d.Total;
  const items = d.SaleList || [];
  if (!items.length) break;
  for (const s of items) map.set(s.SaleID, { cis: s.CombinedInvoiceStatus ?? null, cns: s.CreditNoteStatus ?? null });
  process.stderr.write(`\r  fetched page ${page} (${map.size}/${total})`);
  if (items.length < 500) break;
  page++;
}
console.error(`\nfetched ${map.size} sale headers (Total ${total}).`);

// 2. Batch UPDATE by cin7_sale_id.
const rows = [...map.entries()];
const batch = 800;
let done = 0;
for (let i = 0; i < rows.length; i += batch) {
  const vals = rows.slice(i, i + batch)
    .map(([sid, v]) => `(${sqlStr(sid)}, ${sqlStr(v.cis)}, ${sqlStr(v.cns)})`)
    .join(",\n");
  runSql(`update public.sales s set combined_invoice_status = v.cis, credit_note_status = v.cns
          from (values\n${vals}\n) v(sid, cis, cns) where s.cin7_sale_id = v.sid;`);
  done += Math.min(batch, rows.length - i);
  process.stderr.write(`\r  updated ${done}/${rows.length} sales`);
}
console.error("\nBackfill complete.");
const chk = runSql(`select combined_invoice_status, count(*) n from public.sales group by 1 order by n desc limit 8;`);
console.error("combined_invoice_status distribution:", chk);
