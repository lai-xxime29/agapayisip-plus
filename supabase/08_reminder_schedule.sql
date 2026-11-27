-- 08: Every 5 minutes, ask the Render server to send due reminders (this also wakes the free server up).
-- BEFORE running:
--   1. Supabase dashboard > Database > Extensions > enable "pg_net" (pg_cron is already on).
--   2. Replace the two lines marked CHANGE ME below.
--      The secret must be the same text you put in CRON_SECRET on Render.

create extension if not exists pg_net;

-- Remove an older version of this job, if any (safe if there is none)
select cron.unschedule(jobid) from cron.job where jobname = 'agapayisip-reminders';

select cron.schedule(
  'agapayisip-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://CHANGE-ME.onrender.com/api/run-reminders',          -- CHANGE ME: your Render address
    headers := jsonb_build_object('x-cron-secret', 'CHANGE-ME-SECRET'),     -- CHANGE ME: your CRON_SECRET
    timeout_milliseconds := 60000
  );
  $$
);

-- Check the result later with:
--   select status_code, content, created from net._http_response order by created desc limit 5;
-- Stop it with:
--   select cron.unschedule('agapayisip-reminders');
