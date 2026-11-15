-- AgapayIsip+ | 02_security.sql
-- Run SECOND. Helper functions, RPC functions, triggers, grants and row-level security
-- (SRS Section 8.1 role-permission matrix, BRL-01 to BRL-10).

-- =====================================================================
-- Helper functions (SECURITY DEFINER so policies can look at profiles/patients safely)
-- =====================================================================
create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where user_id = auth.uid() and status = 'active'
$$;

create or replace function auth_purok() returns text
language sql stable security definer set search_path = public as $$
  select purok_assigned from profiles where user_id = auth.uid() and status = 'active'
$$;

-- Can the current user see this patient's full name? (BRL-02)
create or replace function can_see_identity(pid text) returns boolean
language sql stable security definer set search_path = public as $$
  select case auth_role()
    when 'psychiatrist' then true
    when 'bhw' then exists (
      select 1 from patients p
      where p.patient_id = pid and (p.purok = auth_purok() or p.assigned_bhw = auth.uid()))
    when 'patient' then exists (select 1 from patients p where p.patient_id = pid and p.user_id = auth.uid())
    else false
  end
$$;

-- Can the current user open this patient's records (appointments, observations, notes...)?
create or replace function can_access_patient(pid text) returns boolean
language sql stable security definer set search_path = public as $$
  select case auth_role()
    when 'psychiatrist' then true
    when 'bhw' then exists (
      select 1 from patients p
      where p.patient_id = pid
        and (p.purok = auth_purok() or p.assigned_bhw = auth.uid() or p.registered_by = auth.uid()))
    when 'patient' then exists (select 1 from patients p where p.patient_id = pid and p.user_id = auth.uid())
    else false
  end
$$;

create or replace function log_audit(p_action text, p_entity text default null, p_entity_id text default null)
returns void language sql security definer set search_path = public as $$
  insert into audit_log(user_id, action, entity, entity_id) values (auth.uid(), p_action, p_entity, p_entity_id)
$$;

-- =====================================================================
-- RPC functions (called from the app with supabase.rpc('name', {...}))
-- =====================================================================

