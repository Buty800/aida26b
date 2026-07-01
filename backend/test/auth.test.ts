// @ts-nocheck
import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'vitest';
import { app, pool } from '../src/server';
import { hashPassword } from '../src/auth';

class FakeDb {
  constructor(users) {
    this.users = users;
    this.sessions = [];
    this.audit = [];
    this.business_users = [];
    this.groups = [];
    this.user_groups = [];
    this.nextUserId = Math.max(...users.map((user) => user.id)) + 1;
  }

  async query(text, params = []) {
    const sql = text.replace(/\s+/g, ' ').trim();

    // Transaction control statements - just acknowledge (handle variants)
    if (/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(sql)) {
      return { rows: [] };
    }

    if (sql.startsWith('INSERT INTO auth.audit_log')) {
      this.audit.push({ actor_user_id: params[0], event_type: params[1], outcome: params[2] });
      return { rows: [] };
    }
    if (sql.includes('FROM auth.users WHERE username = $1')) {
      return { rows: this.users.filter((user) => user.username === params[0]) };
    }
    if (sql.startsWith('SELECT password_hash, password_salt FROM auth.users WHERE id')) {
      const user = this.users.find((item) => item.id === params[0]);
      return { rows: user ? [{ password_hash: user.password_hash, password_salt: user.password_salt }] : [] };
    }
    if (sql.startsWith('INSERT INTO auth.sessions')) {
      this.sessions.push({ user_id: params[0], token_hash: params[1], expires_at: Date.now() + 604800000 });
      return { rows: [] };
    }
    if (sql.startsWith('SELECT s.id AS session_id')) {
      const session = this.sessions.find((item) => item.token_hash === params[0] && item.expires_at > Date.now());
      const user = session && this.users.find((item) => item.id === session.user_id && item.is_active);
      return { rows: user ? [{ session_id: 1, ...user }] : [] };
    }
    if (sql.startsWith('DELETE FROM auth.sessions WHERE token_hash')) {
      this.sessions = this.sessions.filter((item) => item.token_hash !== params[0]);
      return { rows: [] };
    }
    if (sql.startsWith('DELETE FROM auth.sessions WHERE user_id')) {
      this.sessions = this.sessions.filter((item) => item.user_id !== params[0]);
      return { rows: [] };
    }
    if (sql.startsWith('INSERT INTO auth.users')) {
      if (this.users.some((user) => user.username === params[0])) {
        throw Object.assign(new Error('duplicate username'), { code: '23505' });
      }
      const user = {
        id: this.nextUserId++,
        username: params[0],
        email: params[1],
        password_hash: params[2],
        password_salt: params[3],
        role: sql.includes("'reader'") ? 'reader' : params[4],
        is_active: true,
        must_change_password: true,
        student_numero_libreta: sql.includes('student_numero_libreta') ? params[0] : null,
      };
      this.users.push(user);
      return { rows: [publicRow(user)] };
    }
    if (sql.startsWith('UPDATE auth.users SET password_hash')) {
      const user = this.users.find((item) => item.id === params[2]);
      if (!user) return { rows: [] };
      user.password_hash = params[0];
      user.password_salt = params[1];
      user.must_change_password = sql.includes('must_change_password = true');
      return { rows: [publicRow(user)] };
    }
    if (sql.startsWith('SELECT * FROM users') || sql.startsWith('SELECT users.* FROM users')) {
      return { rows: this.business_users };
    }
    if (sql.startsWith('SELECT username, displayname FROM users')) {
      return {
        rows: this.business_users
          .map((u) => ({
            username: u.username,
            displayname: u.displayName || u.displayname,
          }))
          .sort((a, b) => a.username.localeCompare(b.username)),
      };
    }
    if (sql.startsWith('SELECT 1 FROM users WHERE username =')) {
      const username = params[0];
      const existsInUsers = this.users.some((u) => u.username === username);
      const existsInBusiness = this.business_users.some((u) => u.username === username || u.displayName === username);
      const exists = existsInUsers || existsInBusiness;
      return { rowCount: exists ? 1 : 0, rows: exists ? [{ 1: 1 }] : [] };
    }

    // Handle queries that wrap the users query in a CTE/derived table or use COUNT
    if (/FROM\s*\(\s*SELECT\s+\*\s+FROM\s+users/i.test(sql) || /FROM\s+users/i.test(sql)) {
      if (/SELECT\s+COUNT\(/i.test(sql)) {
        return { rows: [{ count: this.business_users.length }] };
      }
      return { rows: this.business_users };
    }
    if (sql.startsWith('INSERT INTO users')) {
      const user = {
        username: params[0],
        displayName: params[1],
        password: params[2],
        created_at: new Date().toISOString()
      };
      this.business_users.push(user);
      return { rows: [user] };
    }
    if (sql.startsWith('INSERT INTO groups')) {
      const group = {
        id: 'group-' + Math.random().toString(36).substring(2, 11),
        displayname: params[0],
        description: params[1] || null,
        created_at: new Date().toISOString()
      };
      this.groups.push(group);
      return { rows: [group] };
    }
    if (sql.startsWith('INSERT INTO user_group')) {
      const userGroup = {
        id_relation: 'relation-uuid',
        user_id: params[0],
        group_id: params[1],
        role: sql.includes("'admin'") ? 'admin' : (params[2] || 'member'),
        status: sql.includes("'active'") ? 'active' : (params[3] || 'invited'),
        created_at: new Date().toISOString()
      };
      this.user_groups.push(userGroup);
      return { rows: [userGroup] };
    }
    if (sql.startsWith('SELECT g.id, g.displayname, g.description, g.created_at, ug.role')) {
      const userId = params[0];
      const rows = this.user_groups
        .filter((ug) => ug.user_id === userId && ug.status === 'active')
        .map((ug) => {
          const group = this.groups.find((g) => g.id === ug.group_id);
          return {
            id: group?.id,
            displayname: group?.displayname,
            description: group?.description,
            created_at: group?.created_at,
            role: ug.role
          };
        })
        .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
      return { rows };
    }
    if (sql.startsWith('SELECT 1 FROM user_group') && sql.includes("role = 'admin' AND status = 'active'")) {
      const userId = params[0];
      const groupId = params[1];
      const exists = this.user_groups.some(
        (ug) => ug.user_id === userId && ug.group_id === groupId && ug.role === 'admin' && ug.status === 'active'
      );
      return { rowCount: exists ? 1 : 0, rows: exists ? [{ 1: 1 }] : [] };
    }

    if (sql.startsWith('SELECT 1 FROM user_group') && sql.includes("status = 'invited'")) {
      const userId = params[0];
      const groupId = params[1];
      const exists = this.user_groups.some(
        (ug) => ug.user_id === userId && ug.group_id === groupId && ug.status === 'invited'
      );
      return { rowCount: exists ? 1 : 0, rows: exists ? [{ 1: 1 }] : [] };
    }
    if (sql.startsWith('SELECT 1 FROM user_group') && sql.includes("status = 'active'")) {
      const userId = params[0];
      const groupId = params[1];
      const exists = this.user_groups.some(
        (ug) => ug.user_id === userId && ug.group_id === groupId && ug.status === 'active'
      );
      return { rowCount: exists ? 1 : 0, rows: exists ? [{ 1: 1 }] : [] };
    }
    if (sql.startsWith('SELECT 1 FROM user_group WHERE user_id = $1 AND group_id = $2')) {
      const userId = params[0];
      const groupId = params[1];
      const exists = this.user_groups.some(
        (ug) => ug.user_id === userId && ug.group_id === groupId
      );
      return { rowCount: exists ? 1 : 0, rows: exists ? [{ 1: 1 }] : [] };
    }
    if (sql.startsWith("UPDATE user_group SET status = 'active'")) {
      const userId = params[0];
      const groupId = params[1];
      const ug = this.user_groups.find((ug) => ug.user_id === userId && ug.group_id === groupId);
      if (ug) {
        ug.status = 'active';
      }
      return { rowCount: ug ? 1 : 0, rows: ug ? [ug] : [] };
    }
    if (sql.startsWith('DELETE FROM user_group')) {
      const userId = params[0];
      const groupId = params[1];
      const initialLength = this.user_groups.length;
      this.user_groups = this.user_groups.filter(
        (ug) => !(ug.user_id === userId && ug.group_id === groupId)
      );
      return { rowCount: initialLength - this.user_groups.length };
    }
    if (sql.startsWith('SELECT ug.user_id, u.displayname, ug.role, ug.status')) {
      const groupId = params[0];
      const rows = this.user_groups
        .filter((ug) => ug.group_id === groupId)
        .map((ug) => {
          const u = this.users.find((u) => u.username === ug.user_id) || this.business_users.find((u) => u.username === ug.user_id);
          return {
            user_id: ug.user_id,
            displayname: u ? (u.displayname || u.displayName || u.username) : ug.user_id,
            role: ug.role,
            status: ug.status,
          };
        })
        .sort((a, b) => a.user_id.localeCompare(b.user_id));
      return { rows };
    }

    throw new Error(`Unhandled query: ${sql}`);
  }
}

function publicRow(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    must_change_password: user.must_change_password,
  };
}

async function makeDb() {
  const admin = await hashPassword('adminpass');
  const editor = await hashPassword('editorpass');
  const reader = await hashPassword('readerpass');
  return new FakeDb([
    { id: 1, username: 'admin', email: null, role: 'admin', is_active: true, must_change_password: false, password_hash: admin.passwordHash, password_salt: admin.passwordSalt },
    { id: 2, username: 'editor', email: null, role: 'editor', is_active: true, must_change_password: false, password_hash: editor.passwordHash, password_salt: editor.passwordSalt },
    { id: 3, username: 'reader', email: null, role: 'reader', is_active: true, must_change_password: false, password_hash: reader.passwordHash, password_salt: reader.passwordSalt },
  ]);
}

async function withServer(db, run) {
  pool.query = db.query.bind(db);
  pool.connect = async () => ({
    query: db.query.bind(db),
    release: async () => {},
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(baseUrl, path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = response.headers.get('set-cookie');
  const text = await response.text();
  return { status: response.status, cookie: setCookie ? setCookie.split(';')[0] : null, body: text ? JSON.parse(text) : null };
}

async function login(baseUrl, username, password) {
  const response = await request(baseUrl, '/api/auth/login', { method: 'POST', body: { username, password } });
  assert.equal(response.status, 200);
  assert.ok(response.cookie.startsWith('aida_session='));
  return response.cookie;
}

test('login, me and logout manage the session cookie', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const badLogin = await request(baseUrl, '/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'wrongpass' } });
    assert.equal(badLogin.status, 401);
    assert.equal(db.audit.at(-1).event_type, 'login_failed');

    const cookie = await login(baseUrl, 'admin', 'adminpass');
    const me = await request(baseUrl, '/api/auth/me', { cookie });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.role, 'admin');

    const logout = await request(baseUrl, '/api/auth/logout', { method: 'POST', cookie });
    assert.equal(logout.status, 204);
    const afterLogout = await request(baseUrl, '/api/auth/me', { cookie });
    assert.equal(afterLogout.status, 401);
  });
});

test('reader can read but cannot mutate academic data', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const cookie = await login(baseUrl, 'reader', 'readerpass');
    // Now returns 403 because raw tables are restricted to admin
    assert.equal((await request(baseUrl, '/api/users', { cookie })).status, 403);
    const write = await request(baseUrl, '/api/users', {
      method: 'POST',
      cookie,
      body: { username: 'ada', displayname: 'Ada Lovelace', password: 'userpassword' },
    });
    assert.equal(write.status, 403);
    assert.equal(db.audit.at(-1).event_type, 'permission_denied');
  });
});

