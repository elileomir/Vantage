-- Extra rollups for the Daily Tracking and Tabular pages.
begin;

create or replace view public.v_daily_sales
with (security_invoker = true) as
select
  sale_date,
  fiscal_year,
  fiscal_month,
  sum(amount)   as sales_amount,
  sum(quantity) as quantity,
  count(*)      as line_count
from public.v_sales_fact
where sale_date is not null
group by 1,2,3;

create or replace view public.v_brand_month
with (security_invoker = true) as
select
  fiscal_year,
  fiscal_month,
  brand,
  sum(amount)   as sales_amount,
  sum(quantity) as quantity
from public.v_sales_fact
where brand is not null and fiscal_year is not null
group by 1,2,3;

commit;
