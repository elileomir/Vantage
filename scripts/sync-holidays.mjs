#!/usr/bin/env node
// LIVE holiday sync — South African public holidays from the Nager.Date API (free, no key).
// Replaces the manual xlsx import. Fetches each year, upserts into public.holidays, then
// recomputes calendar.is_business_day (weekday AND not a holiday) for the working-day
// daily-target spread (PBI DAILY_TARGET / Current R YTD Target).
//
// Source: https://date.nager.at/api/v3/PublicHolidays/{year}/ZA  (open-source, handles
// Sunday→Monday observed shifts automatically).
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/sync-holidays.mjs                 # apply (default years 2023–2031)
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/sync-holidays.mjs --from 2024 --to 2030
//   node scripts/sync-holidays.mjs --dry-run                                     # fetch + print SQL, no writes, no PAT needed
//
// Idempotent: replaces public.holidays, then calls recompute_working_days().
// Requires migration 20260610000000_working_day_calendar.sql applied first.

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "cbrqfqxwexhoguoazhgh";
const PAT = process.env.SUPABASE_ACCESS_TOKEN || "";
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
const COUNTRY = process.env.HOLIDAY_COUNTRY || "ZA";
const dryRun = process.argv.includes("--dry-run");

function argVal(flag, def) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : def;
}
// Calendar covers FY2023–FY2030 (Mar 2023 … Feb 2031); fetch that span by default.
const FROM = argVal("--from", 2023);
const TO = argVal("--to", 2031);

function sqlStr(v) {
  if (v === null || v === undefined || v === "") return "null";
  return `'${String(v).trim().replace(/'/g, "''")}'`;
}

async function fetchYear(year) {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${COUNTRY}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Nager.Date ${year} ${COUNTRY} failed (${res.status})`);
  return res.json();
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

const seen = new Map(); // date -> {name, details}
for (let y = FROM; y <= TO; y++) {
  let days;
  try { days = await fetchYear(y); }
  catch (e) { console.error(`! ${e.message}`); continue; }
  for (const h of days) {
    if (!h.date) continue;
    // localName is the SA-facing label; name is the English label. Prefer localName.
    seen.set(h.date, { name: h.localName || h.name || null, details: h.name || null });
  }
  console.error(`  ${y}: ${days.length} holidays`);
}

const records = [...seen.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));
if (records.length === 0) { console.error("No holidays fetched (network?). Aborting — leaving DB untouched."); process.exit(1); }

const values = records.map((h) => `(${sqlStr(h.date)}::date, ${sqlStr(h.name)}, ${sqlStr(h.details)})`).join(",\n  ");
const sql = `
delete from public.holidays;
insert into public.holidays (date, name, details) values
  ${values}
on conflict (date) do update set name = excluded.name, details = excluded.details;
select public.recompute_working_days();
`;

console.error(`Fetched ${records.length} ${COUNTRY} holidays (${records[0].date} … ${records[records.length - 1].date}).`);
await runSql(sql);
console.error(dryRun ? "Dry run complete (no writes)." : "Holidays synced + working days recomputed.");
