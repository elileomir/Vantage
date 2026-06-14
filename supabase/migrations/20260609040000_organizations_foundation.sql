-- Multi-tenant foundation: organizations + members + per-org sync config.
-- Built "in advance" of full multi-tenancy: KRDM is org #1. Data tables are not yet
-- org-partitioned (single-tenant today); org_id tagging is a later phase.
begin;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  fiscal_year_start_month int not null default 3 check (fiscal_year_start_month between 1 and 12),
  -- Auto-sync tier -> cadence. manual = no auto sync.
  sync_tier text not null default 'standard' check (sync_tier in ('manual','standard','pro','enterprise')),
  sync_frequency_minutes int not null default 1440,        -- standard = daily
  -- Per-org CIN7 delta cursor (replaces the single global cin7_sync_state going forward).
  cin7_last_updated_since timestamptz,
  cin7_last_sync_at timestamptz,
  cin7_last_sync_status text,
  cin7_last_sync_rows int default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

-- Members can read their own orgs/memberships.
drop policy if exists "members read their orgs" on public.organizations;
create policy "members read their orgs" on public.organizations for select to authenticated
  using (id in (select org_id from public.organization_members where user_id = auth.uid()));
drop policy if exists "owners update their orgs" on public.organizations;
create policy "owners update their orgs" on public.organizations for update to authenticated
  using (id in (select org_id from public.organization_members where user_id = auth.uid() and role in ('owner','admin')))
  with check (true);
drop policy if exists "members read membership" on public.organization_members;
create policy "members read membership" on public.organization_members for select to authenticated
  using (user_id = auth.uid() or org_id in (select org_id from public.organization_members m where m.user_id = auth.uid()));

-- Product master cache: lets the auto-sync resolve brand/category from the DB
-- instead of re-fetching the whole CIN7 catalogue every run.
create table if not exists public.products (
  product_id text primary key,
  sku text,
  name text,
  brand text,
  category text,
  synced_at timestamptz not null default now()
);
create index if not exists products_sku_idx on public.products (sku);
alter table public.products enable row level security;
drop policy if exists "auth read products" on public.products;
create policy "auth read products" on public.products for select to authenticated using (true);

-- Seed KRDM as org #1, carry over fiscal start + the current delta cursor, add the user as owner.
insert into public.organizations (name, slug, fiscal_year_start_month, sync_tier, sync_frequency_minutes, cin7_last_updated_since, cin7_last_sync_at, cin7_last_sync_status)
select 'KRDM Stainless Steel Solutions', 'krdm',
       coalesce((select fiscal_year_start_month from public.app_settings where id=1), 3),
       'pro', 60,
       coalesce((select last_updated_since from public.cin7_sync_state where id=1), date '2026-06-09'),
       now(), 'baseline'
where not exists (select 1 from public.organizations where slug = 'krdm');

insert into public.organization_members (org_id, user_id, role)
select o.id, u.id, 'owner'
from public.organizations o, auth.users u
where o.slug = 'krdm'
on conflict (org_id, user_id) do nothing;

commit;
