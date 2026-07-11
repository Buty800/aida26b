-- Remove the overly restrictive UNIQUE on friend1.
-- The composite PK (friend1, friend2) already ensures no duplicate pairs.
ALTER TABLE friends DROP CONSTRAINT IF EXISTS friends_friend1_key;

-- Replace the friend_request enum with directional pending values
-- so we can tell which user initiated the request.
CREATE TYPE friend_request_new AS ENUM ('pending_from_lower', 'pending_from_higher', 'accepted', 'rejected');

-- Migrate existing rows: 'pending' → 'pending_from_lower' (legacy assumption)
ALTER TABLE friends
  ALTER COLUMN request TYPE friend_request_new
  USING (
    CASE request::text
      WHEN 'pending'   THEN 'pending_from_lower'::friend_request_new
      WHEN 'accepted'  THEN 'accepted'::friend_request_new
      WHEN 'rejected'  THEN 'rejected'::friend_request_new
    END
  );

DROP TYPE friend_request;

ALTER TYPE friend_request_new RENAME TO friend_request;