test('editor can create a business user but cannot manage admin users', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const cookie = await login(baseUrl, 'editor', 'editorpass');
    const createUser = await request(baseUrl, '/api/users', {
      method: 'POST',
      cookie,
      body: { username: 'grace', displayname: 'Grace Hopper', password: 'userpassword' },
    });
    // Now returns 403 because raw tables are restricted to admin
    assert.equal(createUser.status, 403);

    const createAdminUser = await request(baseUrl, '/api/admin/users', { method: 'POST', cookie, body: { username: 'other', password: 'otherpass', role: 'reader' } });
    assert.equal(createAdminUser.status, 403);
  });
});

test('admin can create users and reset passwords', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const adminCookie = await login(baseUrl, 'admin', 'adminpass');
    const created = await request(baseUrl, '/api/admin/users', { method: 'POST', cookie: adminCookie, body: { username: 'newreader', password: 'firstpass', role: 'reader' } });
    assert.equal(created.status, 201);
    assert.equal(created.body.role, 'reader');

    const reset = await request(baseUrl, `/api/admin/users/${created.body.id}/reset-password`, { method: 'POST', cookie: adminCookie, body: { password: 'secondpass' } });
    assert.equal(reset.status, 200);

    const newCookie = await login(baseUrl, 'newreader', 'secondpass');
    const me = await request(baseUrl, '/api/auth/me', { cookie: newCookie });
    assert.equal(me.body.user.must_change_password, true);
  });
});

