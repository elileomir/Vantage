-- Add week_start to v_sales_fact (appended last; CREATE OR REPLACE can only add columns at the end).
begin;
create or replace view public.v_sales_fact
with (security_invoker = true) as
select s.id, s.cin7_sale_id, s.order_number, s.invoice_credit_note, s.status,
  coalesce(s.invoice_date, s.order_date) as sale_date,
  c.fiscal_year, c.fiscal_quarter, c.fiscal_month, c.month_name, c.month_short,
  date_trunc('month', coalesce(s.invoice_date, s.order_date))::date as month_start,
  s.sales_representative, s.customer_code, s.customer_name, s.brand, s.product, s.sku, s.category,
  coalesce(s.quantity,0) quantity, coalesce(s.amount,0) amount, coalesce(s.tax,0) tax, coalesce(s.total,0) total,
  c.week_start_date as week_start
from public.sales s
left join public.calendar c on c.date = coalesce(s.invoice_date, s.order_date)
where coalesce(s.status,'') in ('PAID','AUTHORISED')
  and upper(coalesce(s.brand,'-none-'))    not in (select value from public.sales_exclusions)
  and upper(coalesce(s.category,'-none-')) not in (select value from public.sales_exclusions);
commit;
