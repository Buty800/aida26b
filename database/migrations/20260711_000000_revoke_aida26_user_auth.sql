-- Restrict aida26_user's auth schema access to auth.users only.
-- The broad grants from 20260617_000000_tracker_schema.sql gave
-- aida26_user full access to auth.sessions and auth.audit_log,
-- which is unnecessary. Keep auth.users (needed by seed scripts)
-- but revoke the sensitive tables.

REVOKE ALL PRIVILEGES ON auth.sessions  FROM aida26_user;
REVOKE ALL PRIVILEGES ON auth.audit_log FROM aida26_user;
