-- Filter-aware aggregation RPCs that return SMALL result sets (immune to PostgREST max_rows=1000).
-- Needed because v_sales_fact has >1000 rows/FY, so client-side .select().limit() truncates.
--   get_daily_sales        — per-day sales/qty/lines (≤366 rows)        → Daily page
--   get_sales_by_dim_month — per (dim × fiscal_month) sales/qty/lines   → Tabular pivots
-- Both apply the full global filter set (incl. week_start + sale_date) in SQL.
begin;

create or replace function public.get_daily_sales(p_fy text, p_filters jsonb default '{}'::jsonb)
returns table(sale_date date, sales numeric, quantity numeric, lines bigint)
language sql
security invoker
set search_path = public
as $$
  select sale_date, sum(amount)::numeric, sum(quantity)::numeric, count(*)::bigint
  from public.v_sales_fact
  where fiscal_year = p_fy
    and ((p_filters->>'rep')       is null or sales_representative = p_filters->>'rep')
    and ((p_filters->>'brand')     is null or brand                = p_filters->>'brand')
    and ((p_filters->>'customer')  is null or customer_code        = p_filters->>'customer')
    and ((p_filters->>'quarter')   is null or fiscal_quarter       = p_filters->>'quarter')
    and ((p_filters->>'month')     is null or fiscal_month          = (p_filters->>'month')::int)
    and ((p_filters->>'weekStart') is null or week_start           = (p_filters->>'weekStart')::date)
    and ((p_filters->>'date')      is null or sale_date            = (p_filters->>'date')::date)
    and ((p_filters->>'product')   is null or product              = p_filters->>'product')
    and ((p_filters->>'sku')       is null or sku                  = p_filters->>'sku')
    and ((p_filters->>'invoice')   is null or invoice_credit_note  = p_filters->>'invoice')
  group by sale_date
  order by sale_date;
$$;
grant execute on function public.get_daily_sales(text, jsonb) to authenticated;

create or replace function public.get_sales_by_dim_month(p_fy text, p_dim text, p_filters jsonb default '{}'::jsonb)
returns table(dim text, fiscal_month int, sales numeric, quantity numeric, lines bigint)
language plpgsql
security invoker
set search_path = public
as $$
declare
  allowed text[] := array['brand','product','sku','sales_representative','customer_code','customer_name','category'];
begin
  if not (p_dim = any(allowed)) then
    raise exception 'invalid dimension: %', p_dim;
  end if;
  return query execute format($q$
    select (%I)::text as dim, fiscal_month::int, sum(amount)::numeric, sum(quantity)::numeric, count(*)::bigint
    from public.v_sales_fact
    where fiscal_year = $1
      and (($2->>'rep')       is null or sales_representative = $2->>'rep')
      and (($2->>'brand')     is null or brand                = $2->>'brand')
      and (($2->>'customer')  is null or customer_code        = $2->>'customer')
      and (($2->>'quarter')   is null or fiscal_quarter       = $2->>'quarter')
      and (($2->>'month')     is null or fiscal_month          = ($2->>'month')::int)
      and (($2->>'weekStart') is null or week_start           = ($2->>'weekStart')::date)
      and (($2->>'date')      is null or sale_date            = ($2->>'date')::date)
      and (($2->>'product')   is null or product              = $2->>'product')
      and (($2->>'sku')       is null or sku                  = $2->>'sku')
      and (($2->>'invoice')   is null or invoice_credit_note  = $2->>'invoice')
    group by 1, 2
  $q$, p_dim) using p_fy, p_filters;
end;
$$;
grant execute on function public.get_sales_by_dim_month(text, text, jsonb) to authenticated;

commit;
