-- AgapayIsip+ | 04_first_admin.sql
-- Run FOURTH, once. Creates the profile for your first Administrator.
--
-- STEP A (in the dashboard, not SQL): Authentication > Users > "Add user" > "Create new user"
--    Email:    admin@agapayisip.local      (the app maps username -> username@agapayisip.local)
--    Password: choose a strong one
--    Tick "Auto Confirm User"
-- STEP B: run the statement below.

insert into profiles (user_id, username, full_name, role, purok_assigned)
select id, 'admin', 'System Administrator', 'administrator', null
from auth.users
where email = 'admin@agapayisip.local';

-- Check it worked:
-- select username, role, status from profiles;
