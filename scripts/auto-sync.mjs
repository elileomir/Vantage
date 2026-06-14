#!/usr/bin/env node
// ============================================================================
// AUTO-SYNC scheduler (option A) — keeps public.sales in step with CIN7.
// ----------------------------------------------------------------------------
// A single long-lived process (run one instance only — pm2 / systemd / nohup),
// so there's exactly one writer and no concurrent-sync / cursor races.
//
//   node --env-file=.env.local scripts/auto-sync.mjs
//   # or:  npm run sync:auto
//
// Each cycle does TWO things, covering every case the data can be in:
//   1) INCREMENTAL (every SYNC_INTERVAL_MINUTES) — CIN7 UpdatedSince delta:
//        • NEW sales            (added since the cursor)
//        • CHANGED historical   (old invoices/credit notes edited or voided)
//      Fast; advances the cursor. This is the "check for changes & update" pass.
//   2) RECONCILE (every RECONCILE_HOURS) — re-pull a trailing window
//      (--from N days ago --to today, delete+replace) to backfill any MISSING
//      data a delta pass could have skipped (failed run, out-of-window edits).
//
// Config (env — the hook where per-tier / per-customer cadence plugs in later):
//   SYNC_INTERVAL_MINUTES  incremental cadence            (default 20)
//   RECONCILE_HOURS        reconcile cadence              (default 24)
//   RECONCILE_DAYS         trailing reconcile window (d)  (default 45)
//   RECONCILE_LIMIT        max sales per reconcile run    (default 5000)
// ============================================================================

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SYNC = path.join(HERE, "sync-cin7-sales.mjs");

const INTERVAL_MIN = Math.max(1, Number(process.env.SYNC_INTERVAL_MINUTES || 20));
const RECONCILE_HOURS = Math.max(1, Number(process.env.RECONCILE_HOURS || 24));
const RECONCILE_DAYS = Math.max(1, Number(process.env.RECONCILE_DAYS || 45));
const RECONCILE_LIMIT = Math.max(1, Number(process.env.RECONCILE_LIMIT || 5000));

const log = (...a) => console.log(new Date().toISOString(), ...a);
const isoToday = () => new Date().toISOString().slice(0, 10);
const isoDaysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

function run(args, label) {
  return new Promise((resolve) => {
    log(`▶ ${label}: ${path.basename(SYNC)} ${args.join(" ")}`);
    const child = spawn(process.execPath, [SYNC, ...args], { env: process.env, stdio: "inherit" });
    child.on("close", (code) => { log(`■ ${label} exited ${code}`); resolve(code ?? 1); });
    child.on("error", (e) => { log(`! ${label} error: ${e.message}`); resolve(1); });
  });
}

let running = false;       // guard: never overlap two sync runs
let lastReconcile = 0;

async function tick() {
  if (running) { log("· previous cycle still running; skipping this tick"); return; }
  running = true;
  try {
    // 1) Incremental: new + changed (historical edits / voids) since the cursor.
    await run(["--incremental"], "incremental");

    // 2) Periodic reconcile: backfill any missing data in a trailing window.
    if (Date.now() - lastReconcile >= RECONCILE_HOURS * 3_600_000) {
      await run(["--from", isoDaysAgo(RECONCILE_DAYS), "--to", isoToday(), "--mode", "updated", "--limit", String(RECONCILE_LIMIT)], "reconcile");
      lastReconcile = Date.now();
    }
  } finally {
    running = false;
  }
}

process.on("SIGINT", () => { log("Auto-sync stopping (SIGINT)."); process.exit(0); });
process.on("SIGTERM", () => { log("Auto-sync stopping (SIGTERM)."); process.exit(0); });

log(`Auto-sync started · incremental every ${INTERVAL_MIN}m · reconcile every ${RECONCILE_HOURS}h (trailing ${RECONCILE_DAYS}d, limit ${RECONCILE_LIMIT}).`);
tick();
setInterval(tick, INTERVAL_MIN * 60_000);
