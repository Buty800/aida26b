import { createAppGivenPool } from '../src/app';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, test } from 'vitest';
import assert from 'node:assert';
import dotenv from 'dotenv';

const TESTS_PORT = 4000;
export const API_BASE = `http://localhost:${TESTS_PORT}/api`;

dotenv.config();

const testsPool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

let server: any;

beforeAll(async () => {
    const app = createAppGivenPool(testsPool);
    server = app.listen(TESTS_PORT);
    await testsPool.query('TRUNCATE TABLE users, groups CASCADE');
});

afterEach(async () => {
    await testsPool.query('TRUNCATE TABLE users, groups CASCADE');
});

afterAll(async () => {
  testsPool.end();
  server.close();
});

test('GET /users of empty db returns empty list', async () => {
    const response = await fetch(`${API_BASE}/users`);
    assert.strictEqual(response.status, 200);
    const body = await response.json() as any;
    assert.strictEqual(body.data.length, 0);
});

test('POST & GET & PUT & DELETE /users', async () => {
    // 1. Create a user
    const createRes = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'johndoe',
            displayname: 'John Doe',
            password: 'mypassword123'
        })
    });
    assert.strictEqual(createRes.status, 201);
    const createBody = await createRes.json() as any;
    assert.strictEqual(createBody.success, true);
    assert.strictEqual(createBody.data.username, 'johndoe');

    // 2. Fetch the user
    const getRes = await fetch(`${API_BASE}/users?username=johndoe`);
    assert.strictEqual(getRes.status, 200);
    const getBody = await getRes.json() as any;
    assert.strictEqual(getBody.data.username, 'johndoe');

    // 3. Update the user (PUT)
    const updateRes = await fetch(`${API_BASE}/users?username=johndoe`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'johndoe',
            displayname: 'John Doe Modified',
            password: 'mypassword987'
        })
    });
    assert.strictEqual(updateRes.status, 202);

    // 4. Delete the user
    const deleteRes = await fetch(`${API_BASE}/users?username=johndoe`, {
        method: 'DELETE'
    });
    assert.strictEqual(deleteRes.status, 200);

    // 5. Fetch again (should be empty)
    const getAfterDelete = await fetch(`${API_BASE}/users`);
    const getAfterDeleteBody = await getAfterDelete.json() as any;
    assert.strictEqual(getAfterDeleteBody.data.length, 0);
});

test('POST /groups & GET /groups', async () => {
    const createRes = await fetch(`${API_BASE}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            displayname: 'Test Group',
            description: 'This is a test group'
        })
    });
    assert.strictEqual(createRes.status, 201);
    const createBody = await createRes.json() as any;
    assert.strictEqual(createBody.success, true);
    assert.ok(createBody.data.id);

    const getRes = await fetch(`${API_BASE}/groups`);
    assert.strictEqual(getRes.status, 200);
    const getBody = await getRes.json() as any;
    assert.strictEqual(getBody.data.length, 1);
});