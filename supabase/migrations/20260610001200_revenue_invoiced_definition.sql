-- Revenue definition aligned to CIN7 'Sales Credit Note' report.
-- Synced rows (have combined_invoice_status): include when the sale has an issued invoice/credit
-- (combined_invoice_status LIKE '%INVOICED%' -> matches 'INVOICED' and 'INVOICED / CREDITED').
-- Imported/unbackfilled rows (null status, e.g. FY2025 loaded from SICN exports): keep the prior
-- PAID/AUTHORISED filter so historical totals are unchanged. Brand/category exclusions preserved.
create or replace view public.v_sales_fact as
 SELECT s.id,
    s.cin7_sale_id,
    s.order_number,
    s.invoice_credit_note,
    s.status,
    COALESCE(s.invoice_date, s.order_date) AS sale_date,
    c.fiscal_year,
    c.fiscal_quarter,
    c.fiscal_month,
    c.month_name,
    c.month_short,
    date_trunc('month'::text, COALESCE(s.invoice_date, s.order_date)::timestamp with time zone)::date AS month_start,
    s.sales_representative,
    s.customer_code,
    s.customer_name,
    s.brand,
    s.product,
    s.sku,
    s.category,
    COALESCE(s.quantity, 0::numeric) AS quantity,
    COALESCE(s.amount, 0::numeric) AS amount,
    COALESCE(s.tax, 0::numeric) AS tax,
    COALESCE(s.total, 0::numeric) AS total,
    c.week_start_date AS week_start
   FROM sales s
     LEFT JOIN calendar c ON c.date = COALESCE(s.invoice_date, s.order_date)
  WHERE (CASE WHEN s.combined_invoice_status IS NOT NULL THEN s.combined_invoice_status LIKE '%INVOICED%' ELSE COALESCE(s.status, ''::text) = ANY (ARRAY['PAID'::text, 'AUTHORISED'::text]) END) AND NOT (upper(COALESCE(s.brand, '-none-'::text)) IN ( SELECT sales_exclusions.value
           FROM sales_exclusions)) AND NOT (upper(COALESCE(s.category, '-none-'::text)) IN ( SELECT sales_exclusions.value
           FROM sales_exclusions));
