// Supabase Edge Function: cin7-delta-sync
// Auto-sync for KRDM/Vantage. Runs the CIN7 delta sync for organizations whose
// auto-sync cadence is due: fetch only sales changed since the org's cursor
// (UpdatedSince), upsert each sale's lines by order_number, advance the cursor.
// Brand/category resolved from the public.products cache (no per-run catalogue fetch).
//
// Schedule via pg_cron -> this function. Secrets required:
//   CIN7_ACCOUNT_ID, CIN7_API_KEY, CIN7_BASE_URL  (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-provided)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CIN7_BASE = (Deno.env.get("CIN7_BASE_URL") ?? "https://inventory.dearsystems.com/ExternalApi/v2").replace(/\/+$/, "");
const AID = Deno.env.get("CIN7_ACCOUNT_ID") ?? "";
const KEY = Deno.env.get("CIN7_API_KEY") ?? "";
const MAX_SALES = 300;        // safety cap per invocation
const DETAIL_DELAY_MS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const toDate = (v: unknown) => (v ? String(v).slice(0, 10) : null);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
function parseCustomer(v: unknown) {
  const s = String(v ?? "").trim();
  const m = s.match(/^\(([^)]+)\)\s*(.*)$/);
  return m ? { code: m[1].trim(), name: (m[2] || "").trim() || null } : { code: null, name: s || null };
}

async function cin7(path: string, params: Record<string, string | number>) {
  const u = new URL(`${CIN7_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  for (let attempt = 0; ; ) {
    const r = await fetch(u, { headers: { "api-auth-accountid": AID, "api-auth-applicationkey": KEY } });
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status === 503) && attempt < 6) { attempt++; await sleep(1000 * 2 ** attempt); continue; }
    throw new Error(`CIN7 ${r.status} on ${path}`);
  }
}

type Row = Record<string, unknown>;
function linesToRows(lines: any[], sign: number, kind: string, header: any, detail: any, docDate: any, brandMap: Map<string, { brand: string | null; category: string | null }>): Row[] {
  const { code, name } = parseCustomer(header.Customer ?? detail.Customer);
  const rep = (detail?.SalesRepresentative ?? header?.SalesRepresentative ?? null) || null;
  const orderNumber = header.OrderNumber ?? detail?.Order?.SaleOrderNumber ?? null;
  const orderDate = toDate(header.OrderDate ?? detail.SaleOrderDate);
  const invoiceDate = toDate(docDate ?? header.InvoiceDate ?? header.OrderDate);
  const status = header.Status ?? detail.Status ?? null;
  return (lines || []).map((line) => {
    const net = num(line.Total), tax = num(line.Tax), qty = num(line.Quantity);
    const p = (line.ProductID && brandMap.get(line.ProductID)) || { brand: null, category: null };
    return {
      cin7_sale_id: header.SaleID ?? detail.ID ?? null,
      order_number: orderNumber ? String(orderNumber) : null,
      invoice_date: invoiceDate, order_date: orderDate,
      invoice_due_date: toDate(header.InvoiceDueDate),
      customer_code: code, customer_name: name, sales_representative: rep,
      brand: p.brand, category: p.category,
      product: line.Name ? String(line.Name).trim() : null,
      sku: line.SKU != null ? String(line.SKU).trim() : null,
      quantity: sign * qty, amount: sign * net, tax: sign * tax, total: sign * (net + tax),
      invoice_credit_note: kind, status,
    };
  });
}
function saleToRows(header: any, detail: any, brandMap: any): Row[] {
  const rows: Row[] = [];
  for (const inv of (detail.Invoices ?? [])) rows.push(...linesToRows(inv.Lines, 1, "Invoice", header, detail, inv.InvoiceDate, brandMap));
  for (const cn of (detail.CreditNotes ?? [])) rows.push(...linesToRows(cn.Lines, -1, "Credit note", header, detail, cn.CreditNoteDate, brandMap));
  if (rows.length === 0 && detail.Order?.Lines) {
    const isCredit = Boolean(header.CreditNoteNumber);
    rows.push(...linesToRows(detail.Order.Lines, isCredit ? -1 : 1, isCredit ? "Credit note" : "Invoice", header, detail, header.InvoiceDate ?? header.OrderDate, brandMap));
  }
  return rows;
}

Deno.serve(async () => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (!AID || !KEY) return new Response(JSON.stringify({ error: "CIN7 secrets not set" }), { status: 500 });

  // Orgs due for auto-sync (cadence elapsed since last sync), excluding 'manual'.
  const { data: orgs } = await sb.from("organizations").select("*").eq("is_active", true).neq("sync_tier", "manual");
  const due = (orgs ?? []).filter((o) => {
    if (!o.cin7_last_sync_at) return true;
    const mins = (Date.now() - new Date(o.cin7_last_sync_at).getTime()) / 60000;
    return mins >= (o.sync_frequency_minutes ?? 1440);
  });
  if (due.length === 0) return new Response(JSON.stringify({ ok: true, message: "no orgs due" }), { headers: { "content-type": "application/json" } });

  // Brand map from the products cache.
  const brandMap = new Map<string, { brand: string | null; category: string | null }>();
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from("products").select("product_id, brand, category").range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const p of data) brandMap.set(p.product_id, { brand: p.brand, category: p.category });
    if (data.length < 1000) break;
  }

  const results: unknown[] = [];
  for (const org of due) {
    const since = (org.cin7_last_updated_since ? String(org.cin7_last_updated_since) : new Date().toISOString()).slice(0, 10);
    const headers: any[] = [];
    let page = 1, total = Infinity, scanned = 0;
    while (headers.length < MAX_SALES) {
      const resp = await cin7("saleList", { Page: page, Limit: 100, UpdatedSince: since });
      total = resp.Total ?? 0;
      const list = resp.SaleList ?? [];
      if (!list.length) break;
      scanned += list.length;
      for (const h of list) { headers.push(h); if (headers.length >= MAX_SALES) break; }
      if (scanned >= total) break;
      page++; await sleep(DETAIL_DELAY_MS);
    }

    let sales = 0, rows = 0;
    for (const h of headers) {
      let detail;
      try { detail = await cin7("sale", { ID: h.SaleID }); } catch { await sleep(DETAIL_DELAY_MS); continue; }
      const r = saleToRows(h, detail, brandMap);
      const keyOr = h.OrderNumber ? `order_number.eq.${h.OrderNumber}` : null;
      if (keyOr) await sb.from("sales").delete().eq("order_number", String(h.OrderNumber));
      else if (h.SaleID) await sb.from("sales").delete().eq("cin7_sale_id", h.SaleID);
      if (r.length) await sb.from("sales").insert(r);
      sales++; rows += r.length;
      await sleep(DETAIL_DELAY_MS);
    }

    const runStamp = new Date().toISOString();
    await sb.from("organizations").update({
      cin7_last_updated_since: runStamp.slice(0, 10),
      cin7_last_sync_at: runStamp,
      cin7_last_sync_status: headers.length >= MAX_SALES ? "capped" : "succeeded",
      cin7_last_sync_rows: rows,
    }).eq("id", org.id);
    await sb.from("sync_log").insert({ sync_type: "cin7_delta_auto", status: "succeeded", records_fetched: sales, records_upserted: rows, metadata: { org: org.slug, since } });
    results.push({ org: org.slug, since, sales, rows, capped: headers.length >= MAX_SALES });
  }

  return new Response(JSON.stringify({ ok: true, results }), { headers: { "content-type": "application/json" } });
});
