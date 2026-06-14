// On-demand "real-time" refresh: runs the CIN7 incremental (delta) sync — pulls only
// sales changed since the stored cursor, upserts them, advances the cursor. Fast when
// little/nothing changed ("Up to date"), so it's safe to hit from the dashboard's Refresh button.

import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Self-hosted worker (next start) ignores this; kept ≤60 so Vercel plan limits don't fail the build.
export const maxDuration = 60;

const TIMEOUT_MS = 280_000;

export async function POST() {
  // Only authenticated users may trigger a sync.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  // Serverless hosts (Vercel) can't spawn the long-running CIN7 sync script — that's the
  // background worker's job (scripts/auto-sync.mjs). Surface a clear message instead of failing.
  if (process.env.VERCEL) {
    return NextResponse.json({ ok: true, upToDate: true, salesUpserted: 0, rowsUpserted: 0, asOf: null, worker: true });
  }

  const result = await new Promise<{ code: number; out: string }>((resolve) => {
    const child = spawn(
      process.execPath,
      ["--env-file=.env.local", "scripts/sync-cin7-sales.mjs", "--incremental"],
      { cwd: process.cwd(), env: process.env },
    );
    let out = "";
    const onData = (b: Buffer) => { out += b.toString(); if (out.length > 40_000) out = out.slice(-40_000); };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    const timer = setTimeout(() => { child.kill("SIGKILL"); resolve({ code: 124, out: out + "\n[timed out]" }); }, TIMEOUT_MS);
    child.on("error", (err) => { clearTimeout(timer); resolve({ code: 1, out: out + `\n[spawn error] ${err.message}` }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code: code ?? 1, out }); });
  });

  const done = result.out.match(/Incremental done: (\d+) sales upserted \((\d+) line rows\)/);
  const upToDate = /Up to date — nothing to change\./.test(result.out);
  const salesUpserted = done ? Number(done[1]) : 0;
  const rowsUpserted = done ? Number(done[2]) : 0;

  // Latest report date after the sync (PBI "Data as of").
  const { data } = await supabase.from("v_sales_fact").select("sale_date").order("sale_date", { ascending: false }).limit(1);
  const asOf = (data?.[0]?.sale_date as string) ?? null;

  return NextResponse.json({
    ok: result.code === 0,
    upToDate,
    salesUpserted,
    rowsUpserted,
    asOf,
    tail: result.out.split("\n").filter(Boolean).slice(-8).join("\n"),
  });
}
