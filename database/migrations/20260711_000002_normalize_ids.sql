-- Normalize primary keys: groups UUID → SERIAL, track composite PK,
-- log UUID → SERIAL, user_group UUID → SERIAL.

-- ================================================================
-- Step 1: groups — UUID → SERIAL
-- ================================================================
ALTER TABLE track      DROP CONSTRAINT IF EXISTS track_group_fkey;
ALTER TABLE user_group DROP CONSTRAINT IF EXISTS user_group_group_id_fkey;

ALTER TABLE groups ADD COLUMN id_new SERIAL;

ALTER TABLE track      ADD COLUMN group_id_new INTEGER;
ALTER TABLE user_group ADD COLUMN group_id_new INTEGER;

UPDATE track t SET group_id_new = g.id_new FROM groups g WHERE g.id = t."group";
UPDATE user_group ug SET group_id_new = g.id_new FROM groups g WHERE g.id = ug.group_id;

ALTER TABLE track      DROP COLUMN "group";
ALTER TABLE track      RENAME COLUMN group_id_new TO "group";
ALTER TABLE track      ALTER COLUMN "group" SET NOT NULL;

ALTER TABLE user_group DROP COLUMN group_id;
ALTER TABLE user_group RENAME COLUMN group_id_new TO group_id;
ALTER TABLE user_group ALTER COLUMN group_id SET NOT NULL;

ALTER TABLE groups DROP COLUMN id;
ALTER TABLE groups RENAME COLUMN id_new TO id;
ALTER SEQUENCE groups_id_new_seq RENAME TO groups_id_seq;
ALTER TABLE groups ALTER COLUMN id SET DEFAULT nextval('groups_id_seq'::regclass);
ALTER TABLE groups ADD PRIMARY KEY (id);
SELECT setval('groups_id_seq', COALESCE((SELECT MAX(id) FROM groups), 1));

ALTER TABLE track      ADD CONSTRAINT track_group_fkey FOREIGN KEY ("group") REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE user_group ADD CONSTRAINT user_group_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;

-- ================================================================
-- Step 2: track — SERIAL PK → composite PK ("group", title)
--          log   — track INTEGER FK → (track_group, track_title) FK
-- ================================================================
ALTER TABLE log ADD COLUMN track_group INTEGER;
ALTER TABLE log ADD COLUMN track_title VARCHAR(255);

UPDATE log l SET
  track_group = t."group",
  track_title = t.title
FROM track t
WHERE t.id = l.track;

ALTER TABLE log DROP CONSTRAINT IF EXISTS log_track_fkey;
ALTER TABLE log DROP COLUMN track;

ALTER TABLE track DROP CONSTRAINT track_pkey;
ALTER TABLE track DROP COLUMN id;
ALTER TABLE track ADD PRIMARY KEY ("group", title);

ALTER TABLE log ALTER COLUMN track_group SET NOT NULL;
ALTER TABLE log ALTER COLUMN track_title SET NOT NULL;
ALTER TABLE log ADD CONSTRAINT log_track_fkey FOREIGN KEY (track_group, track_title) REFERENCES track("group", title) ON DELETE CASCADE;

-- ================================================================
-- Step 3: log — UUID PK → SERIAL
-- ================================================================
ALTER TABLE log ADD COLUMN id_new SERIAL;
ALTER TABLE log DROP COLUMN id;
ALTER TABLE log RENAME COLUMN id_new TO id;
ALTER SEQUENCE log_id_new_seq RENAME TO log_id_seq;
ALTER TABLE log ALTER COLUMN id SET DEFAULT nextval('log_id_seq'::regclass);
ALTER TABLE log ADD PRIMARY KEY (id);

-- ================================================================
-- Step 4: user_group — UUID PK → SERIAL
-- ================================================================
ALTER TABLE user_group ADD COLUMN id_new SERIAL;
ALTER TABLE user_group DROP COLUMN id_relation;
ALTER TABLE user_group RENAME COLUMN id_new TO id_relation;
ALTER SEQUENCE user_group_id_new_seq RENAME TO user_group_id_relation_seq;
ALTER TABLE user_group ALTER COLUMN id_relation SET DEFAULT nextval('user_group_id_relation_seq'::regclass);
ALTER TABLE user_group ADD PRIMARY KEY (id_relation);
ALTER TABLE user_group ADD CONSTRAINT uq_user_group UNIQUE (user_id, group_id);

-- Grant sequence permissions for the newly created SERIAL sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aida_admin, aida26_user;
