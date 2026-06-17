CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop old schema objects if they exist
DROP TABLE IF EXISTS enrollments, subjects, students CASCADE;
DROP TABLE IF EXISTS auth.sessions, auth.audit_log, auth.users CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;

-- Recreate schema auth
CREATE SCHEMA auth;

-- Define enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status') THEN
        CREATE TYPE status AS ENUM ('invited', 'active', 'left');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'friend_request') THEN
        CREATE TYPE friend_request AS ENUM ('pending', 'accepted', 'rejected');
    END IF;
END$$;

-- Create tables
CREATE TABLE users (
    username VARCHAR(80) PRIMARY KEY,
    displayname VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE friends (
    friend1 VARCHAR(80) UNIQUE NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    friend2 VARCHAR(80) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    request friend_request NOT NULL,
    CONSTRAINT chk_friend_order CHECK (friend1 < friend2),
    CONSTRAINT pk_friends PRIMARY KEY (friend1, friend2)
);

CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    displayname VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE user_group (
    id_relation UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(80) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    role VARCHAR(50) NOT NULL,
    status status NOT NULL,
    CONSTRAINT uq_user_group UNIQUE (user_id, group_id)
);

CREATE TABLE track (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    "group" UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(80) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    track INTEGER NOT NULL REFERENCES track(id) ON DELETE CASCADE,
    value INTEGER NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT NOW(),
    commentar VARCHAR(255)
);

-- Recreate auth tables
CREATE TABLE auth.users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(255),
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'editor', 'reader')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    must_change_password BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auth.sessions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auth.audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id BIGINT REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type VARCHAR(80) NOT NULL,
    outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('success', 'failure', 'denied')),
    ip TEXT,
    user_agent TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Revoke and grant privileges for auth
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM PUBLIC;

GRANT USAGE ON SCHEMA auth TO aida26_user;
GRANT SELECT, UPDATE, INSERT, DELETE ON ALL TABLES IN SCHEMA auth TO aida26_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO aida26_user;

-- Set up grants for public tables as well
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aida26_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aida26_user;
