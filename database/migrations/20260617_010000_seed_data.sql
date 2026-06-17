-- Seed data migration for Tracker application

SET client_encoding = 'UTF8';

-- Clean up existing data to avoid conflicts
DELETE FROM log;
DELETE FROM track;
DELETE FROM user_group;
DELETE FROM friends;
DELETE FROM groups;
DELETE FROM users;

-- Insert users
INSERT INTO users (username, displayname, password, created_at) VALUES
('alice', 'Alice Smith', 'pbkdf2:sha256:password_hashed_val1', NOW() - INTERVAL '10 days'),
('bob', 'Bob Johnson', 'pbkdf2:sha256:password_hashed_val2', NOW() - INTERVAL '9 days'),
('charlie', 'Charlie Brown', 'pbkdf2:sha256:password_hashed_val3', NOW() - INTERVAL '8 days'),
('diana', 'Diana Prince', 'pbkdf2:sha256:password_hashed_val4', NOW() - INTERVAL '7 days');

-- Insert friends (avoid symmetric duplicates using friend1 < friend2, keeping friend1 unique as per schema)
INSERT INTO friends (friend1, friend2, request) VALUES
('alice', 'bob', 'accepted'),
('bob', 'diana', 'accepted'),
('charlie', 'diana', 'pending');

-- Insert groups
INSERT INTO groups (id, displayname, description, created_at) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Exactas Runners', 'Group for running enthusiasts at Exactas', NOW() - INTERVAL '6 days'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'UBA Coding Club', 'Study group for programming courses', NOW() - INTERVAL '5 days');

-- Insert user_group memberships
INSERT INTO user_group (id_relation, user_id, group_id, role, status, created_at) VALUES
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'alice', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'admin', 'active', NOW() - INTERVAL '6 days'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'bob', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'member', 'active', NOW() - INTERVAL '5 days'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'alice', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'member', 'active', NOW() - INTERVAL '4 days'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66', 'charlie', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'admin', 'active', NOW() - INTERVAL '4 days'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a77', 'diana', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'member', 'invited', NOW() - INTERVAL '2 days');

-- Insert track activities
INSERT INTO track (id, title, body, "group", status, created_at) VALUES
(1, 'Morning 5k', 'Run 5 kilometers around the campus', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'active', NOW() - INTERVAL '3 days'),
(2, 'Solve 3 LeetCode Mediums', 'Solve problems regarding dynamic programming', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'active', NOW() - INTERVAL '2 days');

-- Insert log entries
INSERT INTO log (id, user_id, track, value, fecha, commentar) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a88', 'alice', 1, 25, NOW() - INTERVAL '1 day', 'Finished in 25 minutes!'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99', 'bob', 1, 28, NOW() - INTERVAL '12 hours', 'A bit tired today but did it'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380aaa', 'charlie', 2, 3, NOW() - INTERVAL '4 hours', 'Hard DP problems today');

-- Reset the track serial sequence so manual IDs don't conflict with future auto-increment operations
SELECT setval(pg_get_serial_sequence('track', 'id'), COALESCE(MAX(id), 1)) FROM track;
