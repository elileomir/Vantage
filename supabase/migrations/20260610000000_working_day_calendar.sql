-- Working-day calendar foundation for P0 numeric parity (PBI DAILY_TARGET / Current R YTD Target).
--
-- Power BI spreads each month's target over WORKING DAYS (weekdays minus public holidays)
-- and accrues YTD target only up to the LAST SALE DATE (sales-aligned). The app currently
-- approximates this at month granularity in JS. This migration builds the DB-side foundation:
--   1. public.holidays            — SA public holidays (loaded by scripts/import-holidays.mjs)
--   2. calendar.day_of_fiscal_year — ordinal day within the fiscal year (for day-level LY alignment)
--   3. recompute_working_days()    — is_business_day = weekday AND not a holiday
--   4. v_calendar_month_bizdays    — business-day count per fiscal month (daily-target denominator)
--   5. v_daily_target_global       — per-date global daily target (monthly target / business days)
--   6. ytd_target_aligned(fy,asof) — working-day target accrued to an as-of date (= Current R YTD Target, global)
--
-- Idempotent. After applying, run: node scripts/import-holidays.mjs  (loads holidays + recomputes).
-- Validate ytd_target_aligned('FY2026', <last sale date>) ≈ R10,753,898 before switching the data layer.

-- 1. Holidays -------------------------------------------------------------
create table if not exists public.holidays (
  date    date primary key,
  name    text,
  details text
);
alter table public.holidays enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='holidays' and policyname='holidays_read') then
    create policy holidays_read on public.holidays for select using (auth.role() = 'authenticated');
  end if;
end $$;

-- 2. day_of_fiscal_year ---------------------------------------------------
alter table public.calendar add column if not exists day_of_fiscal_year int;

-- 3. recompute_working_days() --------------------------------------------
-- is_business_day = Mon–Fri AND not a public holiday. Also (re)derives day_of_fiscal_year.
create or replace function public.recompute_working_days()
returns void
language plpgsql
as $$
begin
  update public.calendar c
  set is_business_day =
        (extract(isodow from c.date) < 6)
        and not exists (select 1 from public.holidays h where h.date = c.date)
  where c.date is not null;

  with ranked as (
    select date, row_number() over (partition by fiscal_year order by date) as rn
    from public.calendar
    where fiscal_year is not null
  )
  update public.calendar c
  set day_of_fiscal_year = r.rn
  from ranked r
  where r.date = c.date;
end;
$$;

-- Run once now (holidays table may be empty → weekday-only until import-holidays.mjs runs).
select public.recompute_working_days();

-- 4. Business days per fiscal month --------------------------------------
create or replace view public.v_calendar_month_bizdays as
select fiscal_year,
       fiscal_month,
       count(*) filter (where is_business_day) as business_days
from public.calendar
where fiscal_year is not null
group by fiscal_year, fiscal_month;

-- 5. Global daily target --------------------------------------------------
-- Monthly target (all reps/customers/brands) spread evenly over the month's business days,
-- charged only on business days. Mirrors PBI DAILY_TARGET at global scope.
create or replace view public.v_daily_target_global as
select c.date,
       c.fiscal_year,
       c.fiscal_month,
       c.is_business_day,
       case
         when c.is_business_day and b.business_days > 0
         then coalesce(t.month_target, 0) / b.business_days
         else 0
       end as daily_target
from public.calendar c
join public.v_calendar_month_bizdays b
  on b.fiscal_year = c.fiscal_year and b.fiscal_month = c.fiscal_month
left join (
  select fiscal_year, fiscal_month, sum(target_amount) as month_target
  from public.v_target_by_month
  group by fiscal_year, fiscal_month
) t
  on t.fiscal_year = c.fiscal_year and t.fiscal_month = c.fiscal_month;

-- 6. YTD target accrued to an as-of date (global) ------------------------
-- = PBI "Current R YTD Target" / "DAILY_TARGET_YTD (Sales Aligned)" at global scope.
-- p_asof should be MAX(sale_date) within the fiscal year (the "last sale date").
create or replace function public.ytd_target_aligned(p_fy text, p_asof date)
returns numeric
language sql
stable
as $$
  select coalesce(sum(daily_target), 0)
  from public.v_daily_target_global
  where fiscal_year = p_fy and date <= p_asof;
$$;

-- VALIDATION (run after import-holidays.mjs):
--   select public.ytd_target_aligned('FY2026', (select max(sale_date) from public.v_sales_fact where fiscal_year='FY2026'));
--   -- expect ≈ 10753898 (PBI Target). Headline sales ≈ 11848885 → achievement ≈ 110%.