-- FR-05 / FR-19 / NFR-13: register a patient + identity in one step, safe to retry offline
create or replace function register_patient(
  p_client_entry_id   uuid,
  p_full_name         text,
  p_birth_date        date,
  p_sex               sex_type,
  p_purok             text,
  p_emergency_contact text,
  p_has_caretaker     boolean,
  p_assigned_bhw      uuid default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_initials text;
  v_proxy uuid;
begin
  if auth_role() is distinct from 'bhw' then
    raise exception 'Only BHW accounts can register patients';
  end if;

  select patient_id into v_id from patients where client_entry_id = p_client_entry_id;
  if found then return v_id; end if;                 -- already uploaded once

  v_proxy := case when p_has_caretaker then p_assigned_bhw
                  else coalesce(p_assigned_bhw, auth.uid()) end;   -- BRL-01 default = registering BHW

  select string_agg(upper(left(w, 1)), '') into v_initials
  from unnest(regexp_split_to_array(trim(p_full_name), '\s+')) as w;

  insert into patients(client_entry_id, initials, purok, has_caretaker, assigned_bhw)
  values (p_client_entry_id, v_initials, p_purok, p_has_caretaker, v_proxy)
  returning patient_id into v_id;

  insert into patient_identities(patient_id, full_name, birth_date, sex, emergency_contact)
  values (v_id, trim(p_full_name), p_birth_date, p_sex, p_emergency_contact);

  perform log_audit('register_patient', 'patient', v_id);
  return v_id;
end $$;

-- FR-13: patient / caretaker / BHW flags "Cannot Attend"
create or replace function request_reschedule(p_appointment_id uuid, p_reason text, p_preferred_date date)
returns void language plpgsql security definer set search_path = public as $$
declare a appointments;
begin
  if auth_role() not in ('patient','bhw') then raise exception 'Not allowed'; end if;
  select * into a from appointments where appointment_id = p_appointment_id;
  if not found or not can_access_patient(a.patient_id) then raise exception 'Appointment not found'; end if;
  if a.status <> 'upcoming' or a.scheduled_at <= now() then
    raise exception 'Only an upcoming appointment can be rescheduled';
  end if;
  if p_preferred_date is null or p_preferred_date <= current_date then
    raise exception 'Preferred date must be after today';
  end if;

  update appointments
     set status = 'reschedule_requested', reschedule_reason = p_reason,
         preferred_date = p_preferred_date, requested_by = auth.uid()
   where appointment_id = p_appointment_id;
  perform log_audit('request_reschedule', 'appointment', p_appointment_id::text);
end $$;

-- FR-14: psychiatrist sets the new date (old row -> rescheduled, new row -> upcoming)
create or replace function resolve_reschedule(p_appointment_id uuid, p_new_at timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare a appointments; v_new uuid;
begin
  if auth_role() is distinct from 'psychiatrist' then raise exception 'Only the psychiatrist can reschedule'; end if;
  select * into a from appointments where appointment_id = p_appointment_id;
  if not found or a.status <> 'reschedule_requested' then raise exception 'No open reschedule request'; end if;
  if p_new_at <= now() then raise exception 'New date must be in the future'; end if;

  update appointments set status = 'rescheduled' where appointment_id = p_appointment_id;
  insert into appointments(patient_id, clinician_id, scheduled_at)
  values (a.patient_id, a.clinician_id, p_new_at) returning appointment_id into v_new;
  perform log_audit('resolve_reschedule', 'appointment', v_new::text);
  return v_new;
end $$;

-- FR-10: mark a referred patient as Arrived
create or replace function mark_referral_arrived(p_referral_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth_role() is distinct from 'psychiatrist' then raise exception 'Only RHU clinical staff can confirm arrival'; end if;
  update referrals set status = 'arrived', arrived_at = now()
   where referral_id = p_referral_id and status in ('referred','not_arrived');
  if not found then raise exception 'Referral not found or already closed'; end if;
  perform log_audit('referral_arrived', 'referral', p_referral_id::text);
end $$;

-- FR-23 / BRL-10: archive instead of delete
create or replace function archive_patient(p_patient_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth_role() is distinct from 'administrator' then raise exception 'Only the Administrator can archive'; end if;
  if exists (select 1 from appointments where patient_id = p_patient_id
             and status in ('upcoming','reschedule_requested')) then
    raise exception 'Patient still has open appointments';
  end if;
  update patients set is_archived = true where patient_id = p_patient_id;
  perform log_audit('archive_patient', 'patient', p_patient_id);
end $$;

-- =====================================================================
-- Triggers
-- =====================================================================
-- FR-08: a Yes to either risk question sets the patient to High Risk
create or replace function apply_risk_flag() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.suicidal_ideation or new.self_harm_history then
    update patients set risk_level = 'high' where patient_id = new.patient_id;
  end if;
  return new;
end $$;
create trigger observations_risk_flag after insert on observations
  for each row execute function apply_risk_flag();

-- FR-11: the care phase chosen in a consultation updates the patient
create or replace function apply_care_phase() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update patients set case_phase = new.care_phase where patient_id = new.patient_id;
  return new;
end $$;
create trigger consultations_care_phase after insert on consultations
  for each row execute function apply_care_phase();

-- =====================================================================
-- Views
-- =====================================================================
-- AC-10: BHWs see the follow-up plan but never the note text
create view consultation_plans as
  select consultation_id, patient_id, care_phase, follow_up_plan, consulted_at
  from consultations
  where auth_role() in ('bhw','psychiatrist') and can_access_patient(patient_id);

-- BR-05 / NFR-06: aggregates only, no names or contact details
create view stats_cases_by_purok as
  select purok,
         count(*) filter (where not is_archived)                         as active_cases,
         count(*) filter (where risk_level = 'high' and not is_archived) as high_risk_cases,
         count(*) filter (where case_phase = 'discharged')               as discharged_cases
  from patients
  where auth_role() in ('coordinator','administrator')
  group by purok;

-- =====================================================================
-- Table privileges (start from nothing, then grant only what the app needs)
-- =====================================================================
revoke all on all tables in schema public from anon, authenticated;

grant select on puroks, profiles, patients, patient_identities, observations, referrals,
               consultations, appointments, home_visit_tasks, patient_notes,
               push_subscriptions, notifications, audit_log to authenticated;
grant select on consultation_plans, stats_cases_by_purok to authenticated;

grant insert on observations, referrals, consultations, appointments, patient_notes,
               push_subscriptions to authenticated;
grant delete on push_subscriptions to authenticated;                 -- revoke permission (SR-03)
grant update (status)                           on appointments     to authenticated;  -- psychiatrist marks Completed
grant update (status, outcome, completed_at)    on home_visit_tasks to authenticated;
grant update (assigned_bhw)                     on patients         to authenticated;

-- Functions: nothing is callable by default; open only what the app uses
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  auth_role(), auth_purok(), can_see_identity(text), can_access_patient(text),
  register_patient(uuid, text, date, sex_type, text, text, boolean, uuid),
  request_reschedule(uuid, text, date),
  resolve_reschedule(uuid, timestamptz),
  mark_referral_arrived(uuid),
  archive_patient(text),
  log_audit(text, text, text)
to authenticated;

-- =====================================================================
-- Row-level security policies
-- =====================================================================
alter table puroks             enable row level security;
alter table profiles           enable row level security;
alter table patients           enable row level security;
alter table patient_identities enable row level security;
alter table observations       enable row level security;
alter table referrals          enable row level security;
alter table consultations      enable row level security;
alter table appointments       enable row level security;
alter table home_visit_tasks   enable row level security;
alter table patient_notes      enable row level security;
alter table push_subscriptions enable row level security;
alter table notifications      enable row level security;
alter table audit_log          enable row level security;

create policy puroks_read on puroks for select to authenticated using (true);

-- Staff names are visible (clinician pickers); patient accounts are visible only to themselves/admin
create policy profiles_read on profiles for select to authenticated
  using (user_id = auth.uid() or role <> 'patient' or auth_role() = 'administrator');

-- Patients: ID, initials, purok and flags (NO names). BHW sees all rows, names only via patient_identities.
create policy patients_read on patients for select to authenticated
  using (
    (auth_role() in ('bhw','psychiatrist') and not is_archived)
    or auth_role() = 'administrator'
    or (auth_role() = 'patient' and user_id = auth.uid())
  );
create policy patients_update_proxy on patients for update to authenticated
  using (auth_role() in ('bhw','administrator') and can_access_patient(patient_id) or auth_role() = 'administrator')
  with check (true);

-- Identity (full name): psychiatrist, BHW of the same purok or proxy BHW, patient themselves. Not admin/coordinator.
create policy identities_read on patient_identities for select to authenticated
  using (can_see_identity(patient_id));

create policy observations_read on observations for select to authenticated
  using (auth_role() in ('bhw','psychiatrist') and can_access_patient(patient_id));
create policy observations_insert on observations for insert to authenticated
  with check (auth_role() in ('bhw','psychiatrist') and can_access_patient(patient_id) and recorded_by = auth.uid());

create policy referrals_read on referrals for select to authenticated
  using (auth_role() in ('bhw','psychiatrist') and can_access_patient(patient_id));
create policy referrals_insert on referrals for insert to authenticated
  with check (auth_role() in ('bhw','psychiatrist') and can_access_patient(patient_id) and referred_by = auth.uid());

-- Consultation notes: psychiatrist only (BHWs use the consultation_plans view)
create policy consultations_read on consultations for select to authenticated
  using (auth_role() = 'psychiatrist');
create policy consultations_insert on consultations for insert to authenticated
  with check (auth_role() = 'psychiatrist' and psychiatrist_id = auth.uid());

create policy appointments_read on appointments for select to authenticated
  using (auth_role() in ('bhw','psychiatrist','patient') and can_access_patient(patient_id));
create policy appointments_insert on appointments for insert to authenticated
  with check (auth_role() in ('bhw','psychiatrist') and can_access_patient(patient_id));
create policy appointments_update on appointments for update to authenticated
  using (auth_role() = 'psychiatrist') with check (auth_role() = 'psychiatrist');

-- Home-visit tasks are created by the scheduler; the assigned BHW completes them
create policy tasks_read on home_visit_tasks for select to authenticated
  using ((auth_role() = 'bhw' and assigned_bhw = auth.uid()) or auth_role() = 'psychiatrist');
create policy tasks_update on home_visit_tasks for update to authenticated
  using (auth_role() = 'bhw' and assigned_bhw = auth.uid())
  with check (auth_role() = 'bhw' and assigned_bhw = auth.uid());

create policy notes_read on patient_notes for select to authenticated
  using (auth_role() in ('bhw','psychiatrist') and can_access_patient(patient_id));
create policy notes_insert on patient_notes for insert to authenticated
  with check (auth_role() in ('bhw','psychiatrist') and can_access_patient(patient_id) and author_id = auth.uid());

-- Push subscriptions: each user manages only their own device(s)
create policy subs_own_read   on push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy subs_own_insert on push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy subs_own_delete on push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- Notifications: a BHW can read the ones they sent (the Express server writes them with the service key)
create policy notifications_read on notifications for select to authenticated
  using (sent_by = auth.uid() or (auth_role() = 'bhw' and can_access_patient(patient_id)));

-- Audit log: administrator reads; nobody edits or deletes
create policy audit_admin_read on audit_log for select to authenticated
  using (auth_role() = 'administrator');
