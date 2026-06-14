#!/usr/bin/env node
// Resumable, quota-paced historical backfill orchestrator.
// CIN7 allows ~5,000 requests/day, so a full reload spans multiple days. This script
// processes a batch of windows per run, records progress, and resumes where it left off.
//
//   SUPABASE_ACCESS_TOKEN=... node scripts/backfill-history.mjs            # FY2025 + FY2026
//   BACKFILL_START=2020-01-01 node scripts/backfill-history.mjs           # all history
//   BACKFILL_MAX=4 node scripts/backfill-history.mjs                       # windows per run
//
// Run it repeatedly (or daily via cron) until "Remaining: 0".
//
// Strategy: the CURRENT fiscal year is synced as ONE 'updated' window (full credit-note
// capture). Older months are synced one-by-one in 'created' mode (UpdatedSince would
// return the whole history for an old start date).

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const START = process.env.BACKFILL_START || "2025-03-01"; // FY2025 start
const MAX_PER_RUN = Number(process.env.BACKFILL_MAX || 4);
const DONE_FILE = ".tmp/backfill-progress.json";
const today = new Date().toISOString().slice(0, 10);

// Current fiscal year start (KRDM FY = March -> February).
function currentFyStart(iso) {
  const d = new Date(iso + "T00:00:00Z");
  const y = d.getUTCFullYear();
  const fyStartYear = d.getUTCMonth() + 1 >= 3 ? y : y - 1;
  return `${fyStartYear}-03-01`;
}
function monthsBetween(startISO, endISO) {
  const out = [];
  let d = new Date(startISO + "T00:00:00Z");
  const e = new Date(endISO + "T00:00:00Z");
  while (d <= e) {
    const y = d.getUTCFullYear(), m = d.getUTCMonth();
    const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const to = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
    out.push({ id: from.slice(0, 7), from, to });
    d = new Date(Date.UTC(y, m + 1, 1));
  }
  return out;
}

const fyStart = currentFyStart(today);
const windows = [];
// 1) current fiscal year as one 'updated' window
windows.push({ id: `current-${fyStart.slice(0, 4)}`, from: fyStart, to: today, mode: "updated" });
// 2) older months in 'created' mode, newest first, down to START
const olderEnd = new Date(Date.UTC(Number(fyStart.slice(0, 4)), 1, 0)).toISOString().slice(0, 10); // end of Feb before FY start
for (const w of monthsBetween(START, olderEnd).reverse()) {
  windows.push({ ...w, mode: "created" });
}

if (!existsSync(".tmp")) mkdirSync(".tmp");
const done = existsSync(DONE_FILE) ? JSON.parse(readFileSync(DONE_FILE, "utf8")) : {};
const pending = windows.filter((w) => !done[w.id]);

console.log(`Backfill: ${windows.length} windows (START=${START}), ${pending.length} pending. Up to ${MAX_PER_RUN} this run.`);
let processed = 0;
for (const w of pending) {
  if (processed >= MAX_PER_RUN) { console.log(`\nReached per-run cap (${MAX_PER_RUN}). Re-run to continue.`); break; }
  const to = w.to > today ? today : w.to;
  console.log(`\n=== ${w.id}  ${w.from}..${to}  mode=${w.mode} ===`);
  const r = spawnSync("node", ["--env-file=.env.local", "scripts/sync-cin7-sales.mjs", "--from", w.from, "--to", to, "--mode", w.mode, "--limit", "5000"], { stdio: "inherit", env: process.env });
  if (r.status === 0) {
    done[w.id] = { at: new Date().toISOString(), from: w.from, to };
    writeFileSync(DONE_FILE, JSON.stringify(done, null, 2));
    processed++;
  } else {
    console.log(`\nWindow ${w.id} failed (likely the 5,000/day quota). Progress saved. Re-run tomorrow to resume.`);
    break;
  }
}
console.log(`\nThis run: ${processed} windows done. Remaining: ${pending.length - processed}.`);
