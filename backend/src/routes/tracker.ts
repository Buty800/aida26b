import express from 'express';
import { Pool } from 'pg';
import * as auth from '../auth';
import { validateFullObject, sendErrorsIfInvalid } from '../validation/validate';

export function registerTrackerRoutes(
  app: express.Express,
  adminPool: Pool,   // academic tables
  authPool: Pool,    // auth.users
  requireAuth: express.RequestHandler,
  requirePasswordReady: express.RequestHandler
) {
  function asyncHandler(fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<any>): express.RequestHandler {
    return (req, res, next) => fn(req, res, next).catch((error) => {
      console.error(`Error in ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  async function isGroupMember(userId: string, groupId: string): Promise<boolean> {
    const result = await adminPool.query(
      `SELECT 1 FROM user_group WHERE user_id = $1 AND group_id = $2 AND status = 'active'`,
      [userId, groupId]
    );
    return result.rows.length > 0;
  }

  async function isGroupAdmin(userId: string, groupId: string): Promise<boolean> {
    const result = await adminPool.query(
      `SELECT 1 FROM user_group WHERE user_id = $1 AND group_id = $2 AND role = 'admin' AND status = 'active'`,
      [userId, groupId]
    );
    return result.rows.length > 0;
  }

  async function isGlobalAdmin(userId: string): Promise<boolean> {
    const result = await adminPool.query(
      `SELECT 1 FROM auth.users WHERE username = $1 AND role = 'admin'`,
      [userId]
    );
    return result.rows.length > 0;
  }

  // POST /api/auth/register
  app.post('/api/auth/register', async (req, res) => {
    // Summary: Registers a new standard user in auth.users inside a transaction.
  
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

    const client = await authPool.connect();

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

      // Hashes
      const { passwordHash, passwordSalt } =
        await auth.hashPassword(password);

      // Insert into auth.users
      await client.query(
        `INSERT INTO auth.users
          (
            username,
            displayname,
            email,
            password_hash,
            password_salt,
            role,
            is_active,
            must_change_password
          )
        VALUES
          ($1, $2, NULL, $3, $4, 'editor', true, false)`,
        [
          username,
          displayname,
          passwordHash,
          passwordSalt,
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
  app.get('/api/tracker/users', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const result = await adminPool.query(
      'SELECT username, displayname FROM auth.users ORDER BY username ASC'
    );
    return res.json({
      success: true,
      data: result.rows,
    });
  }));

  // GET /api/tracker/groups
  app.get('/api/tracker/groups', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const currentUser = (req as any).user;
    const result = await adminPool.query(
      `SELECT g.id, g.displayname, g.description, g.created_at, ug.role, ug.status
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
  }));

  // POST /api/tracker/groups
  app.post('/api/tracker/groups', requireAuth, requirePasswordReady, async (req, res) => {
    // Summary: Creates a new group and designates the creator as the group administrator.
    const validated = validateFullObject('groups', req.body);
    if (sendErrorsIfInvalid(res, validated)) {
      return;
    }

    const { displayname, description } = validated.data;
    const currentUser = (req as any).user;

    const client = await adminPool.connect();
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
  app.post('/api/tracker/groups/:groupId/invite', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { username } = req.body;
    const currentUser = (req as any).user;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!await isGroupAdmin(currentUser.username, groupId)) {
      return res.status(403).json({ error: 'Only group administrators can send invitations' });
    }

    const userCheck = await adminPool.query(
      'SELECT 1 FROM auth.users WHERE username = $1',
      [username]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    const membershipCheck = await adminPool.query(
      'SELECT 1 FROM user_group WHERE user_id = $1 AND group_id = $2',
      [username, groupId]
    );
    if (membershipCheck.rows.length > 0) {
      return res.status(409).json({ error: 'User is already a member or has a pending invitation' });
    }

    await adminPool.query(
      `INSERT INTO user_group (user_id, group_id, role, status)
       VALUES ($1, $2, 'member', 'invited')`,
      [username, groupId]
    );

    return res.json({
      success: true,
      message: `Successfully invited user ${username} to group ${groupId}`
    });
  }));

  // POST /api/tracker/groups/:groupId/invite/respond
  app.post('/api/tracker/groups/:groupId/invite/respond', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { action } = req.body;
    const currentUser = (req as any).user;

    if (action !== 'accepted' && action !== 'rejected') {
      return res.status(400).json({ error: "Action must be 'accepted' or 'rejected'" });
    }

    const inviteCheck = await adminPool.query(
      `SELECT 1 FROM user_group WHERE user_id = $1 AND group_id = $2 AND status = 'invited'`,
      [currentUser.username, groupId]
    );

    if (inviteCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (action === 'accepted') {
      await adminPool.query(
        `UPDATE user_group SET status = 'active' WHERE user_id = $1 AND group_id = $2`,
        [currentUser.username, groupId]
      );
    } else {
      await adminPool.query(
        `DELETE FROM user_group WHERE user_id = $1 AND group_id = $2`,
        [currentUser.username, groupId]
      );
    }

    return res.json({
      success: true,
      message: `Successfully ${action} group invitation`
    });
  }));

  // GET /api/tracker/invitations
  app.get('/api/tracker/invitations', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const currentUser = (req as any).user;
    const result = await adminPool.query(
      `SELECT g.id, g.displayname, g.description, g.created_at, ug.role, ug.status
       FROM user_group ug
       JOIN groups g ON ug.group_id = g.id
       WHERE ug.user_id = $1 AND ug.status = 'invited'
       ORDER BY g.created_at DESC`,
      [currentUser.username]
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  }));

  // GET /api/tracker/users/:username/invitations
  // Accessible by the user themself or a global admin
  app.get('/api/tracker/users/:username/invitations', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const { username } = req.params;
    const currentUser = (req as any).user;

    if (currentUser.username !== username && !await isGlobalAdmin(currentUser.username)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await adminPool.query(
      `SELECT g.id, g.displayname, g.description, g.created_at, ug.role, ug.status
       FROM user_group ug
       JOIN groups g ON ug.group_id = g.id
       WHERE ug.user_id = $1 AND ug.status = 'invited'
       ORDER BY g.created_at DESC`,
      [username]
    );

    return res.json({ success: true, data: result.rows });
  }));

  // GET /api/tracker/groups/:groupId/invitations
  // Group admins can list pending invitations for their group
  app.get('/api/tracker/groups/:groupId/invitations', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const currentUser = (req as any).user;

    if (!await isGroupAdmin(currentUser.username, groupId)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await adminPool.query(
      `SELECT ug.user_id, u.displayname, ug.role, ug.status
       FROM user_group ug
       JOIN auth.users u ON ug.user_id = u.username
       WHERE ug.group_id = $1 AND ug.status = 'invited'
       ORDER BY ug.user_id ASC`,
      [groupId]
    );

    return res.json({ success: true, data: result.rows });
  }));

  // GET /api/tracker/groups/:groupId/members
  app.get('/api/tracker/groups/:groupId/members', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const currentUser = (req as any).user;

    if (!await isGroupMember(currentUser.username, groupId)) {
      return res.status(403).json({ error: 'Must be an active member of the group to view members' });
    }

    const result = await adminPool.query(
      `SELECT ug.user_id, u.displayname, ug.role, ug.status
       FROM user_group ug
       JOIN auth.users u ON ug.user_id = u.username
       WHERE ug.group_id = $1
       ORDER BY ug.user_id ASC`,
      [groupId]
    );

    return res.json({
      success: true,
      data: result.rows
    });
  }));

  // GET /api/tracker/groups/:groupId/activities
  app.get('/api/tracker/groups/:groupId/activities', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const currentUser = (req as any).user;

    if (!await isGroupMember(currentUser.username, groupId)) {
      return res.status(403).json({ error: 'Must be an active member of the group to view activities' });
    }

    const result = await adminPool.query(
      `SELECT id, title, body, "group", status, created_at 
       FROM track WHERE "group" = $1 ORDER BY created_at DESC`,
      [groupId]
    );

    return res.json({
      success: true,
      data: result.rows
    });
  }));

  // POST /api/tracker/groups/:groupId/activities
  app.post('/api/tracker/groups/:groupId/activities', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const currentUser = (req as any).user;

    if (!await isGroupAdmin(currentUser.username, groupId)) {
      return res.status(403).json({ error: 'Only group administrators can create activities' });
    }

    req.body.group = groupId;
    const validated = validateFullObject('track', req.body);
    if (sendErrorsIfInvalid(res, validated)) return;

    const { title, body, status } = validated.data;
    const result = await adminPool.query(
      `INSERT INTO track (title, body, "group", status)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, body, groupId, status]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  }));

  // GET /api/tracker/activities/:activityId/records
  app.get('/api/tracker/activities/:activityId/records', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const { activityId } = req.params;
    const currentUser = (req as any).user;

    const trackCheck = await adminPool.query('SELECT "group" FROM track WHERE id = $1', [activityId]);
    if (trackCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const groupId = trackCheck.rows[0].group;
    if (!await isGroupMember(currentUser.username, groupId)) {
      return res.status(403).json({ error: "Must be an active member of the activity's group to view records" });
    }

    const result = await adminPool.query(
      `SELECT l.id, l.user_id, u.displayname, l.value, l.fecha, l.commentar
        FROM log l JOIN auth.users u ON l.user_id = u.username
       WHERE l.track = $1 ORDER BY l.fecha DESC, l.id DESC`,
      [activityId]
    );

    return res.json({
      success: true,
      data: result.rows
    });
  }));

  // POST /api/tracker/activities/:activityId/records
  app.post('/api/tracker/activities/:activityId/records', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const { activityId } = req.params;
    const currentUser = (req as any).user;

    const trackCheck = await adminPool.query('SELECT "group" FROM track WHERE id = $1', [activityId]);
    if (trackCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const groupId = trackCheck.rows[0].group;
    if (!await isGroupMember(currentUser.username, groupId)) {
      return res.status(403).json({ error: "Must be an active member of the activity's group to log entries" });
    }

    req.body.user_id = currentUser.username;
    req.body.track = Number(activityId);

    const validated = validateFullObject('log', req.body);
    if (sendErrorsIfInvalid(res, validated)) return;

    const { user_id, track, value, fecha, commentar } = validated.data;
    const result = await adminPool.query(
      `INSERT INTO log (user_id, track, value, fecha, commentar)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user_id, track, value, fecha, commentar]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  }));

  // GET /api/tracker/activities/:activityId/comparisons
  app.get('/api/tracker/activities/:activityId/comparisons', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const { activityId } = req.params;
    const currentUser = (req as any).user;

    const trackCheck = await adminPool.query('SELECT "group" FROM track WHERE id = $1', [activityId]);
    if (trackCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const groupId = trackCheck.rows[0].group;
    if (!await isGroupMember(currentUser.username, groupId)) {
      return res.status(403).json({ error: "Must be an active member of the activity's group to view comparisons" });
    }

    const result = await adminPool.query(
      `SELECT u.username, u.displayname, COALESCE(SUM(l.value), 0)::INTEGER AS total_value
       FROM user_group ug
       JOIN auth.users u ON ug.user_id = u.username
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
  }));

  // GET /api/tracker/activities/:activityId/stats
  app.get('/api/tracker/activities/:activityId/stats', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const { activityId } = req.params;
    const currentUser = (req as any).user;

    const trackCheck = await adminPool.query('SELECT "group" FROM track WHERE id = $1', [activityId]);
    if (trackCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const groupId = trackCheck.rows[0].group;
    if (!await isGroupMember(currentUser.username, groupId)) {
      return res.status(403).json({ error: "Must be an active member of the activity's group to view stats" });
    }

    const [summary, perUser, perUserPerMonth, daily, records] = await Promise.all([
      adminPool.query(
        `SELECT COUNT(*)::INTEGER AS total_count, COALESCE(SUM(value), 0)::INTEGER AS total_sum,
                ROUND(COALESCE(AVG(value), 0), 1)::NUMERIC(10,1) AS average,
                COALESCE(MAX(value), 0)::INTEGER AS max, COALESCE(MIN(value), 0)::INTEGER AS min
         FROM log WHERE track = $1`, [activityId]
      ),
      adminPool.query(
        `SELECT l.user_id, u.displayname, COUNT(*)::INTEGER AS count, COALESCE(SUM(l.value), 0)::INTEGER AS sum
         FROM log l JOIN auth.users u ON l.user_id = u.username
         WHERE l.track = $1 GROUP BY l.user_id, u.displayname`, [activityId]
      ),
      adminPool.query(
        `SELECT EXTRACT(YEAR FROM l.fecha)::INTEGER AS year, EXTRACT(MONTH FROM l.fecha)::INTEGER AS month,
                l.user_id, u.displayname, COUNT(*)::INTEGER AS count, COALESCE(SUM(l.value), 0)::INTEGER AS sum
         FROM log l JOIN auth.users u ON l.user_id = u.username
         WHERE l.track = $1
         GROUP BY year, month, l.user_id, u.displayname
         ORDER BY year, month`, [activityId]
      ),
      adminPool.query(
        `SELECT l.fecha::DATE AS date, COUNT(*)::INTEGER AS count, COALESCE(SUM(l.value), 0)::INTEGER AS sum
         FROM log l WHERE l.track = $1
         GROUP BY date ORDER BY date`, [activityId]
      ),
      adminPool.query(
        `SELECT l.id, l.user_id, u.displayname, l.value, l.fecha, l.commentar
         FROM log l JOIN auth.users u ON l.user_id = u.username
         WHERE l.track = $1 ORDER BY l.fecha DESC`, [activityId]
      ),
    ]);

    return res.json({
      success: true,
      data: {
        summary: summary.rows[0],
        per_user: perUser.rows,
        per_user_per_month: perUserPerMonth.rows,
        daily: daily.rows,
        records: records.rows,
      }
    });
  }));

  // GET /api/tracker/friends
  app.get('/api/tracker/friends', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const currentUser = (req as any).user;

    const result = await adminPool.query(
      `SELECT f.friend1, u1.displayname AS displayname1,
              f.friend2, u2.displayname AS displayname2, f.request
       FROM friends f
       JOIN auth.users u1 ON f.friend1 = u1.username
       JOIN auth.users u2 ON f.friend2 = u2.username
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
      } else if (row.request === 'pending_from_lower') {
        // friend1 sent the request
        if (row.friend1 === currentUser.username) {
          pendingSent.push({ username: row.friend2, displayname: row.displayname2 });
        } else {
          pendingReceived.push({ username: row.friend1, displayname: row.displayname1 });
        }
      } else if (row.request === 'pending_from_higher') {
        // friend2 sent the request
        if (row.friend2 === currentUser.username) {
          pendingSent.push({ username: row.friend1, displayname: row.displayname1 });
        } else {
          pendingReceived.push({ username: row.friend2, displayname: row.displayname2 });
        }
      }
    }

    return res.json({
      success: true,
      data: { friends, pendingSent, pendingReceived }
    });
  }));

  // POST /api/tracker/friends/request
  app.post('/api/tracker/friends/request', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const { username } = req.body;
    const currentUser = (req as any).user;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    if (username === currentUser.username) {
      return res.status(400).json({ error: 'Cannot send a friend request to yourself' });
    }

    const userCheck = await adminPool.query('SELECT 1 FROM auth.users WHERE username = $1', [username]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    const [friend1, friend2] = currentUser.username < username
      ? [currentUser.username, username]
      : [username, currentUser.username];
    const requestStatus = currentUser.username < username ? 'pending_from_lower' : 'pending_from_higher';

    const relCheck = await adminPool.query(
      'SELECT request FROM friends WHERE friend1 = $1 AND friend2 = $2',
      [friend1, friend2]
    );
    if (relCheck.rows.length > 0) {
      return res.status(409).json({ error: 'A friend relationship or pending request already exists' });
    }

    await adminPool.query(
      `INSERT INTO friends (friend1, friend2, request) VALUES ($1, $2, $3)`,
      [friend1, friend2, requestStatus]
    );

    return res.json({
      success: true,
      message: `Friend request sent to ${username}`
    });
  }));

  // POST /api/tracker/friends/respond
  app.post('/api/tracker/friends/respond', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const { username, action } = req.body;
    const currentUser = (req as any).user;

    if (!username || !action) {
      return res.status(400).json({ error: 'Username and action are required' });
    }
    if (action !== 'accepted' && action !== 'rejected') {
      return res.status(400).json({ error: "Action must be 'accepted' or 'rejected'" });
    }

    const [friend1, friend2] = currentUser.username < username
      ? [currentUser.username, username]
      : [username, currentUser.username];

    const relCheck = await adminPool.query(
      'SELECT request FROM friends WHERE friend1 = $1 AND friend2 = $2',
      [friend1, friend2]
    );
    if (relCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    if (relCheck.rows[0].request !== 'pending_from_lower' && relCheck.rows[0].request !== 'pending_from_higher') {
      return res.status(400).json({ error: 'Friend request is not pending' });
    }

    // Only the recipient (non-sender) can accept/reject
    const isSender = relCheck.rows[0].request === 'pending_from_lower'
      ? currentUser.username === friend1
      : currentUser.username === friend2;
    if (isSender) {
      return res.status(403).json({ error: 'Cannot respond to your own friend request' });
    }

    if (action === 'accepted') {
      await adminPool.query(
        `UPDATE friends SET request = 'accepted' WHERE friend1 = $1 AND friend2 = $2`,
        [friend1, friend2]
      );
    } else {
      await adminPool.query(
        `DELETE FROM friends WHERE friend1 = $1 AND friend2 = $2`,
        [friend1, friend2]
      );
    }

    return res.json({
      success: true,
      message: `Successfully ${action} friend request from ${username}`
    });
  }));

  // GET /api/tracker/logs
  app.get('/api/tracker/logs', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const currentUser = (req as any).user;

    const result = await adminPool.query(
      `SELECT l.id, t.title AS activity_title, g.displayname AS group_name,
              l.value, l.fecha, l.commentar
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
  }));

  // DELETE /api/tracker/groups/:groupId/members/:userId
  app.delete('/api/tracker/groups/:groupId/members/:userId', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const { groupId, userId } = req.params;
    const currentUser = (req as any).user;

    const membership = await adminPool.query(
      `SELECT role, status FROM user_group WHERE user_id = $1 AND group_id = $2`,
      [currentUser.username, groupId]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }
    if (membership.rows[0].status !== 'active') {
      return res.status(403).json({ error: 'Active membership required' });
    }

    const isAdmin = membership.rows[0].role === 'admin';
    const isSelf = currentUser.username === userId;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Only admins can kick other members' });
    }
    if (isSelf && isAdmin) {
      return res.status(400).json({ error: 'Transfer admin before leaving, or delete the group' });
    }

    const result = await adminPool.query(
      `DELETE FROM user_group WHERE user_id = $1 AND group_id = $2 RETURNING *`,
      [userId, groupId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User is not a member' });
    }

    return res.json({ success: true });
  }));

  // DELETE /api/tracker/groups/:groupId
  app.delete('/api/tracker/groups/:groupId', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const currentUser = (req as any).user;

    const membership = await adminPool.query(
      `SELECT role FROM user_group WHERE user_id = $1 AND group_id = $2 AND status = 'active'`,
      [currentUser.username, groupId]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }
    if (membership.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await adminPool.query('DELETE FROM groups WHERE id = $1', [groupId]);
    return res.json({ success: true });
  }));

  // DELETE /api/tracker/groups/:groupId/activities/:activityId
  app.delete('/api/tracker/groups/:groupId/activities/:activityId', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const { groupId, activityId } = req.params;
    const currentUser = (req as any).user;

    if (!await isGroupAdmin(currentUser.username, groupId)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await adminPool.query(
      `DELETE FROM track WHERE id = $1 AND "group" = $2 RETURNING *`,
      [activityId, groupId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    return res.json({ success: true });
  }));

  // DELETE /api/tracker/activities/:activityId/records/:recordId
  app.delete('/api/tracker/activities/:activityId/records/:recordId', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const { activityId, recordId } = req.params;
    const currentUser = (req as any).user;

    const recordCheck = await adminPool.query(
      `SELECT l.user_id, t."group" FROM log l JOIN track t ON l.track = t.id WHERE l.id = $1 AND l.track = $2`,
      [recordId, activityId]
    );
    if (recordCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const { user_id: ownerId, group: groupId } = recordCheck.rows[0];
    const isOwner = currentUser.username === ownerId;

    if (!isOwner && !await isGroupAdmin(currentUser.username, groupId)) {
      return res.status(403).json({ error: 'Only the record owner or a group admin can delete this record' });
    }

    await adminPool.query('DELETE FROM log WHERE id = $1', [recordId]);
    return res.json({ success: true });
  }));

  // DELETE /api/tracker/friends/:username
  app.delete('/api/tracker/friends/:username', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const currentUser = (req as any).user;
    const { username } = req.params;

    const [friend1, friend2] = currentUser.username < username
      ? [currentUser.username, username]
      : [username, currentUser.username];

    const result = await adminPool.query(
      `DELETE FROM friends WHERE friend1 = $1 AND friend2 = $2 RETURNING *`,
      [friend1, friend2]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    return res.json({ success: true });
  }));



  async function getCount(
    pool: Pool,
    tableName: string,
    whereClause: string,
    params: unknown[] = []
  ): Promise<number> {
    const allowed = ['user_group', 'friends', 'log'];
    if (!allowed.includes(tableName)) {
      throw new Error(`Invalid table: ${tableName}`);
    }
    const allowedWhere = ['user_id = $1 AND status = $2', '(friend1 = $1 OR friend2 = $1) AND request = $2', 'user_id = $1'];
    if (!allowedWhere.includes(whereClause)) {
      throw new Error(`Invalid where clause`);
    }

    const result = await pool.query(
      `SELECT COUNT(*) AS count FROM ${tableName} WHERE ${whereClause}`,
      params
    );

    return Number(result.rows[0].count);
  }
  
  
  async function getGroupCount(
    pool: Pool,
    username: string
  ): Promise<number> {
    return getCount(
      pool,
      'user_group',
      'user_id = $1 AND status = $2',
      [username, 'active']
    );
  }

  async function getFriendCount(
    pool: Pool,
    username: string
  ): Promise<number> {
    return getCount(
      pool,
      'friends',
      '(friend1 = $1 OR friend2 = $1) AND request = $2',
      [username, 'accepted']
    );
  }

  async function getLogCount(
    pool: Pool,
    username: string
  ): Promise<number> {
    return getCount(
      pool,
      'log',
      'user_id = $1',
      [username]
    );
  }

  // GET /api/tracker/stats
  app.get('/api/tracker/stats', requireAuth, requirePasswordReady, asyncHandler(async (req, res) => {
    const currentUser = (req as any).user;
    const groups = await getGroupCount(adminPool, currentUser.username);
    const friends = await getFriendCount(adminPool, currentUser.username);
    const logs = await getLogCount(adminPool, currentUser.username);

    return res.json({
      success: true,
      data: { groups, friends, logs },
    });
  }));
}
