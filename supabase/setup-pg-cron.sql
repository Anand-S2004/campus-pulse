-- Campus Pulse — pg_cron setup
-- Run this in your Supabase SQL Editor (project zmjkkasiihycuutikims)
-- Prerequisites: pg_cron and pg_net extensions must be enabled
--   → Supabase dashboard → Database → Extensions → search "cron" and "http" and enable both

-- Replace YOUR_CRON_SECRET below with the value you set as the CRON_SECRET Replit Secret.

-- ① Every 5 minutes — push notifications for newly approved posts
SELECT cron.schedule(
  'notify-approvals',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ade93772-c283-47d4-867a-e40418939d7a-00-tfg0zlls6q38.janeway.replit.dev/api/public/cron/notify-approvals',
    headers := '{"content-type":"application/json","apikey":"YOUR_CRON_SECRET"}',
    body    := '{}'
  )
  $$
);

-- ② Daily at 08:00 UTC — generate Community Pulse cards
SELECT cron.schedule(
  'generate-pulse',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ade93772-c283-47d4-867a-e40418939d7a-00-tfg0zlls6q38.janeway.replit.dev/api/public/cron/generate-pulse',
    headers := '{"content-type":"application/json","apikey":"YOUR_CRON_SECRET"}',
    body    := '{}'
  )
  $$
);

-- ③ Every Monday at 09:00 UTC — generate weekly recaps + push recap notifications
SELECT cron.schedule(
  'generate-recap',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url     := 'https://ade93772-c283-47d4-867a-e40418939d7a-00-tfg0zlls6q38.janeway.replit.dev/api/public/cron/generate-recap',
    headers := '{"content-type":"application/json","apikey":"YOUR_CRON_SECRET"}',
    body    := '{}'
  )
  $$
);

-- ─────────────────────────────────────────────────────────────────
-- To verify the jobs were registered:
SELECT jobid, jobname, schedule, active FROM cron.job;

-- To test notify-approvals immediately (safe, returns {sent:N}):
SELECT net.http_post(
  url     := 'https://ade93772-c283-47d4-867a-e40418939d7a-00-tfg0zlls6q38.janeway.replit.dev/api/public/cron/notify-approvals',
  headers := '{"content-type":"application/json","apikey":"YOUR_CRON_SECRET"}',
  body    := '{}'
);

-- To remove a job if you need to update it:
-- SELECT cron.unschedule('notify-approvals');
-- SELECT cron.unschedule('generate-pulse');
-- SELECT cron.unschedule('generate-recap');
-- ─────────────────────────────────────────────────────────────────
