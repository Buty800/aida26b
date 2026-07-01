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
    // Summary: Retrieves all registered users from the public.users table sorted alphabetically..
    return res.json({
      success: true,
      data: [
        { id: 'log-uuid-stub', activity_title: 'Morning 5k (Stub)', group_name: 'Exactas Runners (Stub)', value: 25, fecha: new Date(), commentar: 'Finished! (Stub)' }
      ]
    });
  });
}
