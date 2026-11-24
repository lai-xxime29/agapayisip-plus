-- 07: Privacy consent record + account lockout (5 wrong tries = locked 15 minutes).
-- Run once in the Supabase SQL Editor (safe to run again).

-- ---------- Consent ----------
alter table profiles add column if not exists consent_at timestamptz;

create or replace function accept_privacy_notice()
returns void language plpgsql security definer set search_path = public as $$
begin
  update profiles set consent_at = now() where user_id = auth.uid() and consent_at is null;
  if found then perform log_audit('privacy_consent', 'user', auth.uid()::text); end if;
end $$;

revoke execute on function accept_privacy_notice() from public, anon;
grant  execute on function accept_privacy_notice() to authenticated;

-- ---------- Lockout ----------
create table if not exists login_attempts (
  username       text primary key,
  failed_count   int not null default 0,
  last_failed_at timestamptz,
  locked_until   timestamptz
);
alter table login_attempts enable row level security;   -- no policies: only the functions below touch it
revoke all on login_attempts from anon, authenticated;

-- Seconds left on a lock (0 = not locked)
create or replace function login_lock_seconds(p_username text)
returns int language sql security definer set search_path = public as $$
  select coalesce((select greatest(0, ceil(extract(epoch from (locked_until - now())))::int)
                   from login_attempts where username = lower(trim(p_username))), 0)
$$;

-- Called after a wrong password. Returns seconds locked (0 = not locked yet).
create or replace function record_login_failure(p_username text)
returns int language plpgsql security definer set search_path = public as $$
declare u text := lower(trim(p_username)); r login_attempts; n int;
begin
  if not exists (select 1 from profiles where username = u) then return 0; end if;  -- ignore made-up usernames
  insert into login_attempts(username) values (u) on conflict do nothing;
  select * into r from login_attempts where username = u for update;
  if r.last_failed_at is null or r.last_failed_at < now() - interval '15 minutes' then n := 1; else n := r.failed_count + 1; end if;
  if n >= 5 then
    update login_attempts set failed_count = 0, last_failed_at = now(), locked_until = now() + interval '15 minutes' where username = u;
    insert into audit_log(action, entity, entity_id) values ('account_locked', 'user', u);
    return 900;
  end if;
  update login_attempts set failed_count = n, last_failed_at = now() where username = u;
  return 0;
end $$;

-- Called after a successful sign-in
create or replace function clear_login_failures(p_username text)
returns void language sql security definer set search_path = public as $$
  delete from login_attempts where username = lower(trim(p_username))
$$;

revoke execute on function login_lock_seconds(text), record_login_failure(text), clear_login_failures(text) from public;
grant  execute on function login_lock_seconds(text), record_login_failure(text) to anon, authenticated;
grant  execute on function clear_login_failures(text) to authenticated;
