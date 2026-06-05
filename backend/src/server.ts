import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

import { getHandler } from './routes/get';
import { putHandler } from './routes/put';
import { postHandler } from './routes/post';
import { deleteHandler } from './routes/delete';

// Load environment variables before reading process.env
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Middleware
app.use(cors());
app.use(express.json());

// Generic API routes
app.get('/api/:tableName', async (req, res) => {
  return getHandler(req, res, pool);
});

app.post('/api/:tableName', async (req, res) => {
  return postHandler(req, res, pool);
});

app.put('/api/:tableName', async (req, res) => {
  return putHandler(req, res, pool);
});

app.delete('/api/:tableName', async (req, res) => {
  return deleteHandler(req, res, pool);
});

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
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});