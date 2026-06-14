#!/usr/bin/env node
// Import South African public holidays into public.holidays, then recompute
// calendar.is_business_day (weekday AND not a holiday). Supports the P0 working-day
// daily-target spread (PBI DAILY_TARGET / Current R YTD Target).
//
// Source workbook: reference/holidays/Holiday Calendar.xlsx  (Sheet1: Date | Holiday | Details)
// Date cells are Excel serials.
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/import-holidays.mjs            # apply
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/import-holidays.mjs --dry-run  # print SQL only
//
// Idempotent: replaces all rows in public.holidays, then calls recompute_working_days().
// Requires migration 20260610000000_working_day_calendar.sql to be applied first
// (creates public.holidays + recompute_working_days()).

import XLSX from "xlsx";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "cbrqfqxwexhoguoazhgh";
const PAT = process.env.SUPABASE_ACCESS_TOKEN || "";
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
const dryRun = process.argv.includes("--dry-run");
const FILE = "reference/holidays/Holiday Calendar.xlsx";

// Excel serial (1900 date system, with the 1900-leap-year bug baked into the epoch) -> ISO yyyy-mm-dd
function excelSerialToISO(serial) {
  if (typeof serial !== "number" || !Number.isFinite(serial)) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000); // 25569 = days from 1970-01-01 to Excel epoch
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
function sqlStr(v) {
  if (v === null || v === undefined || v === "") return "null";
  return `'${String(v).trim().replace(/'/g, "''")}'`;
}

async function runSql(sql) {
  if (dryRun) { console.log(sql); return; }
  if (!PAT) { console.error("Missing SUPABASE_ACCESS_TOKEN"); process.exit(1); }
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) { console.error(`SQL failed (${res.status}): ${await res.text()}`); process.exit(1); }
  return res.json();
}

const wb = XLSX.readFile(FILE);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }).slice(1);
const records = [];
for (const r of rows) {
  const iso = typeof r[0] === "number" ? excelSerialToISO(r[0]) : (r[0] ? String(r[0]).slice(0, 10) : null);
  if (!iso) continue;
  records.push({ date: iso, name: r[1] ?? null, details: r[2] ?? null });
}
if (records.length === 0) { console.error("No holiday rows parsed."); process.exit(1); }

const values = records.map((h) => `(${sqlStr(h.date)}::date, ${sqlStr(h.name)}, ${sqlStr(h.details)})`).join(",\n  ");
const sql = `
delete from public.holidays;
insert into public.holidays (date, name, details) values
  ${values}
on conflict (date) do update set name = excluded.name, details = excluded.details;
select public.recompute_working_days();
`;

console.error(`Parsed ${records.length} holidays (${records[0].date} … ${records[records.length - 1].date}).`);
await runSql(sql);
console.error(dryRun ? "Dry run complete (no writes)." : "Holidays imported + working days recomputed.");
