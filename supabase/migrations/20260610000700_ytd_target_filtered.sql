-- Scalar working-day-prorated YTD target for the FILTERED scope (rep/brand/month slicers apply
-- to the target table). Equals ytd_target_aligned() when no filters are set. Used by the Executive
-- KPI band so achievement reacts to the global slicers.
begin;

create or replace function public.ytd_target_aligned_filtered(p_fy text, p_asof date, p_filters jsonb default '{}'::jsonb)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  with bd as (
    select fiscal_month,
           count(*) filter (where is_business_day)                   as biz_total,
           count(*) filter (where is_business_day and date <= p_asof) as biz_elapsed
    from public.calendar
    where fiscal_year = p_fy
    group by fiscal_month
  ),
  tgt as (
    select fiscal_month, sum(target_amount) as month_target
    from public.v_target_by_month
    where fiscal_year = p_fy
      and ((p_filters->>'rep')   is null or sales_representative = p_filters->>'rep')
      and ((p_filters->>'brand') is null or brand                = p_filters->>'brand')
      and ((p_filters->>'month') is null or fiscal_month          = (p_filters->>'month')::int)
    group by fiscal_month
  )
  select coalesce(sum(t.month_target * case when bd.biz_total > 0
                                            then bd.biz_elapsed::numeric / bd.biz_total
                                            else 0 end), 0)
  from tgt t join bd on bd.fiscal_month = t.fiscal_month;
$$;
grant execute on function public.ytd_target_aligned_filtered(text, date, jsonb) to authenticated;

commit;
