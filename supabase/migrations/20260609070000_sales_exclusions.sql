-- Non-sales buckets excluded from the "Sales" measure (agreed with Tania):
-- Finance, Delivery Fees, Display & Signage, Marketing and Advertising.
-- Configurable: rows here are matched (case-insensitive) against sale brand OR category.
begin;

create table if not exists public.sales_exclusions (
  value text primary key,            -- UPPERCASE brand/category token to exclude
  label text not null,               -- friendly label shown in Settings
  created_at timestamptz not null default now()
);

insert into public.sales_exclusions (value, label) values
  ('FINANCE','Finance'),
  ('DELIVERY FEES','Delivery Fees'),
  ('DISPLAYS & SIGNAGE','Display & Signage'),
  ('DISPLAY & SIGNAGE','Display & Signage'),
  ('MARKETING & ADVERTISING','Marketing and Advertising'),
  ('MARKETING AND ADVERTISING','Marketing and Advertising')
on conflict (value) do nothing;

alter table public.sales_exclusions enable row level security;
drop policy if exists "auth read exclusions" on public.sales_exclusions;
create policy "auth read exclusions" on public.sales_exclusions for select to authenticated using (true);
drop policy if exists "auth manage exclusions" on public.sales_exclusions;
create policy "auth manage exclusions" on public.sales_exclusions for all to authenticated using (true) with check (true);

-- Sales = invoiced lines, excluding the non-sales buckets above (brand or category match).
create or replace view public.v_sales_fact
with (security_invoker = true) as
select s.id, s.cin7_sale_id, s.order_number, s.invoice_credit_note, s.status,
  coalesce(s.invoice_date, s.order_date) as sale_date,
  c.fiscal_year, c.fiscal_quarter, c.fiscal_month, c.month_name, c.month_short,
  date_trunc('month', coalesce(s.invoice_date, s.order_date))::date as month_start,
  s.sales_representative, s.customer_code, s.customer_name, s.brand, s.product, s.sku, s.category,
  coalesce(s.quantity,0) quantity, coalesce(s.amount,0) amount, coalesce(s.tax,0) tax, coalesce(s.total,0) total
from public.sales s
left join public.calendar c on c.date = coalesce(s.invoice_date, s.order_date)
where coalesce(s.status,'') in ('PAID','AUTHORISED')
  and upper(coalesce(s.brand,'-none-'))    not in (select value from public.sales_exclusions)
  and upper(coalesce(s.category,'-none-')) not in (select value from public.sales_exclusions);

commit;
