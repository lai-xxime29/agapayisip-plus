-- AgapayIsip+ | 03_scheduler.sql
-- Run THIRD. Runs inside the database every minute, so it works even when the free
-- Render server is asleep (SR-04, FR-12, FR-20, BRL-04, BRL-06).
--
-- Before running: Supabase dashboard > Database > Extensions > enable "pg_cron".

create or replace function run_scheduler() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- 1. Appointments whose time has passed without completion become Missed (FR-12)
  update appointments set status = 'missed'
   where status = 'upcoming' and scheduled_at < now();

  -- 2. Missed appointment of a solo patient -> Home Visit Required task (FR-20)
  --    Uses the proxy BHW; if inactive, falls back to a BHW of the patient's purok (UC-08 E1)
  insert into home_visit_tasks (appointment_id, patient_id, assigned_bhw)
  select a.appointment_id, a.patient_id, x.bhw
  from appointments a
  join patients p on p.patient_id = a.patient_id and p.has_caretaker = false
  cross join lateral (
    select coalesce(
      (select pr.user_id from profiles pr
        where pr.user_id = p.assigned_bhw and pr.status = 'active'),
      (select pr.user_id from profiles pr
        where pr.role = 'bhw' and pr.status = 'active' and pr.purok_assigned = p.purok
        order by pr.created_at limit 1)
    ) as bhw
  ) x
  where a.status = 'missed' and x.bhw is not null
  on conflict (appointment_id) do nothing;

  -- 3. Open tasks older than 3 days become Overdue (UC-08 A3a)
  update home_visit_tasks set status = 'overdue'
   where status = 'open' and created_at < now() - interval '3 days';

  -- 4. Referrals not confirmed within 7 days show as Not Arrived (BRL-04)
  update referrals set status = 'not_arrived'
   where status = 'referred' and referred_at < now() - interval '7 days';
end $$;

-- Only the database owner (pg_cron) runs this; the app cannot call it
revoke execute on function run_scheduler() from public, anon, authenticated;

-- Allow tasks that went Overdue to be completed later
-- (the update policy in 02_security.sql already allows the assigned BHW to update them)

select cron.schedule('agapayisip-scheduler', '* * * * *', $$select public.run_scheduler()$$);

-- To test manually:   select run_scheduler();
-- To stop the job:    select cron.unschedule('agapayisip-scheduler');
