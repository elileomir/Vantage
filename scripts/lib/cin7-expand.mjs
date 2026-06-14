// ============================================================================
// SHARED CIN7 → public.sales expansion — the single source of truth for the
// validated SICN-report parity rules (see reference/analysis/cin7-pipeline-reconciliation.md).
//
//   A) tax mode from detail.TaxCalculation:
//        Inclusive -> line.Total is GROSS: amount = Total - Tax, total = Total
//        Exclusive -> line.Total is NET:   amount = Total,        total = Total + Tax
//   B) issued documents only: Invoice Status AUTHORISED/PAID, CreditNote AUTHORISED.
//        NO Order.Lines fallback (it fabricates rows for un-invoiced orders).
//   C) each line dated by its own document date (InvoiceDate / CreditNoteDate).
//   D) include AdditionalCharges (delivery/freight fees, GL account 4000-1).
//   F) dedupe documents by number (a credit note is reachable from multiple sale
//      tasks). Caller passes a shared `seenDocs` Set so each document is emitted once.
//
//   (Rule E — union saleList ∪ saleCreditNoteList for SaleID coverage — lives in the
//    callers, since it concerns which sales to fetch, not how to expand one.)
// ============================================================================

export const ISSUED_INVOICE = new Set(["AUTHORISED", "PAID"]);
export const ISSUED_CREDIT_NOTE = new Set(["AUTHORISED"]);

export function toDate(v) {
  if (!v) return null;
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function num(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// "(EO0018) EO Members : Nicholas Thiede" -> { code, name }
export function parseCustomer(v) {
  const s = String(v ?? "").trim();
  if (!s) return { code: null, name: null };
  const m = s.match(/^\(([^)]+)\)\s*(.*)$/);
  if (m) return { code: m[1].trim(), name: (m[2] || "").trim() || null };
  return { code: null, name: s };
}

function lookupProduct(line, ctx) {
  const byId = line.ProductID ? ctx.productById?.get(line.ProductID) : null;
  if (byId) return byId;
  const bySku = line.SKU != null ? ctx.productBySku?.get(String(line.SKU).trim()) : null;
  if (bySku) return bySku;
  const cand = line.Brand ?? line.brand ?? null;
  return { brand: cand ? String(cand).trim() || null : null, category: null };
}

function deriveRep(detail) {
  const cand = detail?.SalesRepresentative ?? detail?.SalesRep ?? null;
  const s = cand == null ? "" : String(cand).trim();
  return s || null;
}

// Build per-line rows for one document's lines (or AdditionalCharges).
function docToRows({ lines, sign, kind, inclusive, docDate, dueDate, detail, status, isCharge, docNumber }) {
  const { code, name } = parseCustomer(detail.Customer);
  const rep = deriveRep(detail);
  const orderNumber = detail.Order?.SaleOrderNumber ?? detail.OrderNumber ?? null;
  const orderDate = toDate(detail.SaleOrderDate ?? detail.OrderDate);
  const rows = [];
  for (const line of lines || []) {
    const qty = num(line.Quantity);
    const tax = num(line.Tax);
    const lineTotal = num(line.Total);
    const net = inclusive ? lineTotal - tax : lineTotal;
    const gross = inclusive ? lineTotal : lineTotal + tax;
    const prod = isCharge ? { brand: null, category: null } : lookupProduct(line, detail.__ctx || {});
    rows.push({
      cin7_sale_id: detail.ID ?? null,
      order_number: orderNumber ? String(orderNumber) : null,
      invoice_date: docDate,
      order_date: orderDate,
      invoice_due_date: dueDate,
      customer_code: code,
      customer_name: name,
      sales_representative: rep,
      brand: prod.brand,
      category: prod.category,
      product: (line.Name ?? line.Description) != null && String(line.Name ?? line.Description).trim() ? String(line.Name ?? line.Description).trim() : null,
      sku: line.SKU != null && String(line.SKU).trim() ? String(line.SKU).trim() : null,
      quantity: sign * qty,
      amount: sign * net,
      tax: sign * tax,
      total: sign * gross,
      invoice_credit_note: kind,
      status,
      document_number: docNumber ?? null,
    });
  }
  return rows;
}

// Expand one /sale detail into per-line rows applying Rules A–D,F.
// ctx = { productById, productBySku, seenDocs:Set }
export function expandSale(detail, ctx = {}) {
  detail.__ctx = ctx;
  const inclusive = String(detail.TaxCalculation || "").toLowerCase() === "inclusive";
  const seen = ctx.seenDocs;
  const rows = [];

  for (const inv of detail.Invoices || []) {
    if (!ISSUED_INVOICE.has(String(inv.Status || "").toUpperCase())) continue;
    const key = inv.InvoiceNumber ? `I:${inv.InvoiceNumber}` : null;
    if (key && seen) { if (seen.has(key)) continue; seen.add(key); }
    const docDate = toDate(inv.InvoiceDate);
    const dueDate = toDate(inv.InvoiceDueDate);
    const common = { sign: 1, kind: "Invoice", inclusive, docDate, dueDate, detail, status: inv.Status ?? detail.Status, docNumber: inv.InvoiceNumber ?? null };
    rows.push(...docToRows({ ...common, lines: inv.Lines }));
    rows.push(...docToRows({ ...common, lines: inv.AdditionalCharges, isCharge: true }));
  }

  for (const cn of detail.CreditNotes || []) {
    if (!ISSUED_CREDIT_NOTE.has(String(cn.Status || "").toUpperCase())) continue;
    const key = cn.CreditNoteNumber ? `C:${cn.CreditNoteNumber}` : null;
    if (key && seen) { if (seen.has(key)) continue; seen.add(key); }
    const docDate = toDate(cn.CreditNoteDate);
    const common = { sign: -1, kind: "Credit note", inclusive, docDate, dueDate: null, detail, status: cn.Status ?? detail.Status, docNumber: cn.CreditNoteNumber ?? null };
    rows.push(...docToRows({ ...common, lines: cn.Lines }));
    rows.push(...docToRows({ ...common, lines: cn.AdditionalCharges, isCharge: true }));
  }

  delete detail.__ctx;
  return rows;
}
