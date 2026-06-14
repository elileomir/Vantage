-- Reusable filter-aware aggregation. Every chart (current + future) calls these with a
-- dimension + the active filters, so filtering is consistent everywhere and applied in SQL.
begin;

create or replace function public.get_sales_agg(p_fy text, p_dim text, p_filters jsonb default '{}'::jsonb)
returns table(dim text, sales numeric, quantity numeric, lines bigint)
language plpgsql
security invoker
set search_path = public
as $$
declare
  allowed text[] := array['brand','product','sku','sales_representative','customer_code','customer_name','category','fiscal_month','fiscal_quarter','month_short'];
begin
  if not (p_dim = any(allowed)) then
    raise exception 'invalid dimension: %', p_dim;
  end if;
  return query execute format($q$
    select (%I)::text as dim, sum(amount)::numeric, sum(quantity)::numeric, count(*)::bigint
    from public.v_sales_fact
    where fiscal_year = $1
      and (($2->>'rep')      is null or sales_representative = $2->>'rep')
      and (($2->>'brand')    is null or brand                = $2->>'brand')
      and (($2->>'customer') is null or customer_code        = $2->>'customer')
      and (($2->>'quarter')  is null or fiscal_quarter       = $2->>'quarter')
      and (($2->>'month')    is null or fiscal_month          = ($2->>'month')::int)
      and (($2->>'product')  is null or product              = $2->>'product')
      and (($2->>'sku')      is null or sku                  = $2->>'sku')
      and (($2->>'invoice')  is null or invoice_credit_note  = $2->>'invoice')
    group by 1
  $q$, p_dim) using p_fy, p_filters;
end;
$$;
grant execute on function public.get_sales_agg(text, text, jsonb) to authenticated;

create or replace function public.get_sales_kpis(p_fy text, p_filters jsonb default '{}'::jsonb)
returns table(sales numeric, quantity numeric, customers bigint, reps bigint, brands bigint, products bigint, lines bigint)
language sql
security invoker
set search_path = public
as $$
  select
    coalesce(sum(amount),0)::numeric, coalesce(sum(quantity),0)::numeric,
    count(distinct customer_code)::bigint, count(distinct sales_representative)::bigint,
    count(distinct brand)::bigint, count(distinct product)::bigint, count(*)::bigint
  from public.v_sales_fact
  where fiscal_year = p_fy
    and ((p_filters->>'rep')      is null or sales_representative = p_filters->>'rep')
    and ((p_filters->>'brand')    is null or brand                = p_filters->>'brand')
    and ((p_filters->>'customer') is null or customer_code        = p_filters->>'customer')
    and ((p_filters->>'quarter')  is null or fiscal_quarter       = p_filters->>'quarter')
    and ((p_filters->>'month')    is null or fiscal_month          = (p_filters->>'month')::int)
    and ((p_filters->>'product')  is null or product              = p_filters->>'product')
    and ((p_filters->>'sku')      is null or sku                  = p_filters->>'sku')
    and ((p_filters->>'invoice')  is null or invoice_credit_note  = p_filters->>'invoice');
$$;
grant execute on function public.get_sales_kpis(text, jsonb) to authenticated;

commit;
