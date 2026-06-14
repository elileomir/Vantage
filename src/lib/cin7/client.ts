// CIN7 Core (DEAR Systems) ExternalApi/v2 — typed, dependency-free client.
//
// Reads credentials from the environment (CIN7_ACCOUNT_ID, CIN7_API_KEY,
// CIN7_BASE_URL). Uses the Node/Next built-in `fetch`. Auth header values are
// NEVER included in any thrown error or log message.
//
// The `saleList` endpoint is a lightweight index (no line items / rep / brand).
// Per-line detail (and the sales representative) only comes from the per-sale
// `sale` endpoint, so a full sync must fan out one detail call per sale and is
// therefore rate-limit bound. See scripts/sync-cin7-sales.mjs for the CLI that
// drives this.

const DEFAULT_BASE_URL = "https://inventory.dearsystems.com/ExternalApi/v2";

interface Cin7Config {
  baseUrl: string;
  accountId: string;
  apiKey: string;
}

let cachedConfig: Cin7Config | null = null;

/**
 * Resolve and cache CIN7 credentials from the environment.
 * Throws a clear, secret-safe error if anything required is missing
 * (the error names the missing variable but never echoes any value).
 */
function getConfig(): Cin7Config {
  if (cachedConfig) return cachedConfig;

  const accountId = process.env.CIN7_ACCOUNT_ID?.trim();
  const apiKey = process.env.CIN7_API_KEY?.trim();
  const baseUrl = (process.env.CIN7_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");

  const missing: string[] = [];
  if (!accountId) missing.push("CIN7_ACCOUNT_ID");
  if (!apiKey) missing.push("CIN7_API_KEY");
  if (missing.length > 0) {
    throw new Error(
      `Missing required CIN7 environment variable(s): ${missing.join(", ")}. ` +
        `Set them in .env.local (see .env.example) or the process environment.`
    );
  }

  cachedConfig = { baseUrl, accountId: accountId!, apiKey: apiKey! };
  return cachedConfig;
}

// ── Types ────────────────────────────────────────────────────────────────

/** A single row from the `saleList` index (no line items). */
export interface SaleHeader {
  SaleID: string;
  OrderNumber: string | null;
  Status: string | null;
  OrderDate: string | null;
  InvoiceDate: string | null;
  InvoiceDueDate: string | null;
  /** Raw "(CODE) Name" string. */
  Customer: string | null;
  CustomerID: string | null;
  InvoiceNumber: string | null;
  InvoiceAmount: number | null;
  BaseCurrency: string | null;
  CreditNoteNumber: string | null;
  Updated: string | null;
  Type: string | null;
  [key: string]: unknown;
}

export interface SaleListResponse {
  Total: number;
  Page: number;
  SaleList: SaleHeader[];
}

/**
 * A normalized line item flattened from a sale's Invoices[].Lines or
 * CreditNotes[].Lines, ready to map onto the public.sales columns.
 * For credit notes, numeric fields are already negated so they net against
 * invoiced revenue (matching the Power BI report).
 */
export interface SaleLine {
  orderNumber: string | null;
  invoiceDate: string | null;
  orderDate: string | null;
  invoiceDueDate: string | null;
  customerCode: string | null;
  customerName: string | null;
  salesRepresentative: string | null;
  brand: string | null;
  product: string | null;
  sku: string | null;
  quantity: number;
  /** Net (pre-tax) amount. Negative for credit notes. */
  amount: number;
  tax: number;
  /** Gross (amount + tax). Negative for credit notes. */
  total: number;
  invoiceCreditNote: "Invoice" | "Credit note";
  status: string | null;
}

// ── Fetch with retry / backoff ─────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Cin7FetchOptions {
  /** Max attempts on throttling responses (429/503). Default 5. */
  maxRetries?: number;
  /** Base backoff in ms (doubled each retry). Default 1000. */
  baseDelayMs?: number;
}

/**
 * Low-level GET against the CIN7 API with auth headers.
 * Retries on 429/503 honouring the Retry-After header with exponential
 * backoff. Throws on any other non-2xx response. Error messages include the
 * status, endpoint and (truncated) response body but NEVER the auth headers.
 */
export async function cin7Fetch<T = unknown>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  options: Cin7FetchOptions = {}
): Promise<T> {
  const { baseUrl, accountId, apiKey } = getConfig();
  const maxRetries = options.maxRetries ?? 5;
  const baseDelayMs = options.baseDelayMs ?? 1000;

  const url = new URL(`${baseUrl}/${path.replace(/^\/+/, "")}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  let attempt = 0;
  // Retry loop: only 429/503 are retried; everything else throws immediately.
  for (;;) {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "api-auth-accountid": accountId,
        "api-auth-applicationkey": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    const throttled = response.status === 429 || response.status === 503;
    if (throttled && attempt < maxRetries) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterMs = retryAfterHeader
        ? Number(retryAfterHeader) * 1000
        : baseDelayMs * 2 ** attempt;
      const delay = Number.isFinite(retryAfterMs) && retryAfterMs > 0
        ? retryAfterMs
        : baseDelayMs * 2 ** attempt;
      attempt += 1;
      await sleep(delay);
      continue;
    }

    // Read a little of the body for diagnostics, but never the request headers.
    let body = "";
    try {
      body = (await response.text()).slice(0, 400);
    } catch {
      body = "<unreadable body>";
    }
    throw new Error(
      `CIN7 ${response.status} ${response.statusText} on GET /${path}` +
        (body ? ` — ${body}` : "")
    );
  }
}

// ── High-level helpers ─────────────────────────────────────────────────────

export interface ListSalesParams {
  page?: number;
  limit?: number;
  /** YYYY-MM-DD; maps to the CreatedSince query param. */
  createdSince?: string;
}

/** Fetch one page of the sale index. */
export async function listSales(
  params: ListSalesParams = {}
): Promise<SaleListResponse> {
  const { page = 1, limit = 100, createdSince } = params;
  return cin7Fetch<SaleListResponse>("saleList", {
    Page: page,
    Limit: limit,
    CreatedSince: createdSince,
  });
}

/** Fetch the full detail for a single sale (Order/Invoices/CreditNotes/...). */
export async function getSale(saleId: string): Promise<Record<string, unknown>> {
  return cin7Fetch<Record<string, unknown>>("sale", { ID: saleId });
}

/**
 * Parse the CIN7 "(CODE) Name" customer string.
 *   "(EO0018) EO Members : Nicholas Thiede" -> { code: "EO0018", name: "EO Members : Nicholas Thiede" }
 *   "Walk In"                                -> { code: null, name: "Walk In" }
 */
export function parseCustomer(
  s: string | null | undefined
): { code: string | null; name: string | null } {
  const raw = String(s ?? "").trim();
  if (!raw) return { code: null, name: null };
  const m = raw.match(/^\(([^)]+)\)\s*(.*)$/);
  if (m) {
    const name = (m[2] || "").trim();
    return { code: m[1].trim(), name: name || null };
  }
  return { code: null, name: raw };
}