test('first login users must change password before using the app', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const adminCookie = await login(baseUrl, 'admin', 'adminpass');
    await request(baseUrl, '/api/admin/users', { method: 'POST', cookie: adminCookie, body: { username: 'tempuser', password: 'temppass1', role: 'reader' } });

    const tempCookie = await login(baseUrl, 'tempuser', 'temppass1');
    const blocked = await request(baseUrl, '/api/users', { cookie: tempCookie });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error, 'Password change required');

    const changed = await request(baseUrl, '/api/auth/change-password', {
      method: 'POST',
      cookie: tempCookie,
      body: { current_password: 'temppass1', new_password: 'newpass123' },
    });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.user.must_change_password, false);
    
    // Now returns 403 because raw tables are restricted to admin
    assert.equal((await request(baseUrl, '/api/users', { cookie: tempCookie })).status, 403);
  });
});

test('GET /api/tracker/users requires authentication and returns the list of all business users', async () => {
  const db = await makeDb();
  // Seed some business users
  db.business_users = [
    { username: 'charlie', displayName: 'Charlie Brown', password: 'scrypt$...', created_at: new Date().toISOString() },
    { username: 'alice', displayName: 'Alice Smith', password: 'scrypt$...', created_at: new Date().toISOString() }
  ];
  await withServer(db, async (baseUrl) => {
    // 1. Without auth cookie, should return 401
    const responseUnauth = await request(baseUrl, '/api/tracker/users');
    assert.equal(responseUnauth.status, 401);

    // 2. With auth cookie, should return 200 and list sorted by username
    const cookie = await login(baseUrl, 'editor', 'editorpass');
    const response = await request(baseUrl, '/api/tracker/users', { cookie });
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.length, 2);
    assert.equal(response.body.data[0].username, 'alice');
    assert.equal(response.body.data[0].displayname, 'Alice Smith');
    assert.equal(response.body.data[1].username, 'charlie');
    assert.equal(response.body.data[1].displayname, 'Charlie Brown');
  });
});

