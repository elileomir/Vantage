-- Delta-sync support: a cursor table + indexes for fast per-sale upserts.
-- The sync replaces only the lines of sales that CHANGED (CIN7 UpdatedSince),
-- keyed by order_number, so unchanged/valid data is never touched.
begin;

create table if not exists public.cin7_sync_state (
  id int primary key default 1,
  last_updated_since timestamptz,
  last_run_at timestamptz,
  last_status text,
  sales_seen int default 0,
  constraint cin7_sync_state_singleton check (id = 1)
);
insert into public.cin7_sync_state (id) values (1) on conflict (id) do nothing;

alter table public.cin7_sync_state enable row level security;
drop policy if exists "auth read sync state" on public.cin7_sync_state;
create policy "auth read sync state" on public.cin7_sync_state for select to authenticated using (true);

-- Per-sale upsert key + future-proof CIN7 id lookup.
create index if not exists sales_order_number_idx on public.sales (order_number);
create index if not exists sales_cin7_sale_id_lookup_idx on public.sales (cin7_sale_id);
create index if not exists sales_status_idx on public.sales (status);

commit;
