import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const SCHEMA_PATH = path.resolve(__dirname, '../../database/schema.sql');

async function main() {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'faculty_management',
    user: process.env.DB_USER || 'aida26_user',
    password: process.env.DB_PASSWORD || 'CambiaEsta!',
  });

  try {
    await pool.query(sql);
    console.log('Database schema applied successfully.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Failed to apply schema:', err.message);
  process.exit(1);
});
