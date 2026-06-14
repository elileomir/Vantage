-- KRDM / Vantage analytics layer.
-- Aligned to the LIVE deployed schema (project cbrqfqxwexhoguoazhgh "KRDM Database"):
--   sales(amount, tax, total, customer_code, customer_name, sales_representative,
--         brand, product, sku, category, quantity, unit_price, order_date, invoice_date, status)
--   calendar(date, fiscal_year 'FY2026', fiscal_quarter 'Q1', fiscal_month int [Mar=1], is_business_day, ...)
--   sales_targets(fiscal_year, month, month_date, sales_rep, customer, brand, target_amount, yearly_forecast)
--
-- Replaces the stale 20260608143000 contract, whose column names (revenue/sales_rep/customer/calendar_date)
-- do not match the deployed tables. This migration is idempotent and non-destructive:
-- it creates/refreshes VIEWS only and does not alter existing tables or data.
--
-- Measure semantics mirror the Power BI model (see reference/analysis docs):
--   Sales            = SUM(sales.amount)            [PBI _SUM_AMOUNT]
--   Quantity         = SUM(sales.quantity)
--   Fiscal year      = March -> February, labelled FY<startYear> (FY2026 = Mar2026..Feb2027)
-- Advanced measures (LY date-aligned window, working-day daily-target spread, Pareto, run-rate forecast)
-- are layered on top of these views in the application/data-validation phase.

begin;

-- ---------------------------------------------------------------------------
-- Canonical analytical fact: each sales line enriched with the fiscal calendar.
-- Sale recognition date = invoice_date, falling back to order_date.
-- ---------------------------------------------------------------------------
create or replace view public.v_sales_fact
with (security_invoker = true) as
select
  s.id,
  s.cin7_sale_id,
  s.order_number,
  s.invoice_credit_note,
  s.status,
  coalesce(s.invoice_date, s.order_date)        as sale_date,
  c.fiscal_year,
  c.fiscal_quarter,
  c.fiscal_month,
  c.month_name,
  c.month_short,
  date_trunc('month', coalesce(s.invoice_date, s.order_date))::date as month_start,
  s.sales_representative,
  s.customer_code,
  s.customer_name,
  s.brand,
  s.product,
  s.sku,
  s.category,
  coalesce(s.quantity, 0)                        as quantity,
  coalesce(s.amount, 0)                          as amount,      -- net sales (PBI _SUM_AMOUNT)
  coalesce(s.tax, 0)                             as tax,
  coalesce(s.total, 0)                           as total        -- incl. tax (PBI _SUM_TOTAL)
from public.sales s
left join public.calendar c
  on c.date = coalesce(s.invoice_date, s.order_date);

-- ---------------------------------------------------------------------------
-- Monthly sales grain (rep x customer x brand) — the backbone for rollups.
-- ---------------------------------------------------------------------------
create or replace view public.v_sales_by_month
with (security_invoker = true) as
select
  fiscal_year,
  fiscal_quarter,
  fiscal_month,
  month_start,
  sales_representative,
  customer_code,
  customer_name,
  brand,
  sum(amount)        as sales_amount,
  sum(quantity)      as quantity,
  sum(total)         as total_amount,
  count(*)           as line_count
from public.v_sales_fact
group by 1,2,3,4,5,6,7,8;

-- ---------------------------------------------------------------------------
-- Targets by fiscal month (sales_targets is already monthly per rep/customer/brand).
-- ---------------------------------------------------------------------------
create or replace view public.v_target_by_month
with (security_invoker = true) as
select
  t.fiscal_year,
  t.month                          as fiscal_month,
  t.month_date                     as month_start,
  t.sales_rep                      as sales_representative,
  t.customer,
  t.brand,
  sum(t.target_amount)             as target_amount,
  max(t.yearly_forecast)           as yearly_forecast
from public.sales_targets t
group by 1,2,3,4,5,6;

