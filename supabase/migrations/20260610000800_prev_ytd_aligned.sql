-- PBI "Previous YTD Aligned": prior-fiscal-year sales over the SAME day-of-fiscal-year window
-- (FY-start → EDATE(as-of, -12)), per dimension, filter-aware. Both fiscal years start in March,
-- so day_of_fiscal_year aligns the windows. Powers YOY_SALES / Growth vs LY / "drop vs LY".
begin;

create or replace function public.prev_ytd_aligned_by(p_fy text, p_asof date, p_dim text, p_filters jsonb default '{}'::jsonb)
returns table(dim text, sales numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  allowed text[] := array['brand','product','sku','sales_representative','customer_code','customer_name','category'];
  prior_fy text := 'FY' || ((regexp_replace(p_fy, '\D', '', 'g'))::int - 1)::text;
  asof_doy int;
begin
  if not (p_dim = any(allowed)) then raise exception 'invalid dimension: %', p_dim; end if;
  select day_of_fiscal_year into asof_doy from public.calendar where date = p_asof;
  if asof_doy is null then asof_doy := 400; end if; -- whole prior year if as-of unknown
  return query execute format($q$
    select coalesce(nullif(trim((f.%I)::text), ''), 'Unknown') as dim, sum(f.amount)::numeric
    from public.v_sales_fact f
    join public.calendar c on c.date = f.sale_date
    where f.fiscal_year = $3
      and c.day_of_fiscal_year <= $2
      and (($1->>'rep')       is null or f.sales_representative = $1->>'rep')
      and (($1->>'brand')     is null or f.brand                = $1->>'brand')
      and (($1->>'customer')  is null or f.customer_code        = $1->>'customer')
      and (($1->>'product')   is null or f.product              = $1->>'product')
      and (($1->>'sku')       is null or f.sku                  = $1->>'sku')
      and (($1->>'invoice')   is null or f.invoice_credit_note  = $1->>'invoice')
    group by 1
  $q$, p_dim) using p_filters, asof_doy, prior_fy;
end;
$$;
grant execute on function public.prev_ytd_aligned_by(text, date, text, jsonb) to authenticated;

commit;
