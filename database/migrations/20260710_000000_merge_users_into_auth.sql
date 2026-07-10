-- Merge public.users into auth.users, add displayname, rekey to username PK
-- Then drop public.users, create DB roles and column-level security.

-- 1. Add displayname to auth.users (nullable initially — populated in next step)
ALTER TABLE auth.users ADD COLUMN displayname VARCHAR(255);

-- 2. Create auth.users entries for users that only exist in public.users
--    (e.g. from the old seed-data migration) — they must change password on next login.
INSERT INTO auth.users (username, displayname, email, password_hash, password_salt, role, is_active, must_change_password)
SELECT pu.username, pu.displayname, NULL,
       'orphan$legacy', 'orphan$legacy', 'editor', true, true
  FROM public.users pu
  LEFT JOIN auth.users au ON au.username = pu.username
 WHERE au.username IS NULL;

-- 3. Migrate displayname from public.users
UPDATE auth.users u
   SET displayname = pu.displayname
  FROM public.users pu
 WHERE pu.username = u.username;

-- 4. Fallback for auth-only users (e.g. the admin) — use username as displayname
UPDATE auth.users SET displayname = username WHERE displayname IS NULL;

ALTER TABLE auth.users ALTER COLUMN displayname SET NOT NULL;

-- 4. Drop old FK constraints on auth tables referencing auth.users(id)
ALTER TABLE auth.sessions  DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE auth.audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_user_id_fkey;

-- 5. Add new VARCHAR columns to auth.sessions / auth.audit_log
ALTER TABLE auth.sessions  ADD COLUMN user_username VARCHAR(80);
ALTER TABLE auth.audit_log ADD COLUMN actor_username VARCHAR(80);

-- 6. Migrate the FK target values
UPDATE auth.sessions  s SET user_username  = u.username FROM auth.users u WHERE u.id = s.user_id;
UPDATE auth.audit_log a SET actor_username = u.username FROM auth.users u WHERE u.id = a.actor_user_id;

-- 7. Drop old BIGINT columns
ALTER TABLE auth.sessions  DROP COLUMN user_id;
ALTER TABLE auth.audit_log DROP COLUMN actor_user_id;

-- 8. Rename to original column names
ALTER TABLE auth.sessions  RENAME COLUMN user_username  TO user_id;
ALTER TABLE auth.audit_log RENAME COLUMN actor_username TO actor_user_id;

-- 9. Drop FK constraints on public tables referencing public.users(username)
ALTER TABLE friends    DROP CONSTRAINT IF EXISTS friends_friend1_fkey;
ALTER TABLE friends    DROP CONSTRAINT IF EXISTS friends_friend2_fkey;
ALTER TABLE user_group DROP CONSTRAINT IF EXISTS user_group_user_id_fkey;
ALTER TABLE log        DROP CONSTRAINT IF EXISTS log_user_id_fkey;

-- 10. Drop the old public.users table
DROP TABLE public.users CASCADE;

-- 11. Re-key auth.users: drop BIGSERIAL id, make username the PK
ALTER TABLE auth.users DROP CONSTRAINT users_pkey;
ALTER TABLE auth.users DROP COLUMN id;
ALTER TABLE auth.users ADD PRIMARY KEY (username);

-- 12. Re-add FK constraints on auth tables
ALTER TABLE auth.sessions
  ADD CONSTRAINT sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(username) ON DELETE CASCADE;

ALTER TABLE auth.audit_log
  ADD CONSTRAINT audit_log_actor_user_id_fkey
  FOREIGN KEY (actor_user_id) REFERENCES auth.users(username) ON DELETE SET NULL;

-- 13. Re-add FK constraints on public tables
ALTER TABLE friends
  ADD CONSTRAINT fk_friends_friend1
  FOREIGN KEY (friend1) REFERENCES auth.users(username) ON DELETE CASCADE;

ALTER TABLE friends
  ADD CONSTRAINT fk_friends_friend2
  FOREIGN KEY (friend2) REFERENCES auth.users(username) ON DELETE CASCADE;

ALTER TABLE user_group
  ADD CONSTRAINT fk_ug_user
  FOREIGN KEY (user_id) REFERENCES auth.users(username) ON DELETE CASCADE;

ALTER TABLE log
  ADD CONSTRAINT fk_log_user
  FOREIGN KEY (user_id) REFERENCES auth.users(username) ON DELETE CASCADE;

-- 14. Create DB roles for application-level access separation
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aida_admin') THEN
    CREATE ROLE aida_admin;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aida_auth') THEN
    CREATE ROLE aida_auth;
  END IF;
END$$;

-- Create login users that inherit from the roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_user') THEN
    CREATE USER admin_user WITH LOGIN PASSWORD 'AdminPass123!';
    GRANT aida_admin TO admin_user;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auth_user') THEN
    CREATE USER auth_user  WITH LOGIN PASSWORD 'AuthPass123!';
    GRANT aida_auth  TO auth_user;
  END IF;
END$$;

-- 15. Grant admin role: full access to public schema + safe columns of auth.users
GRANT USAGE   ON SCHEMA public TO aida_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aida_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aida_admin;

GRANT USAGE ON SCHEMA auth TO aida_admin;

-- Column-level grants for admin on auth.users (password_hash/salt/must_change_password excluded)
GRANT SELECT (username, displayname, email, role, is_active, created_at, updated_at)
  ON auth.users TO aida_admin;
GRANT UPDATE (displayname, email, role, is_active)
  ON auth.users TO aida_admin;
GRANT DELETE ON auth.users TO aida_admin;
-- INSERT is intentionally NOT granted — use the custom "Add system user" form

-- 16. Grant auth role: full access to auth schema
GRANT USAGE   ON SCHEMA auth TO aida_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO aida_auth;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO aida_auth;

-- 17. Default privileges for aida_admin on future public tables (if owner role exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aida26_owner') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE aida26_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aida_admin';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE aida26_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO aida_admin';
  END IF;
END$$;

-- 18. Create a safe VIEW of auth.users for the generic admin CRUD
CREATE OR REPLACE VIEW public.auth_users AS
SELECT username, displayname, email, role, is_active, created_at, updated_at
  FROM auth.users;

GRANT SELECT, UPDATE, DELETE ON public.auth_users TO aida_admin;

-- 19. INSTEAD OF INSERT trigger on the view (users must be created via custom form)
CREATE OR REPLACE FUNCTION auth.reject_auth_users_insert() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Use the "Add system user" form to create users instead of the generic CRUD add button.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reject_insert ON public.auth_users;
CREATE TRIGGER trg_reject_insert
  INSTEAD OF INSERT ON public.auth_users
  FOR EACH ROW EXECUTE FUNCTION auth.reject_auth_users_insert();
