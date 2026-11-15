-- AgapayIsip+ | 01_schema.sql
-- Run FIRST in Supabase: SQL Editor > New query > paste > Run
-- Tables follow SRS Section 7.1 / 7.3. Patient identity (name, birth date) is kept in a
-- separate table so row-level security can mask it (BRL-02, FR-06).

create extension if not exists pgcrypto;

-- ---------- Enums ----------
create type user_role          as enum ('bhw','psychiatrist','coordinator','administrator','patient');
create type sex_type           as enum ('female','male','other');
create type care_phase_type    as enum ('screening','actively_monitoring','stable_recovery','discharged');
create type risk_level_type    as enum ('low','moderate','high');
create type referral_status_t  as enum ('referred','arrived','not_arrived','closed');
create type urgency_type       as enum ('routine','urgent');
create type appt_status_type   as enum ('upcoming','completed','missed','reschedule_requested','rescheduled');
create type task_status_type   as enum ('open','completed','overdue');

-- ---------- Puroks (the "purok list" in the data dictionary) ----------
create table puroks (
  name text primary key
);
insert into puroks(name) values ('Purok 1'),('Purok 2'),('Purok 3'),('Purok 4'),('Purok 5'),('Purok 6'),('Purok 7');
-- Edit this list later to match the real barangay puroks.

-- ---------- Users (profile attached to Supabase Auth account) ----------
create table profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  username       text not null unique check (char_length(username) between 4 and 40),
  full_name      text not null,
  role           user_role not null,
  purok_assigned text references puroks(name),
  status         text not null default 'active' check (status in ('active','inactive')),
  created_at     timestamptz not null default now()
);

-- ---------- Patients (no names here: only ID, initials, purok, flags) ----------
create sequence patient_seq start 1;

create table patients (
  patient_id      text primary key default ('MH-' || lpad(nextval('patient_seq')::text, 4, '0')),
  client_entry_id uuid unique,                         -- makes offline uploads happen exactly once (NFR-13)
  user_id         uuid unique references profiles(user_id),  -- patient/caretaker login, if any
  initials        text not null,
  purok           text not null references puroks(name),
  has_caretaker   boolean not null,
  assigned_bhw    uuid references profiles(user_id),   -- proxy BHW
  registered_by   uuid not null references profiles(user_id) default auth.uid(),
  case_phase      care_phase_type not null default 'screening',
  risk_level      risk_level_type not null default 'low',
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint solo_patient_needs_proxy check (has_caretaker or assigned_bhw is not null)  -- BRL-01
);
create index patients_purok_idx on patients(purok);

create table patient_identities (
  patient_id        text primary key references patients(patient_id),
  full_name         text not null check (char_length(full_name) <= 120),
  birth_date        date not null check (birth_date <= current_date),
  sex               sex_type not null,
  emergency_contact text not null check (char_length(emergency_contact) <= 120)
);

-- ---------- Clinical data ----------
create table observations (
  observation_id     uuid primary key default gen_random_uuid(),  -- client may supply for offline sync
  patient_id         text not null references patients(patient_id),
  recorded_by        uuid not null references profiles(user_id) default auth.uid(),
  signs_checked      text[] not null default '{}',
  suicidal_ideation  boolean not null default false,
  self_harm_history  boolean not null default false,
  observed_at        timestamptz not null default now()
);
create index observations_patient_idx on observations(patient_id, observed_at desc);

create table referrals (
  referral_id  uuid primary key default gen_random_uuid(),
  patient_id   text not null references patients(patient_id),
  referred_by  uuid not null references profiles(user_id) default auth.uid(),
  reason       text not null,
  urgency      urgency_type not null default 'routine',
  status       referral_status_t not null default 'referred',
  referred_at  timestamptz not null default now(),
  arrived_at   timestamptz
);
create index referrals_patient_idx on referrals(patient_id);

create table consultations (
  consultation_id   uuid primary key default gen_random_uuid(),
  patient_id        text not null references patients(patient_id),
  psychiatrist_id   uuid not null references profiles(user_id) default auth.uid(),
  notes             text not null check (char_length(notes) between 1 and 5000),
  evaluation        text,
  medications_noted text check (char_length(medications_noted) <= 1000),
  care_phase        care_phase_type not null,
  follow_up_plan    text,
  consulted_at      timestamptz not null default now()
);
create index consultations_patient_idx on consultations(patient_id, consulted_at desc);

create table appointments (
  appointment_id    uuid primary key default gen_random_uuid(),
  patient_id        text not null references patients(patient_id),
  clinician_id      uuid not null references profiles(user_id),
  scheduled_at      timestamptz not null,
  status            appt_status_type not null default 'upcoming',
  reschedule_reason text check (reschedule_reason in ('no_fare','sick','work_or_school','no_companion','other')),
  preferred_date    date,
  requested_by      uuid references profiles(user_id),
  reminder_sent_at  timestamptz,                       -- set when the 24-hour reminder is sent
  created_by        uuid references profiles(user_id) default auth.uid(),
  created_at        timestamptz not null default now()
);
create index appointments_patient_idx on appointments(patient_id, scheduled_at desc);
create index appointments_status_idx  on appointments(status, scheduled_at);

create table home_visit_tasks (
  task_id        uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references appointments(appointment_id),
  patient_id     text not null references patients(patient_id),
  assigned_bhw   uuid not null references profiles(user_id),
  status         task_status_type not null default 'open',
  outcome        text check (char_length(outcome) <= 500),
  created_at     timestamptz not null default now(),
  completed_at   timestamptz,
  constraint outcome_required_on_complete check (status <> 'completed' or outcome is not null)
);
create index tasks_bhw_idx on home_visit_tasks(assigned_bhw, status);

create table patient_notes (
  note_id    uuid primary key default gen_random_uuid(),
  patient_id text not null references patients(patient_id),
  author_id  uuid not null references profiles(user_id) default auth.uid(),
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index notes_patient_idx on patient_notes(patient_id, created_at desc);

-- ---------- Push notifications ----------
create table push_subscriptions (
  subscription_id uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(user_id) default auth.uid(),
  endpoint        text not null unique check (endpoint like 'https://%'),
  keys            jsonb not null,
  created_at      timestamptz not null default now()
);

create table notifications (
  notification_id uuid primary key default gen_random_uuid(),
  subscription_id uuid references push_subscriptions(subscription_id) on delete set null,
  patient_id      text references patients(patient_id),
  appointment_id  uuid references appointments(appointment_id),
  sent_by         uuid references profiles(user_id),   -- null = automatic
  message         text not null,                       -- fixed template only (BRL-08)
  sent_at         timestamptz not null default now(),
  delivery_status text not null default 'sent'
                  check (delivery_status in ('sent','delivered','failed','no_subscription'))
);
create index notifications_patient_idx on notifications(patient_id, sent_at desc);

-- ---------- Audit log (append-only, enforced below and in 02_security.sql) ----------
create table audit_log (
  log_id     bigint generated always as identity primary key,
  user_id    uuid references profiles(user_id),
  action     text not null check (char_length(action) <= 60),
  entity     text,
  entity_id  text,
  created_at timestamptz not null default now()
);

create function block_audit_changes() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end $$;

create trigger audit_log_no_update_delete
  before update or delete on audit_log
  for each row execute function block_audit_changes();
