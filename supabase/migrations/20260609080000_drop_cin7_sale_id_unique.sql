-- cin7_sale_id is the SALE id; each sale expands to MANY line rows, so it is NOT unique.
-- The original Antigravity schema declared it UNIQUE, which blocks line-level inserts.
-- Drop the unique constraint; a plain lookup index already exists (20260609030000).
begin;
alter table public.sales drop constraint if exists sales_cin7_sale_id_key;
drop index if exists public.sales_cin7_sale_id_idx;
commit;
