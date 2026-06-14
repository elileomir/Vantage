// Supabase Edge Function: sync-holidays
// Hands-off public-holiday refresh for KRDM/Vantage. Fetches South African public
// holidays from the Nager.Date API (free, no key), upserts public.holidays, and
// recomputes calendar.is_business_day (weekday AND not a holiday) — which feeds the
// working-day daily-target spread (PBI DAILY_TARGET / Current R YTD Target).
//
// Schedule via pg_cron (yearly is plenty; holidays are published well in advance).
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-provided. Optional env:
//   HOLIDAY_COUNTRY (default ZA), HOLIDAY_FROM (default 2023), HOLIDAY_TO (default 2031)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const COUNTRY = Deno.env.get("HOLIDAY_COUNTRY") ?? "ZA";
const FROM = Number(Deno.env.get("HOLIDAY_FROM") ?? "2023");
const TO = Number(Deno.env.get("HOLIDAY_TO") ?? "2031");

async function fetchYear(year: number) {
  const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${COUNTRY}`, {
    headers: { Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`Nager.Date ${year} ${COUNTRY} → ${r.status}`);
  return r.json() as Promise<Array<{ date: string; name?: string; localName?: string }>>;
}

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const seen = new Map<string, { date: string; name: string | null; details: string | null }>();
    for (let y = FROM; y <= TO; y++) {
      let days;
      try { days = await fetchYear(y); } catch (e) { console.error(String(e)); continue; }
      for (const h of days) {
        if (!h.date) continue;
        seen.set(h.date, { date: h.date, name: h.localName ?? h.name ?? null, details: h.name ?? null });
      }
    }
    const rows = [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "no holidays fetched (network?)" }), {
        status: 502, headers: { "Content-Type": "application/json" },
      });
    }

    // Replace-all (holidays are a small, fully-derived set), then recompute working days.
    const { error: delErr } = await supabase.from("holidays").delete().neq("date", "1900-01-01");
    if (delErr) throw delErr;
    const { error: insErr } = await supabase.from("holidays").upsert(rows, { onConflict: "date" });
    if (insErr) throw insErr;
    const { error: rpcErr } = await supabase.rpc("recompute_working_days");
    if (rpcErr) throw rpcErr;

    return new Response(
      JSON.stringify({ ok: true, country: COUNTRY, count: rows.length, span: [rows[0].date, rows[rows.length - 1].date] }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
