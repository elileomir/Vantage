-- Filter-aware two-dimension aggregation (key1 × key2 → sales), returning a SMALL result set
-- (immune to PostgREST max_rows=1000). Powers the decomposition trees:
--   Brands page:  Sales → Brand → Product   (dim1=brand, dim2=product)
--   Reps page:    Sales → Rep → Customer     (dim1=sales_representative, dim2=customer_name)
begin;

create or replace function public.get_sales_by_two_dims(
  p_fy text, p_dim1 text, p_dim2 text, p_filters jsonb default '{}'::jsonb
)
returns table(k1 text, k2 text, sales numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  allowed text[] := array['brand','product','sku','sales_representative','customer_code','customer_name','category'];
begin
  if not (p_dim1 = any(allowed)) then raise exception 'invalid dim1: %', p_dim1; end if;
  if not (p_dim2 = any(allowed)) then raise exception 'invalid dim2: %', p_dim2; end if;
  return query execute format($q$
    select coalesce(nullif(trim((%I)::text),''),'Unknown') as k1,
           coalesce(nullif(trim((%I)::text),''),'Unknown') as k2,
           sum(amount)::numeric
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
  $q$, p_dim1, p_dim2) using p_fy, p_filters;
end;
$$;
grant execute on function public.get_sales_by_two_dims(text, text, text, jsonb) to authenticated;

commit;
