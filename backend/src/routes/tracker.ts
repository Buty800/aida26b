import express from 'express';
import { Pool } from 'pg';
import * as auth from '../auth';
import { validateFullObject, sendErrorsIfInvalid } from '../validation/validate';

export function registerTrackerRoutes(
  app: express.Express,
  pool: Pool,
  requireAuth: express.RequestHandler,
  requirePasswordReady: express.RequestHandler
) {
  // POST /api/auth/register
  app.post('/api/auth/register', async (req, res) => {
    // Summary: Registers a new standard user in both auth.users and public.users tables inside a transaction.
  
    const username =
      typeof req.body.username === 'string'
        ? req.body.username.trim()
        : '';

    const displayname =
      typeof req.body.displayname === 'string'
        ? req.body.displayname.trim()
        : '';

    const password =
      typeof req.body.password === 'string'
        ? req.body.password
        : '';

    // Validate input
    if (!/^[A-Za-z0-9_]+$/.test(username)) {
      return res.status(400).json({
        error: 'Username may only contain letters, numbers and underscores.',
      });
    }

    if (!displayname) {
      return res.status(400).json({
        error: 'Display name is required.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must contain at least 8 characters.',
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check username in auth.users
      const authExists = await client.query(
        'SELECT 1 FROM auth.users WHERE username = $1',
        [username]
      );

      if (authExists.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'Username already exists.',
        });
      }

      // Check username in public.users
      const publicExists = await client.query(
        'SELECT 1 FROM public.users WHERE username = $1',
        [username]
      );

      if (publicExists.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'Username already exists.',
        });
      }

      // Hashes
      const { passwordHash, passwordSalt } =
        await auth.hashPassword(password);

      const trackerPassword =
        await auth.hashPasswordForUsersTable(password);

      // Insert into auth.users
      await client.query(
        `INSERT INTO auth.users
          (
            username,
            email,
            password_hash,
            password_salt,
            role,
            is_active,
            must_change_password
          )
        VALUES
          ($1, NULL, $2, $3, 'editor', true, false)`,
        [
          username,
          passwordHash,
          passwordSalt,
        ]
      );

      // Insert into public.users
      await client.query(
        `INSERT INTO public.users
          (
            username,
            displayname,
            password
          )
        VALUES
          ($1, $2, $3)`,
        [
          username,
          displayname,
          trackerPassword,
        ]
      );

      await client.query('COMMIT');

      return res.status(201).json({
        user: {
          username,
          displayname,
          role: 'editor',
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      return res.status(500).json({
        error: 'Internal server error',
      });
    } finally {
      client.release();
    }
  });

  // GET /api/tracker/users
  app.get('/api/tracker/users', requireAuth, requirePasswordReady, async (req, res) => {
    // Summary: Retrieves all registered users from the public.users table sorted alphabetically.
    try {
      const result = await pool.query(
        'SELECT username, displayname FROM users ORDER BY username ASC'
      );
      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      console.error('Error fetching tracker users:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/tracker/groups
  app.get('/api/tracker/groups', requireAuth, requirePasswordReady, async (req, res) => {
    // Summary: Fetches groups the logged-in user actively belongs to, including their role in each group.
    const currentUser = (req as any).user;
    try {
      const result = await pool.query(
        `SELECT g.id, g.displayname, g.description, g.created_at, ug.role
         FROM groups g
         JOIN user_group ug ON g.id = ug.group_id
         WHERE ug.user_id = $1 AND ug.status = 'active'
         ORDER BY g.created_at DESC`,
        [currentUser.username]
      );
      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      console.error('Error fetching tracker groups:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/tracker/groups
  app.post('/api/tracker/groups', requireAuth, requirePasswordReady, async (req, res) => {
    // Summary: Creates a new group and designates the creator as the group administrator.
    const validated = validateFullObject('groups', req.body);
    if (sendErrorsIfInvalid(res, validated)) {
      return;
    }

    const { displayname, description } = validated.data;
    const currentUser = (req as any).user;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const groupResult = await client.query(
        `INSERT INTO groups (displayname, description)
         VALUES ($1, $2)
         RETURNING *`,
        [displayname, description]
      );

      const group = groupResult.rows[0];

      await client.query(
        `INSERT INTO user_group (user_id, group_id, role, status)
         VALUES ($1, $2, 'admin', 'active')`,
        [currentUser.username, group.id]
      );

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        data: group,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating group:', error);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  });

  // POST /api/tracker/groups/:groupId/invite
  app.post('/api/tracker/groups/:groupId/invite', requireAuth, requirePasswordReady, async (req, res) => {
    // Summary: Invites a user to a group, requiring that the requester is a group administrator.
    const { groupId } = req.params;
    const { username } = req.body;
    const currentUser = (req as any).user;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    try {
      // 1. Permission Check: Verify that the current user is a group administrator
      const permCheck = await pool.query(
        `SELECT 1 FROM user_group 
         WHERE user_id = $1 AND group_id = $2 AND role = 'admin' AND status = 'active'`,
        [currentUser.username, groupId]
      );

      if (permCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Only group administrators can send invitations' });
      }

      // 2. Verify target user exists in public.users
      const userCheck = await pool.query(
        'SELECT 1 FROM users WHERE username = $1',
        [username]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Target user not found' });
      }

      // 3. Verify target user is not already a member or invited to the group
      const membershipCheck = await pool.query(
        'SELECT 1 FROM user_group WHERE user_id = $1 AND group_id = $2',
        [username, groupId]
      );

      if (membershipCheck.rows.length > 0) {
        return res.status(409).json({ error: 'User is already a member or has a pending invitation' });
      }

      // 4. Insert user_group record with status = 'invited' and role = 'member'
      await pool.query(
        `INSERT INTO user_group (user_id, group_id, role, status)
         VALUES ($1, $2, 'member', 'invited')`,
        [username, groupId]
      );

      return res.json({
        success: true,
        message: `Successfully invited user ${username} to group ${groupId}`
      });
    } catch (error) {
      console.error('Error inviting user to group:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/tracker/groups/:groupId/invite/respond
  app.post('/api/tracker/groups/:groupId/invite/respond', requireAuth, requirePasswordReady, async (req, res) => {
    // Summary: Accepts or rejects a group invitation for the logged-in user.
    const { groupId } = req.params;
    const { action } = req.body;
    const currentUser = (req as any).user;

    if (action !== 'accepted' && action !== 'rejected') {
      return res.status(400).json({ error: "Action must be 'accepted' or 'rejected'" });
    }

    try {
      // 1. Permission Check: Verify that current user is invited (status = 'invited' in user_group)
      const inviteCheck = await pool.query(
        `SELECT 1 FROM user_group 
         WHERE user_id = $1 AND group_id = $2 AND status = 'invited'`,
        [currentUser.username, groupId]
      );

      if (inviteCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      if (action === 'accepted') {
        // 2. If body action is 'accepted': Update status = 'active'
        await pool.query(
          `UPDATE user_group SET status = 'active'
           WHERE user_id = $1 AND group_id = $2`,
          [currentUser.username, groupId]
        );
      } else {
        // 3. If body action is 'rejected': Delete user_group record
        await pool.query(
          `DELETE FROM user_group
           WHERE user_id = $1 AND group_id = $2`,
          [currentUser.username, groupId]
        );
      }

      return res.json({
        success: true,
        message: `Successfully ${action} group invitation`
      });
    } catch (error) {
      console.error('Error responding to invitation:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/tracker/groups/:groupId/members
  app.get('/api/tracker/groups/:groupId/members', requireAuth, requirePasswordReady, async (req, res) => {
    // Summary: Retrieves the list of members in a group, requiring that the requester is an active member of the group.
    const { groupId } = req.params;
    const currentUser = (req as any).user;

    try {
      // 1. Permission Check: Verify current user is an active member of this group
      const membershipCheck = await pool.query(
        `SELECT 1 FROM user_group 
         WHERE user_id = $1 AND group_id = $2 AND status = 'active'`,
        [currentUser.username, groupId]
      );

      if (membershipCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Must be an active member of the group to view members' });
      }

      // 2. Query user_group joined with users to return user_id, displayname, role, status
      const result = await pool.query(
        `SELECT ug.user_id, u.displayname, ug.role, ug.status
         FROM user_group ug
         JOIN users u ON ug.user_id = u.username
         WHERE ug.group_id = $1
         ORDER BY ug.user_id ASC`,
        [groupId]
      );

      return res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error fetching group members:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/tracker/groups/:groupId/activities
  app.get('/api/tracker/groups/:groupId/activities', requireAuth, requirePasswordReady, async (req, res) => {
    // Summary: Retrieves the list of active activities (tracks) in a group, requiring active group membership.
    const { groupId } = req.params;
    const currentUser = (req as any).user;

    try {
      // 1. Permission Check: Verify current user is an active group member
      const memberCheck = await pool.query(
        `SELECT 1 FROM user_group 
         WHERE user_id = $1 AND group_id = $2 AND status = 'active'`,
        [currentUser.username, groupId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Must be an active member of the group to view activities' });
      }

      // 2. Select track rows where group = groupId
      const result = await pool.query(
        `SELECT id, title, body, "group", status, created_at 
         FROM track 
         WHERE "group" = $1 
         ORDER BY created_at DESC`,
        [groupId]
      );

      return res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error fetching group activities:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/tracker/groups/:groupId/activities
  app.post('/api/tracker/groups/:groupId/activities', requireAuth, requirePasswordReady, async (req, res) => {
    // Summary: Creates a new activity in a group, requiring that the requester is a group administrator.
    const { groupId } = req.params;
    const currentUser = (req as any).user;

    try {
      // 1. Permission Check: Verify that current user is a group administrator (role = 'admin' and status = 'active')
      const adminCheck = await pool.query(
        `SELECT 1 FROM user_group 
         WHERE user_id = $1 AND group_id = $2 AND role = 'admin' AND status = 'active'`,
        [currentUser.username, groupId]
      );

      if (adminCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Only group administrators can create activities' });
      }

      // 2. Validate request body against track schema via SSOT structure.
      // We set the group property in req.body to match the groupId parameter
      req.body.group = groupId;

      const validated = validateFullObject('track', req.body);
      if (sendErrorsIfInvalid(res, validated)) {
        return;
      }

      const { title, body, status } = validated.data;

      // 3. Insert row into track table
      const result = await pool.query(
        `INSERT INTO track (title, body, "group", status)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [title, body, groupId, status]
      );

      return res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error creating activity:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/tracker/activities/:activityId/records
  app.get('/api/tracker/activities/:activityId/records', requireAuth, requirePasswordReady, async (req, res) => {
    // Summary: Fetches log records for a given activity, requiring that the requester belongs to the activity's group.
    const { activityId } = req.params;
    const currentUser = (req as any).user;

    try {
      // 1. Find the group that the activity belongs to
      const trackCheck = await pool.query(
        'SELECT "group" FROM track WHERE id = $1',
        [activityId]
      );

      if (trackCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Activity not found' });
      }

      const groupId = trackCheck.rows[0].group;

      // 2. Permission Check: Verify current user is an active member of this group
      const memberCheck = await pool.query(
        `SELECT 1 FROM user_group 
         WHERE user_id = $1 AND group_id = $2 AND status = 'active'`,
        [currentUser.username, groupId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: "Must be an active member of the activity's group to view records" });
      }

      // 3. Query log table joined with users (public) to return log id, user_id, displayname, value, fecha, commentar
      const result = await pool.query(
        `SELECT l.id, l.user_id, u.displayname, l.value, l.fecha, l.commentar
         FROM log l
         JOIN users u ON l.user_id = u.username
         WHERE l.track = $1
         ORDER BY l.fecha DESC, l.id DESC`,
        [activityId]
      );

      return res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error fetching activity records:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/tracker/activities/:activityId/records
  app.post('/api/tracker/activities/:activityId/records', requireAuth, requirePasswordReady, async (req, res) => {
    // Summary: Logs a record entry for an activity, requiring that the requester belongs to the activity's group.
    const { activityId } = req.params;
    const currentUser = (req as any).user;

    try {
      // 1. Find the group that the activity belongs to
      const trackCheck = await pool.query(
        'SELECT "group" FROM track WHERE id = $1',
        [activityId]
      );

      if (trackCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Activity not found' });
      }

      const groupId = trackCheck.rows[0].group;

      // 2. Permission Check: Verify current user is an active member of this group
      const memberCheck = await pool.query(
        `SELECT 1 FROM user_group 
         WHERE user_id = $1 AND group_id = $2 AND status = 'active'`,
        [currentUser.username, groupId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: "Must be an active member of the activity's group to log entries" });
      }

      // 3. Validate request body against log schema via SSOT
      req.body.user_id = currentUser.username;
      req.body.track = Number(activityId);

      const validated = validateFullObject('log', req.body);
      if (sendErrorsIfInvalid(res, validated)) {
        return;
      }

      const { user_id, track, value, fecha, commentar } = validated.data;

      // 4. Insert row into log table
      const result = await pool.query(
        `INSERT INTO log (user_id, track, value, fecha, commentar)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [user_id, track, value, fecha, commentar]
      );

      return res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error logging activity record:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/tracker/activities/:activityId/comparisons
  app.get('/api/tracker/activities/:activityId/comparisons', requireAuth, requirePasswordReady, async (req, res) => {
    // Summary: Compares the total logged progress (sum of values) for an activity across all active members of its group.
    const { activityId } = req.params;
    const currentUser = (req as any).user;

    try {
      // 1. Find the group that the activity belongs to
      const trackCheck = await pool.query(
        'SELECT "group" FROM track WHERE id = $1',
        [activityId]
      );

      if (trackCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Activity not found' });
      }

      const groupId = trackCheck.rows[0].group;

      // 2. Permission Check: Verify current user is an active member of this group
      const memberCheck = await pool.query(
        `SELECT 1 FROM user_group 
         WHERE user_id = $1 AND group_id = $2 AND status = 'active'`,
        [currentUser.username, groupId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: "Must be an active member of the activity's group to view comparisons" });
      }

      // 3. Query and aggregate logged values (SUM of value) for the specified activity across all active group members, grouped by user
      const result = await pool.query(
        `SELECT 
           u.username,
           u.displayname,
           COALESCE(SUM(l.value), 0)::INTEGER AS total_value
         FROM user_group ug
         JOIN users u ON ug.user_id = u.username
         LEFT JOIN log l ON l.user_id = ug.user_id AND l.track = $1
         WHERE ug.group_id = $2 AND ug.status = 'active'
         GROUP BY u.username, u.displayname
         ORDER BY total_value DESC, u.username ASC`,
        [activityId, groupId]
      );

      return res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error fetching activity comparisons:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/tracker/friends
  app.get('/api/tracker/friends', requireAuth, requirePasswordReady, async (req, res) => {
    // Summary: Fetches the lists of active friends, pending sent requests, and pending received requests.
    const currentUser = (req as any).user;

    try {
      const result = await pool.query(
        `SELECT 
           f.friend1,
           u1.displayname AS displayname1,
           f.friend2,
           u2.displayname AS displayname2,
           f.request
         FROM friends f
         JOIN users u1 ON f.friend1 = u1.username
         JOIN users u2 ON f.friend2 = u2.username
         WHERE f.friend1 = $1 OR f.friend2 = $1`,
        [currentUser.username]
      );

      const friends: any[] = [];
      const pendingSent: any[] = [];
      const pendingReceived: any[] = [];

      for (const row of result.rows) {
        if (row.request === 'accepted') {
          if (row.friend1 === currentUser.username) {
            friends.push({ username: row.friend2, displayname: row.displayname2 });
          } else {
            friends.push({ username: row.friend1, displayname: row.displayname1 });
          }
        } else if (row.request === 'pending') {
          if (row.friend1 === currentUser.username) {
            pendingSent.push({ username: row.friend2, displayname: row.displayname2 });
          } else {
            pendingReceived.push({ username: row.friend1, displayname: row.displayname1 });
          }
        }
      }

      return res.json({
        success: true,
        data: {
          friends,
          pendingSent,
          pendingReceived
        }
      });
    } catch (error) {
      console.error('Error fetching tracker friends:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/tracker/friends/request
  app.post('/api/tracker/friends/request', requireAuth, requirePasswordReady, async (req, res) => {
    // Summary: Sends a friend request to another user, creating a pending relationship.
    const { username } = req.body;
    const currentUser = (req as any).user;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (username === currentUser.username) {
      return res.status(400).json({ error: 'Cannot send a friend request to yourself' });
    }

    try {
      // 1. Ensure target user exists in public.users
      const userCheck = await pool.query(
        'SELECT 1 FROM users WHERE username = $1',
        [username]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Target user not found' });
      }

      // 2. Arrange names so friend1 < friend2 constraint is met
      const friend1 = currentUser.username < username ? currentUser.username : username;
      const friend2 = currentUser.username < username ? username : currentUser.username;

      // Check if relationship already exists
      const relCheck = await pool.query(
        'SELECT request FROM friends WHERE friend1 = $1 AND friend2 = $2',
        [friend1, friend2]
      );

      if (relCheck.rows.length > 0) {
        return res.status(409).json({ error: 'A friend relationship or pending request already exists' });
      }

      // 3. Insert row in friends table with request = 'pending'
      await pool.query(
        `INSERT INTO friends (friend1, friend2, request)
         VALUES ($1, $2, 'pending')`,
        [friend1, friend2]
      );

      return res.json({
        success: true,
        message: `Friend request sent to ${username}`
      });
    } catch (error) {
      console.error('Error sending friend request:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/tracker/friends/respond
  app.post('/api/tracker/friends/respond', requireAuth, requirePasswordReady, async (req, res) => {
    // Summary: Responds to a friend request (accepts or rejects it).
    const { username, action } = req.body;
    const currentUser = (req as any).user;

    if (!username || !action) {
      return res.status(400).json({ error: 'Username and action are required' });
    }

    if (action !== 'accepted' && action !== 'rejected') {
      return res.status(400).json({ error: "Action must be 'accepted' or 'rejected'" });
    }

    try {
      // 1. Arrange names so friend1 < friend2 constraint is met
      const friend1 = currentUser.username < username ? currentUser.username : username;
      const friend2 = currentUser.username < username ? username : currentUser.username;

      // Verify relationship exists and is pending
      const relCheck = await pool.query(
        'SELECT request FROM friends WHERE friend1 = $1 AND friend2 = $2',
        [friend1, friend2]
      );

      if (relCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Friend request not found' });
      }

      if (relCheck.rows[0].request !== 'pending') {
        return res.status(400).json({ error: 'Friend request is not pending' });
      }

      if (action === 'accepted') {
        // 2. If action = 'accepted': Update request = 'accepted'
        await pool.query(
          `UPDATE friends SET request = 'accepted'
           WHERE friend1 = $1 AND friend2 = $2`,
          [friend1, friend2]
        );
      } else {
        // 3. If action = 'rejected': Delete relationship row
        await pool.query(
          `DELETE FROM friends
           WHERE friend1 = $1 AND friend2 = $2`,
          [friend1, friend2]
        );
      }

      return res.json({
        success: true,
        message: `Successfully ${action} friend request from ${username}`
      });
    } catch (error) {
      console.error('Error responding to friend request:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/tracker/logs
  app.get('/api/tracker/logs', requireAuth, requirePasswordReady, async (req, res) => {
    // Summary: Retrieves the last 50 activity log entries for the logged-in user across all activities and groups.
    const currentUser = (req as any).user;

    try {
      const result = await pool.query(
        `SELECT l.id, t.title AS activity_title, g.displayname AS group_name, l.value, l.fecha, l.commentar
         FROM log l
         JOIN track t ON l.track = t.id
         JOIN groups g ON t.group = g.id
         WHERE l.user_id = $1
         ORDER BY l.fecha DESC, l.id DESC
         LIMIT 50`,
        [currentUser.username]
      );

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      console.error('Error fetching tracker logs:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
}
