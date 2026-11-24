-- AgapayIsip+ | 05_demo_patient_appointments.sql
-- Run once in the Supabase SQL Editor AFTER "npm run seed".
-- Gives the two demo patient logins (patient01, patient02) appointments to see in the portal:
-- one upcoming in 3 days, and a short history (two completed, one missed).

insert into appointments (patient_id, clinician_id, scheduled_at, status)
select p.patient_id,
       (select user_id from profiles where username = 'dralcantara'),
       x.at, x.st::appt_status_type
from patients p
join profiles pr on pr.user_id = p.user_id and pr.username in ('patient01', 'patient02')
cross join (values
  (now() + interval '3 days',  'upcoming'),
  (now() - interval '14 days', 'completed'),
  (now() - interval '28 days', 'completed'),
  (now() - interval '42 days', 'missed')
) as x(at, st)
where not exists (select 1 from appointments a where a.patient_id = p.patient_id);

-- Check: select patient_id, scheduled_at, status from appointments where patient_id in
--   (select patient_id from patients where user_id is not null) order by scheduled_at;
