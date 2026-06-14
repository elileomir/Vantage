-- Target lines for one sales rep: one row per (customer, brand) with a fiscal_month->target map.
-- Used by the Target Management editor (rep selector → that rep's customer/brand lines).
-- Per-rep combo counts are <1000 (max 828), so the result stays under PostgREST max_rows.
begin;

create or replace function public.get_rep_target_lines(p_fy text, p_rep text)
returns table(customer text, brand text, annual numeric, months jsonb)
language sql
security invoker
set search_path = public
as $$
  select coalesce(nullif(trim(customer), ''), 'Unassigned') as customer,
         coalesce(nullif(trim(brand), ''), 'Unassigned')    as brand,
         sum(target_amount)::numeric                        as annual,
         jsonb_object_agg(month::text, target_amount)       as months
  from public.sales_targets
  where fiscal_year = p_fy and sales_rep = p_rep
  group by 1, 2
  order by 3 desc;
$$;
grant execute on function public.get_rep_target_lines(text, text) to authenticated;

commit;
