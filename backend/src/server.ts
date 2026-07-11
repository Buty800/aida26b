import express from 'express';
import type { Request, RequestHandler } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

import * as auth from './auth';

import { getHandler } from './routes/get';
import { putHandler } from './routes/put';
import { postHandler } from './routes/post';
import { deleteHandler } from './routes/delete';
import { registerTrackerRoutes } from './routes/tracker';

// Load environment variables before reading process.env
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Database connections
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const adminPool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.ADMIN_DB_USER || process.env.DB_USER,
  password: process.env.ADMIN_DB_PASSWORD || process.env.DB_PASSWORD,
});

const authPool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.AUTH_DB_USER || process.env.DB_USER,
  password: process.env.AUTH_DB_PASSWORD || process.env.DB_PASSWORD,
});

// Middleware
app.use(cors());
app.use(express.json());

type AuthedRequest = Request & { user?: auth.AuthUser };

function getSessionToken(req: Request) {
  return auth.parseCookies(req.headers.cookie)[auth.SESSION_COOKIE];
}

function readPassword(value: unknown) {
  return typeof value === 'string' && value.length >= 8 ? value : null;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

async function audit(
  req: Request,
  eventType: string,
  outcome: string,
  details: Record<string, unknown> = {}
) {
  try {
    await authPool.query(
      `INSERT INTO auth.audit_log
       (actor_user_id, event_type, outcome, ip, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        (req as AuthedRequest).user?.username ?? null,
        eventType,
        outcome,
        req.ip,
        req.get('user-agent') ?? null,
        JSON.stringify(details),
      ]
    );
  } catch (error) {
    console.error('Error writing audit log:', error);
  }
}

async function loadSession(req: Request) {
  const token = getSessionToken(req);

  if (!token) {
    return null;
  }

  const result = await authPool.query(
    `SELECT
       s.id AS session_id,
       u.username,
       u.displayname,
       u.email,
       u.role,
       u.is_active,
       u.must_change_password,
       s.impersonating_username
     FROM auth.sessions s
     JOIN auth.users u ON u.username = s.user_id
     WHERE s.token_hash = $1
       AND s.expires_at > now()
       AND u.is_active = true`,
    [auth.hashToken(token)]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];

  // If impersonating, fetch and return the impersonated user's data instead
  if (row.impersonating_username) {
    const impersonated = await authPool.query(
      `SELECT username, displayname, email, role, is_active, must_change_password
       FROM auth.users WHERE username = $1 AND is_active = true`,
      [row.impersonating_username]
    );
    if (impersonated.rows.length === 0) return null;
    return auth.publicUser({ ...impersonated.rows[0], impersonating_username: row.impersonating_username });
  }

  return auth.publicUser(row);
}

const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const user = await loadSession(req);

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    (req as AuthedRequest).user = user;
    next();
  } catch (error) {
    next(error);
  }
};

const requirePasswordReady: RequestHandler = (req, res, next) => {
  if ((req as AuthedRequest).user?.must_change_password) {
    return res.status(403).json({ error: 'Password change required' });
  }

  next();
};

const requireAdmin: RequestHandler = async (req, res, next) => {
  if ((req as AuthedRequest).user?.role === 'admin') {
    return next();
  }

  await audit(req, 'permission_denied', 'denied', {
    path: req.path,
    method: req.method,
  });

  return res.status(403).json({ error: 'Forbidden' });
};

const requireAcademicWrite: RequestHandler = async (req, res, next) => {
  const role = (req as AuthedRequest).user?.role;

  if (role === 'admin' || role === 'editor') {
    return next();
  }

  await audit(req, 'permission_denied', 'denied', {
    path: req.path,
    method: req.method,
  });

  return res.status(403).json({ error: 'Forbidden' });
};

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const username =
      typeof req.body.username === 'string' ? req.body.username.trim() : '';

    const password =
      typeof req.body.password === 'string' ? req.body.password : '';

    const result = await authPool.query(
      `SELECT
         username,
         displayname,
         email,
         password_hash,
         password_salt,
         role,
         is_active,
         must_change_password
       FROM auth.users
       WHERE username = $1`,
      [username]
    );

    const row = result.rows[0];

    const ok =
      row &&
      row.is_active === true &&
      (await auth.verifyPassword(password, row.password_salt, row.password_hash));

    if (!ok) {
      await audit(req, 'login_failed', 'failure', { username });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = auth.publicUser(row);
    const token = auth.newSessionToken();

    await authPool.query(
      `INSERT INTO auth.sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '7 days')`,
      [user.username, auth.hashToken(token)]
    );

    (req as AuthedRequest).user = user;

    await audit(req, 'login_success', 'success');

    res.setHeader(
      'Set-Cookie',
      auth.sessionCookie(token, process.env.NODE_ENV === 'production')
    );

    return res.json({ user });
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = getSessionToken(req);

    if (token) {
      const user = await loadSession(req);

      if (user) {
        (req as AuthedRequest).user = user;
      }

      await authPool.query('DELETE FROM auth.sessions WHERE token_hash = $1', [
        auth.hashToken(token),
      ]);

      await audit(req, 'logout', 'success');
    }

    res.setHeader(
      'Set-Cookie',
      auth.clearSessionCookie(process.env.NODE_ENV === 'production')
    );

    return res.status(204).send();
  } catch (error) {
    console.error('Error logging out:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  return res.json({ user: (req as AuthedRequest).user });
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const currentPassword =
      typeof req.body.current_password === 'string'
        ? req.body.current_password
        : '';

    const newPassword = readPassword(req.body.new_password);
    const user = (req as AuthedRequest).user!;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and a valid new password are required',
      });
    }

    const current = await authPool.query(
      'SELECT password_hash, password_salt FROM auth.users WHERE username = $1',
      [user.username]
    );

    const row = current.rows[0];

    const ok =
      row &&
      (await auth.verifyPassword(
        currentPassword,
        row.password_salt,
        row.password_hash
      ));

    if (!ok) {
      await audit(req, 'password_change_failed', 'failure');
      return res.status(401).json({ error: 'Invalid current password' });
    }

    const { passwordHash, passwordSalt } = await auth.hashPassword(newPassword);

    const result = await authPool.query(
      `UPDATE auth.users
       SET
         password_hash = $1,
         password_salt = $2,
         must_change_password = false,
         updated_at = now()
       WHERE username = $3
       RETURNING username, displayname, email, role, is_active, must_change_password`,
      [passwordHash, passwordSalt, user.username]
    );

    (req as AuthedRequest).user = auth.publicUser(result.rows[0]);

    await audit(req, 'password_changed', 'success');

    return res.json({ user: (req as AuthedRequest).user });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin routes
app.post(
  '/api/admin/users',
  requireAuth,
  requirePasswordReady,
  requireAdmin,
  async (req, res) => {
    try {
      const username =
        typeof req.body.username === 'string' ? req.body.username.trim() : '';

      const email =
        typeof req.body.email === 'string' && req.body.email.trim()
          ? req.body.email.trim()
          : null;

      const password = readPassword(req.body.password);
      const role = req.body.role;

      if (!username || !password || !auth.isRole(role)) {
        return res.status(400).json({
          error: 'Valid username, password and role are required',
        });
      }

      const { passwordHash, passwordSalt } = await auth.hashPassword(password);

      const result = await authPool.query(
        `INSERT INTO auth.users
         (username, displayname, email, password_hash, password_salt, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING username, displayname, email, role, is_active, must_change_password`,
        [username, username, email, passwordHash, passwordSalt, role]
      );

      await audit(req, 'user_created', 'success', {
        user_id: result.rows[0].username,
        role,
      });

      return res.status(201).json(result.rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

app.post(
  '/api/admin/users/:id/reset-password',
  requireAuth,
  requirePasswordReady,
  requireAdmin,
  async (req, res) => {
    try {
      const username =
        typeof req.params.id === 'string' ? req.params.id.trim() : '';
      const password = readPassword(req.body.password);

      if (!username || !password) {
        return res.status(400).json({
          error: 'Valid username and password are required',
        });
      }

      const { passwordHash, passwordSalt } = await auth.hashPassword(password);

      const result = await authPool.query(
        'UPDATE auth.users SET password_hash = $1, password_salt = $2, must_change_password = true, updated_at = now() WHERE username = $3 RETURNING username, displayname, email, role, is_active, must_change_password',
        [passwordHash, passwordSalt, username]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      await authPool.query('DELETE FROM auth.sessions WHERE user_id = $1', [username]);

      await audit(req, 'password_reset', 'success', { user_id: username });

      return res.json({ user: result.rows[0] });
    } catch (error) {
      console.error('Error resetting password:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/admin/impersonate — admin temporarily acts as another user
app.post('/api/admin/impersonate', requireAuth, requirePasswordReady, requireAdmin, async (req, res) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const userResult = await authPool.query(
      `SELECT username, displayname, email, role, is_active, must_change_password
       FROM auth.users WHERE username = $1 AND is_active = true`,
      [username]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const token = getSessionToken(req);
    await authPool.query(
      'UPDATE auth.sessions SET impersonating_username = $1 WHERE token_hash = $2',
      [username, auth.hashToken(token)]
    );

    return res.json({ user: auth.publicUser({ ...userResult.rows[0], impersonating_username: username }) });
  } catch (error) {
    console.error('Error impersonating user:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/unimpersonate — switch back to admin
app.post('/api/admin/unimpersonate', requireAuth, async (req, res) => {
  try {
    const token = getSessionToken(req);
    const result = await authPool.query(
      `UPDATE auth.sessions SET impersonating_username = NULL
       WHERE token_hash = $1 AND impersonating_username IS NOT NULL
       RETURNING user_id`,
      [auth.hashToken(token)]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Not impersonating any user' });
    }

    const adminResult = await authPool.query(
      `SELECT username, displayname, email, role, is_active, must_change_password
       FROM auth.users WHERE username = $1`,
      [result.rows[0].user_id]
    );

    return res.json({ user: auth.publicUser(adminResult.rows[0]) });
  } catch (error) {
    console.error('Error unimpersonating:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Register Tracker endpoints (uses adminPool — no access to password hashes)
registerTrackerRoutes(app, adminPool, authPool, requireAuth, requirePasswordReady);

// Generic academic API routes (restricted to admins, uses adminPool)
app.get('/api/:tableName', requireAuth, requirePasswordReady, requireAdmin, async (req, res) => {
  return getHandler(req, res, adminPool);
});

app.post(
  '/api/:tableName',
  requireAuth,
  requirePasswordReady,
  requireAdmin,
  async (req, res) => {
    return postHandler(req, res, adminPool);
  }
);

app.put(
  '/api/:tableName',
  requireAuth,
  requirePasswordReady,
  requireAdmin,
  async (req, res) => {
    return putHandler(req, res, adminPool);
  }
);

app.delete(
  '/api/:tableName',
  requireAuth,
  requirePasswordReady,
  requireAdmin,
  async (req, res) => {
    return deleteHandler(req, res, adminPool);
  }
);

// Resolve frontend static files directory
let frontendDistPath = path.join(__dirname, '../../frontend/dist');

if (!fs.existsSync(path.join(frontendDistPath, 'index.html'))) {
  const fallbackPath = path.join(__dirname, '../../../../frontend/dist');

  if (fs.existsSync(path.join(fallbackPath, 'index.html'))) {
    frontendDistPath = fallbackPath;
  }
}

// Serve static files from frontend dist
app.use(express.static(frontendDistPath));

// Catch-all handler for frontend routes
app.get('*', (_req, res) => {
  return res.sendFile(path.join(frontendDistPath, 'index.html'));
});

export { app, pool, adminPool, authPool };

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}
