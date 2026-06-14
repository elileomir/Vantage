-- Per-dimension working-day YTD target (rep / customer / brand) — the scoped form of
-- ytd_target_aligned(). Each fiscal month's target is prorated by the fraction of its WORKING
-- DAYS that have elapsed as of p_asof: completed months count in full, the current month is
-- prorated to the last sale date, future months contribute 0. Mirrors PBI ACHIEVE R 100% /
-- BRAND_ACHIEVE / CUST_ACHIEVE denominators.
--
-- Usage:
--   select * from ytd_target_aligned_by('FY2026', '2026-06-08', 'rep');
--   -- sum over all rows ≈ ytd_target_aligned('FY2026','2026-06-08') (global)

create or replace function public.ytd_target_aligned_by(p_fy text, p_asof date, p_dim text)
returns table(key text, target numeric)
language sql
stable
as $$
  with bd as (
    select fiscal_month,
           count(*) filter (where is_business_day)                       as biz_total,
           count(*) filter (where is_business_day and date <= p_asof)     as biz_elapsed
    from public.calendar
    where fiscal_year = p_fy
    group by fiscal_month
  ),
  tgt as (
    select case p_dim
             when 'rep'      then sales_representative
             when 'customer' then customer
             when 'brand'    then brand
           end                          as key,
           fiscal_month,
           sum(target_amount)           as month_target
    from public.v_target_by_month
    where fiscal_year = p_fy
    group by 1, fiscal_month
  )
  select t.key,
         sum(t.month_target * case when bd.biz_total > 0
                                   then bd.biz_elapsed::numeric / bd.biz_total
                                   else 0 end) as target
  from tgt t
  join bd on bd.fiscal_month = t.fiscal_month
  where t.key is not null
  group by t.key;
$$;