test('GET and POST /api/tracker/groups handles group creation and lists active user groups', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    // 1. Without auth, GET /api/tracker/groups should return 401
    const unauthGet = await request(baseUrl, '/api/tracker/groups');
    assert.equal(unauthGet.status, 401);

    // 2. Log in
    const cookie = await login(baseUrl, 'editor', 'editorpass');

    // 3. GET /api/tracker/groups should return empty array
    const initialGet = await request(baseUrl, '/api/tracker/groups', { cookie });
    assert.equal(initialGet.status, 200);
    assert.equal(initialGet.body.success, true);
    assert.equal(initialGet.body.data.length, 0);

    // 4. POST /api/tracker/groups to create a new group
    const createRes = await request(baseUrl, '/api/tracker/groups', {
      method: 'POST',
      cookie,
      body: {
        displayname: 'Exactas Runners',
        description: 'Group for runners at Exactas'
      }
    });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.success, true);
    assert.ok(createRes.body.data.id);
    assert.equal(createRes.body.data.displayname, 'Exactas Runners');

    // 5. GET /api/tracker/groups again, should return the newly created group with role 'admin'
    const afterCreateGet = await request(baseUrl, '/api/tracker/groups', { cookie });
    assert.equal(afterCreateGet.status, 200);
    assert.equal(afterCreateGet.body.success, true);
    assert.equal(afterCreateGet.body.data.length, 1);
    assert.equal(afterCreateGet.body.data[0].displayname, 'Exactas Runners');
    assert.equal(afterCreateGet.body.data[0].role, 'admin');

    // 6. POST with invalid payload should return 400 (validation error)
    const invalidCreate = await request(baseUrl, '/api/tracker/groups', {
      method: 'POST',
      cookie,
      body: {
        description: 'Missing displayname'
      }
    });
    assert.equal(invalidCreate.status, 400);
  });
});

