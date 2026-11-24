-- 06: Administrator account switch + Coordinator overview numbers.
-- Run once in the Supabase SQL Editor (safe to run again).

create or replace function set_user_status(p_user_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth_role() is distinct from 'administrator' then raise exception 'Only the Administrator can change accounts'; end if;
  if p_status not in ('active','inactive') then raise exception 'Invalid status'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot deactivate your own account'; end if;
  update profiles set status = p_status where user_id = p_user_id;
  if not found then raise exception 'User not found'; end if;
  perform log_audit('set_user_' || p_status, 'user', p_user_id::text);
end $$;

grant execute on function set_user_status(uuid, text) to authenticated;

-- Aggregates only (no names): used by the Coordinator and Administrator overview
create or replace view stats_overview as
  select
    (select count(*) from patients where not is_archived)                               as active_patients,
    (select count(*) from patients where risk_level = 'high' and not is_archived)       as high_risk_patients,
    (select count(*) from appointments where status = 'completed')                      as appts_completed,
    (select count(*) from appointments where status = 'missed')                         as appts_missed,
    (select count(*) from appointments where status = 'upcoming')                       as appts_upcoming,
    (select count(*) from referrals)                                                    as referrals_total,
    (select count(*) from referrals where status = 'arrived')                           as referrals_arrived,
    (select count(*) from referrals where status = 'not_arrived')                       as referrals_not_arrived,
    (select count(*) from home_visit_tasks where status = 'completed')                  as visits_completed,
    (select count(*) from home_visit_tasks where status in ('open','overdue'))          as visits_open
  where auth_role() in ('coordinator','administrator');

revoke all on stats_overview from anon, authenticated;
grant select on stats_overview to authenticated;
