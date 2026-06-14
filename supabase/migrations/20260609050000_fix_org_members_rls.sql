-- Fix infinite recursion: the organization_members read policy queried
-- organization_members within its own USING clause. A user reading their own
-- memberships only needs user_id = auth.uid().
begin;
drop policy if exists "members read membership" on public.organization_members;
drop policy if exists "members read own membership" on public.organization_members;
create policy "members read own membership" on public.organization_members
  for select to authenticated using (user_id = auth.uid());
commit;
