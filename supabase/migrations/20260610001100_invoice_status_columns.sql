-- Capture CIN7 sale-level invoice/credit rollup status so revenue can be defined the same way as
-- the "Sales Credit Note" report (a sale is in the report when it has an issued invoice or credit
-- note). Backfilled from saleList by scripts/backfill-invoice-status.mjs; populated on sync going forward.
alter table public.sales add column if not exists combined_invoice_status text;
alter table public.sales add column if not exists credit_note_status text;
create index if not exists sales_combined_invoice_status_idx on public.sales (combined_invoice_status);
