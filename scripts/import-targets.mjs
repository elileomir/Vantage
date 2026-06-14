#!/usr/bin/env node
// Import KRDM monthly sales targets (wide workbook) into public.sales_targets (unpivoted).
//
// Workbook layout (sheet "Final "): columns
//   Sales Rep | Customer | Brand | Yearly Forecast Sale | 1-Mar-26 | 1-Apr-26 | ... | 1-Feb-27
// Each of the 12 month columns becomes one sales_targets row.
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/import-targets.mjs
//   ... --dry-run
//
// Idempotent: clears sales_targets for each fiscal_year present in the file, then inserts.

import XLSX from "xlsx";
import { readFileSync } from "node:fs";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "cbrqfqxwexhoguoazhgh";
const PAT = process.env.SUPABASE_ACCESS_TOKEN || "";
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
const dryRun = process.argv.includes("--dry-run");

const FILES = [
  "reference/targets/KRDM Sales Target 2025.xlsx",
  "reference/targets/KRDM Sales Target 2026.xlsx",
];
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function num(v) {
  if (v === null || v === undefined || v === "" || String(v).trim() === "-") return 0;
  const n = Number(String(v).replace(/,/g, "").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function sqlStr(v) {
  if (v === null || v === undefined || v === "") return "null";
  return `'${String(v).trim().replace(/'/g, "''")}'`;
}
// "1-Mar-26" -> {iso:'2026-03-01', y:2026, m:3}
function parseMonthHeader(s) {
  const m = String(s).trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (!m) return null;
  const mm = MONTHS[m[2].toLowerCase()];
  if (!mm) return null;
  let y = Number(m[3]); if (y < 100) y += 2000;
  return { iso: `${y}-${String(mm).padStart(2, "0")}-01`, y, m: mm };
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

function parseFile(file) {
  const wb = XLSX.read(readFileSync(file), { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  const header = rows[0].map((c) => String(c).trim());
  const idxRep = header.findIndex((c) => /sales rep/i.test(c));
  const idxCust = header.findIndex((c) => /customer/i.test(c));
  const idxBrand = header.findIndex((c) => /brand/i.test(c));
  const idxForecast = header.findIndex((c) => /forecast/i.test(c));
  // month columns
  const monthCols = [];
  header.forEach((c, i) => {
    const p = parseMonthHeader(c);
    if (p) monthCols.push({ i, ...p });
  });
  // fiscal mapping: order columns Mar..Feb -> fiscal_month 1..12; FY = year of the March column
  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rep = String(row[idxRep] ?? "").trim();
    if (!rep) continue;
    const customer = String(row[idxCust] ?? "").trim() || null;
    const brand = String(row[idxBrand] ?? "").trim() || null;
    const yearly = num(row[idxForecast]);
    monthCols.forEach((mc, k) => {
      const amount = num(row[mc.i]);
      const fyStart = mc.m >= 3 ? mc.y : mc.y - 1;
      records.push({
        fiscal_year: `FY${fyStart}`,
        month: k + 1, // fiscal month (Mar=1)
        month_date: mc.iso,
        sales_rep: rep,
        customer,
        brand,
        target_amount: amount,
        yearly_forecast: yearly,
      });
    });
  }
  return records;
}

async function main() {
  let all = [];
  for (const f of FILES) {
    try {
      const recs = parseFile(f);
      console.log(`${f}: ${recs.length} target rows`);
      all = all.concat(recs);
    } catch (e) {
      console.warn(`Skip ${f}: ${e.message}`);
    }
  }
  // Aggregate duplicate keys (workbook repeats some rep/customer/brand rows) to satisfy the
  // unique constraint (fiscal_year, month, sales_rep, customer, brand).
  const agg = new Map();
  for (const r of all) {
    const key = `${r.fiscal_year}|${r.month}|${r.sales_rep}|${r.customer ?? ""}|${r.brand ?? ""}`;
    const cur = agg.get(key);
    if (cur) {
      cur.target_amount += r.target_amount;
      cur.yearly_forecast = Math.max(cur.yearly_forecast, r.yearly_forecast);
    } else {
      agg.set(key, { ...r });
    }
  }
  all = [...agg.values()];

  const byFY = {};
  for (const r of all) byFY[r.fiscal_year] = (byFY[r.fiscal_year] || 0) + r.target_amount;
  console.log("Totals by fiscal year:", Object.fromEntries(Object.entries(byFY).map(([k, v]) => [k, Math.round(v)])));
  console.log(`Total target rows: ${all.length}`);

  if (dryRun) { console.log("Dry run. Sample:", JSON.stringify(all[0], null, 2)); return; }
  if (!PAT) throw new Error("SUPABASE_ACCESS_TOKEN required.");

  const fys = [...new Set(all.map((r) => r.fiscal_year))];
  console.log(`Clearing sales_targets for ${fys.join(", ")} ...`);
  await runSql(`delete from public.sales_targets where fiscal_year in (${fys.map(sqlStr).join(",")});`);

  const cols = ["fiscal_year", "month", "month_date", "sales_rep", "customer", "brand", "target_amount", "yearly_forecast"];
  const batchSize = 500;
  let done = 0;
  for (let i = 0; i < all.length; i += batchSize) {
    const batch = all.slice(i, i + batchSize);
    const values = batch.map((rec) => {
      const cells = [
        sqlStr(rec.fiscal_year), rec.month, `date '${rec.month_date}'`,
        sqlStr(rec.sales_rep), sqlStr(rec.customer), sqlStr(rec.brand),
        Number(rec.target_amount || 0), Number(rec.yearly_forecast || 0),
      ];
      return `(${cells.join(",")})`;
    }).join(",\n");
    await runSql(`insert into public.sales_targets (${cols.join(",")}) values\n${values};`);
    done += batch.length;
    if (done % 5000 < batchSize) console.log(`  inserted ${done}/${all.length}`);
  }
  const check = await runSql(`select fiscal_year, count(*) n, round(sum(target_amount))::bigint total from public.sales_targets group by 1 order by 1;`);
  console.log("Post-import:", check);
}

await main();
