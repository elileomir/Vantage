-- Configurable fiscal year start month.
-- KRDM's fiscal year is March->February (start month = 3), confirmed from the Power BI
-- report (Tabular page: Q1 = Mar/Apr/May; slicer "2026-2027"). This makes it changeable
-- from Settings: a single-row settings table + an RPC that recomputes the calendar's
-- fiscal columns so every dashboard view follows the new start month.

begin;

-- 1. Singleton settings row.
create table if not exists public.app_settings (
  id int primary key default 1,
  fiscal_year_start_month int not null default 3 check (fiscal_year_start_month between 1 and 12),
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);
insert into public.app_settings (id, fiscal_year_start_month) values (1, 3)
  on conflict (id) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists "auth read settings" on public.app_settings;
create policy "auth read settings" on public.app_settings for select to authenticated using (true);
drop policy if exists "auth update settings" on public.app_settings;
create policy "auth update settings" on public.app_settings for update to authenticated using (true) with check (true);

-- 2. Recompute calendar fiscal columns for a given start month (1..12).
--    fiscal_month: start month = 1 .. (start-1) = 12.  fiscal_year labelled FY<startYear>.
create or replace function public.recompute_calendar_fiscal(p_start int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_start < 1 or p_start > 12 then
    raise exception 'fiscal start month must be between 1 and 12';
  end if;
  update public.calendar c set
    fiscal_year = 'FY' || (
      case when extract(month from c.date)::int >= p_start
           then extract(year from c.date)::int
           else extract(year from c.date)::int - 1 end
    ),
    fiscal_month = ((extract(month from c.date)::int - p_start + 12) % 12) + 1,
    fiscal_quarter = 'Q' || (floor((((extract(month from c.date)::int - p_start + 12) % 12)) / 3) + 1)::int
  where c.date is not null;  -- WHERE required: Supabase pg-safeupdate guard blocks WHERE-less UPDATE via PostgREST
end;
$$;

-- 3. Public RPC the Settings page calls: persist + recompute in one transaction.
create or replace function public.set_fiscal_year_start(p_month int)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_month < 1 or p_month > 12 then
    raise exception 'fiscal start month must be between 1 and 12';
  end if;
  update public.app_settings set fiscal_year_start_month = p_month, updated_at = now() where id = 1;
  perform public.recompute_calendar_fiscal(p_month);
  return p_month;
end;
$$;
grant execute on function public.set_fiscal_year_start(int) to authenticated;

-- 4. Make targets follow the calendar's fiscal config (derive fiscal from calendar via month_date,
--    instead of the values stamped at import time). For the default March start this is identical.
create or replace view public.v_target_by_month
with (security_invoker = true) as
select
  coalesce(c.fiscal_year, t.fiscal_year)   as fiscal_year,
  coalesce(c.fiscal_month, t.month)        as fiscal_month,
  t.month_date                             as month_start,
  t.sales_rep                              as sales_representative,
  t.customer,
  t.brand,
  sum(t.target_amount)                     as target_amount,
  max(t.yearly_forecast)                   as yearly_forecast
from public.sales_targets t
left join public.calendar c on c.date = t.month_date
group by 1,2,3,4,5,6;

commit;
