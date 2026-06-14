-- Filter-aware customer matrix source, aggregated server-side to ONE row per
-- (rep, brand, customer) with a JSONB fiscal_month->sales map. This keeps the result set under
-- PostgREST max_rows=1000 (FY2026: 995 rep/brand/customer combos vs 1695 with month broken out),
-- replacing the client-side v_sales_fact .limit(8000) pull (which truncated at 1000).
begin;

create or replace function public.get_customer_matrix(p_fy text, p_filters jsonb default '{}'::jsonb)
returns table(sales_representative text, brand text, customer_code text, customer_name text, months jsonb)
language sql
security invoker
set search_path = public
as $$
  select rep, brand, code, name, jsonb_object_agg(fm::text, s)
  from (
    select coalesce(nullif(trim(sales_representative), ''), 'Unassigned')                       as rep,
           coalesce(nullif(trim(brand), ''), 'Unassigned')                                       as brand,
           coalesce(customer_code, '')                                                           as code,
           coalesce(nullif(trim(customer_name), ''), nullif(customer_code, ''), 'Unknown')       as name,
           fiscal_month                                                                          as fm,
           sum(amount)                                                                           as s
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
    group by 1, 2, 3, 4, 5
  ) t
  group by rep, brand, code, name;
$$;
grant execute on function public.get_customer_matrix(text, jsonb) to authenticated;

commit;