-- ---------------------------------------------------------------------------
-- Per-dimension rollups (fiscal-year scoped). The app slices by fiscal_year.
-- ---------------------------------------------------------------------------
create or replace view public.v_sales_by_rep
with (security_invoker = true) as
select
  fiscal_year,
  sales_representative,
  sum(amount)                      as sales_amount,
  sum(quantity)                    as quantity,
  count(distinct customer_code)    as customer_count,
  count(*)                         as line_count
from public.v_sales_fact
group by 1,2;

create or replace view public.v_sales_by_brand
with (security_invoker = true) as
select
  fiscal_year,
  brand,
  sum(amount)                      as sales_amount,
  sum(quantity)                    as quantity,
  count(*)                         as line_count
from public.v_sales_fact
where brand is not null
group by 1,2;

create or replace view public.v_sales_by_customer
with (security_invoker = true) as
select
  fiscal_year,
  customer_code,
  customer_name,
  sum(amount)                      as sales_amount,
  sum(quantity)                    as quantity,
  count(*)                         as line_count
from public.v_sales_fact
group by 1,2,3;

create or replace view public.v_sales_by_product
with (security_invoker = true) as
select
  fiscal_year,
  brand,
  product,
  sku,
  sum(amount)                      as sales_amount,
  sum(quantity)                    as quantity,
  count(*)                         as line_count
from public.v_sales_fact
group by 1,2,3,4;

-- ---------------------------------------------------------------------------
-- Rep achievement vs target (fiscal-year scoped). Achievement = sales / target.
-- This is the first-order monthly-target achievement; the sales-date-aligned
-- working-day YTD target refinement is applied in the data-validation phase.
-- ---------------------------------------------------------------------------
create or replace view public.v_rep_achievement
with (security_invoker = true) as
with s as (
  select fiscal_year, sales_representative, sum(amount) as sales_amount
  from public.v_sales_fact group by 1,2
),
t as (
  select fiscal_year, sales_representative, sum(target_amount) as target_amount
  from public.v_target_by_month group by 1,2
)
select
  coalesce(s.fiscal_year, t.fiscal_year)               as fiscal_year,
  coalesce(s.sales_representative, t.sales_representative) as sales_representative,
  coalesce(s.sales_amount, 0)                          as sales_amount,
  coalesce(t.target_amount, 0)                         as target_amount,
  coalesce(s.sales_amount, 0) - coalesce(t.target_amount, 0) as variance_amount,
  case when coalesce(t.target_amount, 0) = 0 then null
       else coalesce(s.sales_amount, 0) / t.target_amount end as achievement_rate
from s
full outer join t
  on s.fiscal_year = t.fiscal_year
 and s.sales_representative = t.sales_representative;

-- ---------------------------------------------------------------------------
-- Year-over-year by fiscal month (prior FY, same fiscal_month).
-- fiscal_year is text 'FY2026'; prior year derived by parsing the numeric part.
-- ---------------------------------------------------------------------------
create or replace view public.v_yoy_by_month
with (security_invoker = true) as
with m as (
  select
    fiscal_year,
    (substring(fiscal_year from 'FY([0-9]+)'))::int as fy_start,
    fiscal_month,
    sales_representative,
    sum(amount) as sales_amount
  from public.v_sales_fact
  group by 1,2,3,4
)
select
  cur.fiscal_year,
  cur.fy_start,
  cur.fiscal_month,
  cur.sales_representative,
  cur.sales_amount                                    as current_sales,
  prior.sales_amount                                  as prior_sales,
  cur.sales_amount - coalesce(prior.sales_amount, 0)  as yoy_variance,
  case when coalesce(prior.sales_amount, 0) = 0 then null
       else (cur.sales_amount - prior.sales_amount) / prior.sales_amount end as yoy_growth_rate
from m cur
left join m prior
  on prior.fy_start = cur.fy_start - 1
 and prior.fiscal_month = cur.fiscal_month
 and prior.sales_representative = cur.sales_representative;

commit;
