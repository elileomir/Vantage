-- Count only invoiced sales (PAID or AUTHORISED) as revenue, matching the Power BI
-- "Sale Invoice Lines" report. Excludes quotes/orders not yet invoiced
-- (DRAFT / ESTIMATING / ORDERING) that the CIN7 sync's order-line fallback can pull in.
begin;
create or replace view public.v_sales_fact
with (security_invoker = true) as
select s.id, s.cin7_sale_id, s.order_number, s.invoice_credit_note, s.status,
  coalesce(s.invoice_date, s.order_date) as sale_date,
  c.fiscal_year, c.fiscal_quarter, c.fiscal_month, c.month_name, c.month_short,
  date_trunc('month', coalesce(s.invoice_date, s.order_date))::date as month_start,
  s.sales_representative, s.customer_code, s.customer_name, s.brand, s.product, s.sku, s.category,
  coalesce(s.quantity,0) quantity, coalesce(s.amount,0) amount, coalesce(s.tax,0) tax, coalesce(s.total,0) total
from public.sales s
left join public.calendar c on c.date = coalesce(s.invoice_date, s.order_date)
where coalesce(s.status,'') in ('PAID','AUTHORISED');
commit;
