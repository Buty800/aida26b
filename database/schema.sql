-- Consolidated schema — tracks the final state after all migrations.
-- Non-destructive: uses IF NOT EXISTS everywhere, never drops data.
-- Run as the database owner (aida26_user in Docker dev).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS auth;

-- ============================================================
-- Enums (conditionally created)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status') THEN
    CREATE TYPE status AS ENUM ('invited', 'active', 'left');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'friend_request') THEN
    CREATE TYPE friend_request AS ENUM ('pending_from_lower', 'pending_from_higher', 'accepted', 'rejected');
  END IF;
END$$;

-- ============================================================
-- Public (tracker) tables
-- ============================================================
CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    displayname VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS friends (
    friend1 VARCHAR(80) NOT NULL,
    friend2 VARCHAR(80) NOT NULL,
    request friend_request NOT NULL,
    CONSTRAINT pk_friends PRIMARY KEY (friend1, friend2),
    CONSTRAINT chk_friend_order CHECK (friend1 < friend2)
);

CREATE TABLE IF NOT EXISTS user_group (
    id_relation SERIAL PRIMARY KEY,
    user_id VARCHAR(80) NOT NULL,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    role VARCHAR(50) NOT NULL,
    status status NOT NULL,
    CONSTRAINT uq_user_group UNIQUE (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS track (
    title VARCHAR(255) NOT NULL,
    body TEXT,
    "group" INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("group", title)
);

CREATE TABLE IF NOT EXISTS log (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(80) NOT NULL,
    track_group INTEGER NOT NULL,
    track_title VARCHAR(255) NOT NULL,
    value INTEGER NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT NOW(),
    commentar VARCHAR(255),
    CONSTRAINT log_track_fkey FOREIGN KEY (track_group, track_title) REFERENCES track("group", title) ON DELETE CASCADE
);

-- ============================================================
-- Auth tables
-- ============================================================
CREATE TABLE IF NOT EXISTS auth.users (
    username VARCHAR(80) PRIMARY KEY,
    displayname VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'editor', 'reader')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    must_change_password BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.sessions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id VARCHAR(80) NOT NULL REFERENCES auth.users(username) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id VARCHAR(80) REFERENCES auth.users(username) ON DELETE SET NULL,
    event_type VARCHAR(80) NOT NULL,
    outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('success', 'failure', 'denied')),
    ip TEXT,
    user_agent TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Cross-schema foreign keys (conditionally added)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_friends_friend1') THEN
    ALTER TABLE friends ADD CONSTRAINT fk_friends_friend1 FOREIGN KEY (friend1) REFERENCES auth.users(username) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_friends_friend2') THEN
    ALTER TABLE friends ADD CONSTRAINT fk_friends_friend2 FOREIGN KEY (friend2) REFERENCES auth.users(username) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ug_user') THEN
    ALTER TABLE user_group ADD CONSTRAINT fk_ug_user FOREIGN KEY (user_id) REFERENCES auth.users(username) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_log_user') THEN
    ALTER TABLE log ADD CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES auth.users(username) ON DELETE CASCADE;
  END IF;
END$$;

-- ============================================================
-- Application-level DB roles
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aida_admin') THEN
    CREATE ROLE aida_admin;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aida_auth') THEN
    CREATE ROLE aida_auth;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_user') THEN
    CREATE USER admin_user WITH LOGIN PASSWORD 'AdminPass123!';
    GRANT aida_admin TO admin_user;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auth_user') THEN
    CREATE USER auth_user  WITH LOGIN PASSWORD 'AuthPass123!';
    GRANT aida_auth  TO auth_user;
  END IF;
END$$;

-- ============================================================
-- Grants (idempotent — re-granting is safe)
-- ============================================================
GRANT USAGE   ON SCHEMA public TO aida26_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aida26_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aida26_user;

GRANT USAGE   ON SCHEMA auth TO aida26_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.users TO aida26_user;

GRANT USAGE   ON SCHEMA public TO aida_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aida_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aida_admin;

GRANT USAGE ON SCHEMA auth TO aida_admin;
GRANT SELECT (username, displayname, email, role, is_active, created_at, updated_at) ON auth.users TO aida_admin;
GRANT UPDATE (displayname, email, role, is_active) ON auth.users TO aida_admin;
GRANT DELETE ON auth.users TO aida_admin;

GRANT USAGE   ON SCHEMA auth TO aida_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO aida_auth;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO aida_auth;

ALTER DEFAULT PRIVILEGES FOR ROLE aida26_user IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aida_admin, aida26_user;
ALTER DEFAULT PRIVILEGES FOR ROLE aida26_user IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO aida_admin, aida26_user;

ALTER DEFAULT PRIVILEGES FOR ROLE aida26_user IN SCHEMA auth
  GRANT ALL PRIVILEGES ON TABLES TO aida_auth;
ALTER DEFAULT PRIVILEGES FOR ROLE aida26_user IN SCHEMA auth
  GRANT ALL PRIVILEGES ON SEQUENCES TO aida_auth;

-- ============================================================
-- View for admin CRUD (safe — excludes password columns)
-- ============================================================
CREATE OR REPLACE VIEW public.auth_users AS
SELECT username, displayname, email, role, is_active, created_at, updated_at
  FROM auth.users;

GRANT SELECT, UPDATE, DELETE ON public.auth_users TO aida_admin;

CREATE OR REPLACE FUNCTION auth.reject_auth_users_insert() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Use the "Add system user" form to create users instead of the generic CRUD add button.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reject_insert ON public.auth_users;
CREATE TRIGGER trg_reject_insert
  INSTEAD OF INSERT ON public.auth_users
  FOR EACH ROW EXECUTE FUNCTION auth.reject_auth_users_insert();
