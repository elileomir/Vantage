-- Self-refreshing public holidays: pg_cron → Edge Function `sync-holidays` → Nager.Date.
-- Holidays are published years ahead, so a yearly run (2 Jan, 02:00 UTC) keeps the rolling
-- window current with zero manual upkeep. Reuses the cin7-delta-sync cron pattern and its
-- Vault service key (`cin7_cron_service_key`) — the key is never embedded inline.
--
-- Prereqs: pg_cron + pg_net; Edge Function `sync-holidays` deployed; Vault secret
-- `cin7_cron_service_key` present (already used by the cin7-delta-sync cron).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop any prior schedule before recreating.
select cron.unschedule('sync-holidays')
where exists (select 1 from cron.job where jobname = 'sync-holidays');

select cron.schedule(
  'sync-holidays',
  '0 2 2 1 *',  -- 02:00 UTC on 2 January, yearly
  $job$
  select net.http_post(
    url := 'https://cbrqfqxwexhoguoazhgh.supabase.co/functions/v1/sync-holidays',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cin7_cron_service_key')
    ),
    body := '{}'::jsonb
  );
  $job$
);

-- Manual trigger anytime: node scripts/sync-holidays.mjs  (live fetch + upsert + recompute).
