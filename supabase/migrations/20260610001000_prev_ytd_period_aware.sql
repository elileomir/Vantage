-- Fix: PBI "Previous YTD Aligned" must mirror the FILTERED current period in the prior year.
-- The previous version hardcoded the window to the full YTD (day_of_fiscal_year <= asof), so a
-- month/quarter/week/date slicer left LY at the whole prior YTD. Now the prior-FY window is the
-- day-of-fiscal-year range that the active period filters select (intersected with [FY-start, asof]).
-- Unfiltered behaviour is unchanged: no period filter => DOY 1..asof_doy => full prior YTD.
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
  lo int;
  hi int;
begin
  if not (p_dim = any(allowed)) then raise exception 'invalid dimension: %', p_dim; end if;

  -- Day-of-fiscal-year window of the CURRENT filtered period (period filters applied to the
  -- calendar, capped at the as-of date). Period filters are contiguous, so min/max is exact.
  select min(day_of_fiscal_year), max(day_of_fiscal_year) into lo, hi
  from public.calendar
  where fiscal_year = p_fy
    and date <= p_asof
    and ((p_filters->>'month')     is null or fiscal_month    = (p_filters->>'month')::int)
    and ((p_filters->>'quarter')   is null or fiscal_quarter  = p_filters->>'quarter')
    and ((p_filters->>'weekStart') is null or week_start_date = (p_filters->>'weekStart')::date)
    and ((p_filters->>'date')      is null or date            = (p_filters->>'date')::date);

  if lo is null then return; end if;

  return query execute format($q$
    select coalesce(nullif(trim((f.%I)::text), ''), 'Unknown') as dim, sum(f.amount)::numeric
    from public.v_sales_fact f
    join public.calendar c on c.date = f.sale_date
    where f.fiscal_year = $2
      and c.day_of_fiscal_year between $3 and $4
      and (($1->>'rep')      is null or f.sales_representative = $1->>'rep')
      and (($1->>'brand')    is null or f.brand               = $1->>'brand')
      and (($1->>'customer') is null or f.customer_code       = $1->>'customer')
      and (($1->>'product')  is null or f.product             = $1->>'product')
      and (($1->>'sku')      is null or f.sku                 = $1->>'sku')
      and (($1->>'invoice')  is null or f.invoice_credit_note = $1->>'invoice')
    group by 1
  $q$, p_dim) using p_filters, prior_fy, lo, hi;
end;
$$;

commit;
