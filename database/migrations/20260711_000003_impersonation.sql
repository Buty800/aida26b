-- Add impersonation support: admin can temporarily act as another user.
ALTER TABLE auth.sessions ADD COLUMN impersonating_username VARCHAR(80) REFERENCES auth.users(username) ON DELETE SET NULL;
