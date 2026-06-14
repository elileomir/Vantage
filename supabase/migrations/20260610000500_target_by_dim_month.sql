-- Filter-aware target aggregation per (dim × fiscal_month), small result set.
-- v_target_by_month has ~29k rows/FY, so client-side .select() truncates at max_rows=1000.
-- Targets carry rep/customer(name)/brand; we filter by the slicers that exist on the target grain
-- (rep, brand, month). Customer/product/sku/date/week slicers don't apply to the target table.
begin;

create or replace function public.get_target_by_dim_month(p_fy text, p_dim text, p_filters jsonb default '{}'::jsonb)
returns table(dim text, fiscal_month int, target numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  allowed text[] := array['sales_representative','customer','brand'];
begin
  if not (p_dim = any(allowed)) then raise exception 'invalid dim: %', p_dim; end if;
  return query execute format($q$
    select coalesce(nullif(trim((%I)::text),''),'Unassigned') as dim, fiscal_month::int, sum(target_amount)::numeric
    from public.v_target_by_month
    where fiscal_year = $1
      and (($2->>'rep')    is null or sales_representative = $2->>'rep')
      and (($2->>'brand')  is null or brand                = $2->>'brand')
      and (($2->>'month')  is null or fiscal_month          = ($2->>'month')::int)
    group by 1, 2
  $q$, p_dim) using p_fy, p_filters;
end;
$$;
grant execute on function public.get_target_by_dim_month(text, text, jsonb) to authenticated;

commit;
