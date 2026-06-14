-- KRDM / Vantage convenience rollups for the web data layer.
-- Pre-aggregated month and rep×month grains so the app computes YTD-aligned
-- measures (sales-aligned target, achievement) with minimal payload.

begin;

-- Global month totals: sales + quantity + monthly target, by fiscal month.
create or replace view public.v_month_totals
with (security_invoker = true) as
with s as (
  select fiscal_year, fiscal_month, min(month_start) as month_start,
         sum(amount) as sales_amount, sum(quantity) as quantity
  from public.v_sales_fact
  where fiscal_year is not null
  group by 1,2
),
t as (
  select fiscal_year, fiscal_month, sum(target_amount) as target_amount
  from public.v_target_by_month
  group by 1,2
)
select
  coalesce(s.fiscal_year, t.fiscal_year)   as fiscal_year,
  coalesce(s.fiscal_month, t.fiscal_month) as fiscal_month,
  s.month_start,
  coalesce(s.sales_amount, 0)              as sales_amount,
  coalesce(s.quantity, 0)                  as quantity,
  coalesce(t.target_amount, 0)             as target_amount
from s
full outer join t
  on s.fiscal_year = t.fiscal_year and s.fiscal_month = t.fiscal_month;

-- Rep × fiscal month: sales + monthly target. App sums target only over months
-- that have sales to reproduce the Power BI sales-aligned YTD target.
create or replace view public.v_rep_month
with (security_invoker = true) as
with s as (
  select fiscal_year, fiscal_month, sales_representative,
         sum(amount) as sales_amount, sum(quantity) as quantity
  from public.v_sales_fact
  where fiscal_year is not null
  group by 1,2,3
),
t as (
  select fiscal_year, fiscal_month, sales_representative, sum(target_amount) as target_amount
  from public.v_target_by_month
  group by 1,2,3
)
select
  coalesce(s.fiscal_year, t.fiscal_year)               as fiscal_year,
  coalesce(s.fiscal_month, t.fiscal_month)             as fiscal_month,
  coalesce(s.sales_representative, t.sales_representative) as sales_representative,
  coalesce(s.sales_amount, 0)                          as sales_amount,
  coalesce(s.quantity, 0)                              as quantity,
  coalesce(t.target_amount, 0)                         as target_amount
from s
full outer join t
  on s.fiscal_year = t.fiscal_year
 and s.fiscal_month = t.fiscal_month
 and s.sales_representative = t.sales_representative;

commit;