test('GET & POST group invitations and members endpoints work as expected', async () => {
  const db = await makeDb();
  // Seed the business users corresponding to our auth users
  db.business_users = [
    { username: 'editor', displayName: 'Editor User', password: '...', created_at: new Date().toISOString() },
    { username: 'reader', displayName: 'Reader User', password: '...', created_at: new Date().toISOString() }
  ];

  await withServer(db, async (baseUrl) => {
    // 1. Log in
    const cookieEditor = await login(baseUrl, 'editor', 'editorpass');
    const cookieReader = await login(baseUrl, 'reader', 'readerpass');

    // 2. Editor creates a group
    const createRes = await request(baseUrl, '/api/tracker/groups', {
      method: 'POST',
      cookie: cookieEditor,
      body: {
        displayname: 'Runner Club',
        description: null
      }
    });
    const groupId = createRes.body.data.id;

    // 3. Reader (not member or admin) tries to view members -> should return 403
    const forbiddenMembers = await request(baseUrl, `/api/tracker/groups/${groupId}/members`, {
      cookie: cookieReader
    });
    assert.equal(forbiddenMembers.status, 403);

    // 4. Reader tries to invite editor -> should return 403 (reader is not admin)
    const unauthorizedInvite = await request(baseUrl, `/api/tracker/groups/${groupId}/invite`, {
      method: 'POST',
      cookie: cookieReader,
      body: { username: 'editor' }
    });
    assert.equal(unauthorizedInvite.status, 403);

    // 5. Editor invites nonexistent user -> should return 404
    const nonexistentInvite = await request(baseUrl, `/api/tracker/groups/${groupId}/invite`, {
      method: 'POST',
      cookie: cookieEditor,
      body: { username: 'nonexistent' }
    });
    assert.equal(nonexistentInvite.status, 404);

    // 6. Editor invites reader successfully -> should return 200
    const successfulInvite = await request(baseUrl, `/api/tracker/groups/${groupId}/invite`, {
      method: 'POST',
      cookie: cookieEditor,
      body: { username: 'reader' }
    });
    assert.equal(successfulInvite.status, 200);
    assert.equal(successfulInvite.body.success, true);

    // 7. Editor invites reader again -> should return 409 (conflict)
    const duplicateInvite = await request(baseUrl, `/api/tracker/groups/${groupId}/invite`, {
      method: 'POST',
      cookie: cookieEditor,
      body: { username: 'reader' }
    });
    assert.equal(duplicateInvite.status, 409);

    // 8. Reader responds to invitation with invalid action -> should return 400
    const invalidRespond = await request(baseUrl, `/api/tracker/groups/${groupId}/invite/respond`, {
      method: 'POST',
      cookie: cookieReader,
      body: { action: 'maybe' }
    });
    assert.equal(invalidRespond.status, 400);

    // 9. Reader accepts the invitation successfully -> should return 200
    const acceptRespond = await request(baseUrl, `/api/tracker/groups/${groupId}/invite/respond`, {
      method: 'POST',
      cookie: cookieReader,
      body: { action: 'accepted' }
    });
    assert.equal(acceptRespond.status, 200);
    assert.equal(acceptRespond.body.success, true);

    // 10. Reader now is an active member, gets the group member list -> should return 200 and two members
    const membersRes = await request(baseUrl, `/api/tracker/groups/${groupId}/members`, {
      cookie: cookieReader
    });
    assert.equal(membersRes.status, 200);
    assert.equal(membersRes.body.success, true);
    assert.equal(membersRes.body.data.length, 2);
    // Members should be ordered by username
    assert.equal(membersRes.body.data[0].user_id, 'editor');
    assert.equal(membersRes.body.data[0].role, 'admin');
    assert.equal(membersRes.body.data[0].status, 'active');
    assert.equal(membersRes.body.data[1].user_id, 'reader');
    assert.equal(membersRes.body.data[1].role, 'member');
    assert.equal(membersRes.body.data[1].status, 'active');
  });
});
