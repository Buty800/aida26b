import express from 'express';
import { Pool } from 'pg';

export function registerTrackerRoutes(
  app: express.Express,
  pool: Pool,
  requireAuth: express.RequestHandler,
  requirePasswordReady: express.RequestHandler
) {
  // POST /api/auth/register
  app.post('/api/auth/register', async (req, res) => {
    // Boilerplate stub
    // TODO: Implement user registration
    // 1. Validate request body (username, displayname, password)
    //    - Ensure username is a non-empty string and has no special characters.
    //    - Ensure displayname is a non-empty string.
    //    - Ensure password is at least 8 characters.
    // 2. Check if username already exists in auth.users or public.users
    //    - If exists, return 409 Conflict.
    // 3. Hash passwords for both auth.users and public.users:
    //    - auth.users table uses password_hash and password_salt from auth.hashPassword().
    //    - public.users table uses scrypt$ format from auth.hashPasswordForUsersTable().
    // 4. Perform atomic inserts inside a transaction.
    //    - In auth.users: set role = 'editor', is_active = true, must_change_password = false.
    //    - In public.users: insert username, displayname, and hashed password.
    // 5. Return success status code 201 with created user details.
    return res.status(201).json({
      success: true,
      message: 'Registration boilerplate stub: User registered successfully (not persistent)',
      user: { username: req.body.username || 'dummy_user', role: 'editor' }
    });
  });

  // GET /api/tracker/users
  app.get('/api/tracker/users', requireAuth, requirePasswordReady, async (req, res) => {
    // Boilerplate stub
    // TODO: Fetch all registered users from public.users (username, displayname) to allow user search for invites/friends
    return res.json({
      success: true,
      data: [
        { username: 'alice', displayname: 'Alice Smith' },
        { username: 'bob', displayname: 'Bob Johnson' }
      ]
    });
  });

  // GET /api/tracker/groups
  app.get('/api/tracker/groups', requireAuth, requirePasswordReady, async (req, res) => {
    // Boilerplate stub
    // TODO: Fetch groups the logged-in user belongs to (where status = 'active' in user_group table)
    // Join groups with user_group to get group id, displayname, description, created_at, and the user's role.
    const user = (req as any).user;
    return res.json({
      success: true,
      data: [
        { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', displayname: 'Exactas Runners (Stub)', description: 'Running group stub', role: 'admin' }
      ]
    });
  });

  // POST /api/tracker/groups
  app.post('/api/tracker/groups', requireAuth, requirePasswordReady, async (req, res) => {
    // Boilerplate stub
    // TODO: Validate request body via SSOT schema.
    // 1. Insert new group row in groups table.
    // 2. Insert membership row in user_group setting current user's role = 'admin' and status = 'active'.
    // 3. Return the created group.
    return res.status(201).json({
      success: true,
      data: { id: 'dummy-group-uuid', displayname: req.body.displayname || 'New Group Stub', description: req.body.description }
    });
  });

  // POST /api/tracker/groups/:groupId/invite
  app.post('/api/tracker/groups/:groupId/invite', requireAuth, requirePasswordReady, async (req, res) => {
    // Boilerplate stub
    // TODO: Implement invitation logic
    // 1. Permission Check: Verify that the current user is a group administrator (role = 'admin' and status = 'active' in user_group).
    // 2. Verify target user exists in public.users.
    // 3. Insert user_group record with status = 'invited' and role = 'member'.
    return res.json({
      success: true,
      message: `Invitation boilerplate stub: Invited user ${req.body.username} to group ${req.params.groupId}`
    });
  });

  // POST /api/tracker/groups/:groupId/invite/respond
  app.post('/api/tracker/groups/:groupId/invite/respond', requireAuth, requirePasswordReady, async (req, res) => {
    // Boilerplate stub
    // TODO: Respond to group invite
    // 1. Permission Check: Verify that current user is invited (status = 'invited' in user_group).
    // 2. If body action is 'accepted': Update status = 'active'.
    // 3. If body action is 'rejected': Delete user_group record.
    return res.json({
      success: true,
      message: `Invite response boilerplate stub: Responded to group ${req.params.groupId} with action ${req.body.action}`
    });
  });

  // GET /api/tracker/groups/:groupId/members
  app.get('/api/tracker/groups/:groupId/members', requireAuth, requirePasswordReady, async (req, res) => {
    // Boilerplate stub
    // TODO: Implement members fetching
    // 1. Permission Check: Verify current user is an active member of this group.
    // 2. Query user_group joined with users to return user_id, displayname, role, status.
    return res.json({
      success: true,
      data: [
        { user_id: 'alice', displayname: 'Alice Smith', role: 'admin', status: 'active' }
      ]
    });
  });

  // GET /api/tracker/groups/:groupId/activities
  app.get('/api/tracker/groups/:groupId/activities', requireAuth, requirePasswordReady, async (req, res) => {
    // Boilerplate stub
    // TODO: Implement activities listing
    // 1. Permission Check: Verify current user is an active group member.
    // 2. Select track rows where group = groupId.
    return res.json({
      success: true,
      data: [
        { id: 1, title: 'Morning 5k (Stub)', body: 'Run 5km', group: req.params.groupId, status: 'active', created_at: new Date() }
      ]
    });
  });

  // POST /api/tracker/groups/:groupId/activities
  app.post('/api/tracker/groups/:groupId/activities', requireAuth, requirePasswordReady, async (req, res) => {
    // Boilerplate stub
    // TODO: Implement activity creation
    // 1. Permission Check: Verify that current user is a group administrator (role = 'admin' and status = 'active').
    // 2. Validate request body against track schema via SSOT structure.
    // 3. Insert row into track table.
    return res.status(201).json({
      success: true,
      data: { id: 99, title: req.body.title || 'New Activity Stub', body: req.body.body, group: req.params.groupId, status: 'active', created_at: new Date() }
    });
  });

  // GET /api/tracker/activities/:activityId/records
  app.get('/api/tracker/activities/:activityId/records', requireAuth, requirePasswordReady, async (req, res) => {
    // Boilerplate stub
    // TODO: Implement log entries fetching
    // 1. Permission Check: Verify current user belongs to the group of this activity.
    // 2. Query log table joined with users (public) to return log id, user_id, displayname, value, fecha, commentar.
    return res.json({
      success: true,
      data: [
        { id: 'log-uuid-stub', user_id: 'alice', displayname: 'Alice Smith', value: 25, fecha: new Date(), commentar: 'Finished! (Stub)' }
      ]
    });
  });

  // POST /api/tracker/activities/:activityId/records
  app.post('/api/tracker/activities/:activityId/records', requireAuth, requirePasswordReady, async (req, res) => {
    // Boilerplate stub
    // TODO: Implement activity logging
    // 1. Permission Check: Verify current user belongs to the group of this activity.
    // 2. Validate request body against log schema via SSOT.
    // 3. Insert row into log table with current user's username.
    return res.status(201).json({
      success: true,
      data: { id: 'new-log-uuid-stub', user_id: 'alice', track: req.params.activityId, value: req.body.value, fecha: req.body.fecha, commentar: req.body.commentar }
    });
  });

  // GET /api/tracker/activities/:activityId/comparisons
  app.get('/api/tracker/activities/:activityId/comparisons', requireAuth, requirePasswordReady, async (req, res) => {
    // Boilerplate stub
    // TODO: Implement task comparison progress
    // 1. Permission Check: Verify current user is an active member of the group this activity belongs to.
    // 2. Query and aggregate logged values (SUM of value) for the specified activity across all active group members, grouped by user.
    return res.json({
      success: true,
      data: [
        { username: 'alice', displayname: 'Alice Smith', total_value: 25 },
        { username: 'bob', displayname: 'Bob Johnson', total_value: 28 }
      ]
    });
  });

  // GET /api/tracker/friends
  app.get('/api/tracker/friends', requireAuth, requirePasswordReady, async (req, res) => {
    // Boilerplate stub
    // TODO: Fetch lists of friends
    // 1. Friends: relationships with status = 'accepted' involving current user.
    // 2. PendingSent: relationships with status = 'pending' where current user is friend1 and friend1 < friend2 or similar.
    // 3. PendingReceived: relationships with status = 'pending' where current user is friend2.
    return res.json({
      success: true,
      data: {
        friends: [{ username: 'bob', displayname: 'Bob Johnson' }],
        pendingSent: [],
        pendingReceived: []
      }
    });
  });

  // POST /api/tracker/friends/request
  app.post('/api/tracker/friends/request', requireAuth, requirePasswordReady, async (req, res) => {
    // Boilerplate stub
    // TODO: Send friend request
    // 1. Ensure target user exists in public.users.
    // 2. Arrange names so friend1 < friend2 constraint is met.
    // 3. Insert row in friends table with request = 'pending'.
    return res.json({
      success: true,
      message: `Friend request boilerplate stub: Sent request to ${req.body.username}`
    });
  });

  // POST /api/tracker/friends/respond
  app.post('/api/tracker/friends/respond', requireAuth, requirePasswordReady, async (req, res) => {
    // Boilerplate stub
    // TODO: Respond to friend request
    // 1. Arrange names so friend1 < friend2 constraint is met.
    // 2. If action = 'accepted': Update request = 'accepted'.
    // 3. If action = 'rejected': Delete relationship row.
    return res.json({
      success: true,
      message: `Friend response boilerplate stub: Responded to ${req.body.username} with action ${req.body.action}`
    });
  });

  // GET /api/tracker/logs
  app.get('/api/tracker/logs', requireAuth, requirePasswordReady, async (req, res) => {
    // Boilerplate stub
    // TODO: Fetch last 50 logs for current user across all groups and activities.
    return res.json({
      success: true,
      data: [
        { id: 'log-uuid-stub', activity_title: 'Morning 5k (Stub)', group_name: 'Exactas Runners (Stub)', value: 25, fecha: new Date(), commentar: 'Finished! (Stub)' }
      ]
    });
  });
}
