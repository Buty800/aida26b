import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
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

type FilterConfig = {
  type: 'string' | 'number' | 'enum';
};

function buildListQuery(
  tableNameOrCTE: string,
  query: any,
  filterConfig: Record<string, FilterConfig>,
  defaultSort: string
) {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  const allowedColumns = Object.keys(filterConfig);

  for (const [key, rawValue] of Object.entries(query)) {
    if (!key.startsWith('filter_') || !rawValue) continue;
    const fieldName = key.slice(7);
    const config = filterConfig[fieldName];
    if (!config) continue;

    const vals = Array.isArray(rawValue) ? rawValue : [rawValue];

    for (const v of vals) {
      const strVal = String(v);
      if (!strVal) continue;

      const negated = strVal.startsWith('!');
      const actualVal = negated ? strVal.slice(1) : strVal;

      if (config.type === 'string') {
        conditions.push(`"${fieldName}"::text ${negated ? 'NOT ' : ''}ILIKE $${paramIndex}`);
        values.push(`%${actualVal}%`);
        paramIndex++;
      } else if (config.type === 'enum') {
        conditions.push(`"${fieldName}" ${negated ? '!=' : '='} $${paramIndex}`);
        values.push(actualVal);
        paramIndex++;
      } else if (config.type === 'number') {
        const commaIdx = actualVal.indexOf(',');
        if (commaIdx >= 0) {
          const minPart = actualVal.slice(0, commaIdx);
          const maxPart = actualVal.slice(commaIdx + 1);
          const hasMin = minPart !== '';
          const hasMax = maxPart !== '';

          if (hasMin && hasMax) {
            if (negated) {
              conditions.push(`("${fieldName}" < $${paramIndex} OR "${fieldName}" > $${paramIndex + 1})`);
            } else {
              conditions.push(`"${fieldName}" >= $${paramIndex} AND "${fieldName}" <= $${paramIndex + 1}`);
            }
            values.push(parseFloat(minPart), parseFloat(maxPart));
            paramIndex += 2;
          } else if (hasMin) {
            conditions.push(`"${fieldName}" ${negated ? '<' : '>='} $${paramIndex}`);
            values.push(parseFloat(minPart));
            paramIndex++;
          } else if (hasMax) {
            conditions.push(`"${fieldName}" ${negated ? '>' : '<='} $${paramIndex}`);
            values.push(parseFloat(maxPart));
            paramIndex++;
          }
        } else {
          conditions.push(`"${fieldName}" ${negated ? '<' : '>='} $${paramIndex}`);
          values.push(parseFloat(actualVal));
          paramIndex++;
        }
      }
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortCol = query.sort && allowedColumns.includes(query.sort as string) ? query.sort : defaultSort;
  const sortDir = query.dir === 'desc' ? 'DESC' : 'ASC';
  const orderClause = `ORDER BY "${sortCol}" ${sortDir}`;
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;
  const fromClause = tableNameOrCTE.includes(' ') ? `FROM (${tableNameOrCTE}) as base` : `FROM ${tableNameOrCTE}`;
  const dataQuery = `SELECT * ${fromClause} ${whereClause} ${orderClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  const dataValues = [...values, limit, offset];
  const countQuery = `SELECT COUNT(*) ${fromClause} ${whereClause}`;
  return { dataQuery, dataValues, countQuery, countValues: values };
}

// Routes
const studentFilters: Record<string, FilterConfig> = {
  numero_libreta: { type: 'string' },
  dni: { type: 'string' },
  first_name: { type: 'string' },
  last_name: { type: 'string' },
  email: { type: 'string' },
  enrollment_date: { type: 'string' },
  status: { type: 'enum' },
};
const subjectFilters: Record<string, FilterConfig> = {
  cod_mat: { type: 'string' },
  name: { type: 'string' },
  description: { type: 'string' },
  credits: { type: 'number' },
  department: { type: 'string' },
};
const enrollmentFilters: Record<string, FilterConfig> = {
  numero_libreta: { type: 'string' },
  student_name: { type: 'string' },
  cod_mat: { type: 'string' },
  subject_name: { type: 'string' },
  enrollment_date: { type: 'string' },
  grade: { type: 'number' },
  status: { type: 'enum' },
};

app.get('/api/students', async (req, res) => {
  try {
    const { dataQuery, dataValues, countQuery, countValues } = buildListQuery('students', req.query, studentFilters, 'numero_libreta');
    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, dataValues),
      pool.query(countQuery, countValues)
    ]);
    res.json({ data: dataResult.rows, total: parseInt(countResult.rows[0].count) });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/students/:numero_libreta', async (req, res) => {
  try {
    const { numero_libreta } = req.params;
    const result = await pool.query('SELECT * FROM students WHERE numero_libreta = $1', [numero_libreta]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const { numero_libreta, dni, first_name, last_name, email, enrollment_date, status } = req.body;
    const result = await pool.query(
      'INSERT INTO students (numero_libreta, dni, first_name, last_name, email, enrollment_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [numero_libreta, dni, first_name, last_name, email, enrollment_date, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/students/:numero_libreta', async (req, res) => {
  try {
    const { numero_libreta } = req.params;
    const { dni, first_name, last_name, email, enrollment_date, status } = req.body;
    const result = await pool.query(
      'UPDATE students SET dni = $1, first_name = $2, last_name = $3, email = $4, enrollment_date = $5, status = $6 WHERE numero_libreta = $7 RETURNING *',
      [dni, first_name, last_name, email, enrollment_date, status, numero_libreta]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/students/:numero_libreta', async (req, res) => {
  try {
    const { numero_libreta } = req.params;
    const result = await pool.query('DELETE FROM students WHERE numero_libreta = $1 RETURNING *', [numero_libreta]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Subjects routes
app.get('/api/subjects', async (req, res) => {
  try {
    const { dataQuery, dataValues, countQuery, countValues } = buildListQuery('subjects', req.query, subjectFilters, 'cod_mat');
    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, dataValues),
      pool.query(countQuery, countValues)
    ]);
    res.json({ data: dataResult.rows, total: parseInt(countResult.rows[0].count) });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/subjects/:cod_mat', async (req, res) => {
  try {
    const { cod_mat } = req.params;
    const result = await pool.query('SELECT * FROM subjects WHERE cod_mat = $1', [cod_mat]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/subjects', async (req, res) => {
  try {
    const { cod_mat, name, description, credits, department } = req.body;
    const result = await pool.query(
      'INSERT INTO subjects (cod_mat, name, description, credits, department) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [cod_mat, name, description, credits, department]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating subject:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/subjects/:cod_mat', async (req, res) => {
  try {
    const { cod_mat } = req.params;
    const { name, description, credits, department } = req.body;
    const result = await pool.query(
      'UPDATE subjects SET name = $1, description = $2, credits = $3, department = $4 WHERE cod_mat = $5 RETURNING *',
      [name, description, credits, department, cod_mat]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/subjects/:cod_mat', async (req, res) => {
  try {
    const { cod_mat } = req.params;
    const result = await pool.query('DELETE FROM subjects WHERE cod_mat = $1 RETURNING *', [cod_mat]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enrollments routes
app.get('/api/enrollments', async (req, res) => {
  try {
    const baseQuery = `
      SELECT e.*, s.first_name || ' ' || s.last_name as student_name, sub.name as subject_name
      FROM enrollments e
      JOIN students s ON e.numero_libreta = s.numero_libreta
      JOIN subjects sub ON e.cod_mat = sub.cod_mat
    `;
    const { dataQuery, dataValues, countQuery, countValues } = buildListQuery(baseQuery, req.query, enrollmentFilters, 'numero_libreta');
    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, dataValues),
      pool.query(countQuery, countValues)
    ]);
    res.json({ data: dataResult.rows, total: parseInt(countResult.rows[0].count) });
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/enrollments/:numero_libreta/:cod_mat', async (req, res) => {
  try {
    const { numero_libreta, cod_mat } = req.params;
    const result = await pool.query('SELECT * FROM enrollments WHERE numero_libreta = $1 AND cod_mat = $2', [numero_libreta, cod_mat]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching enrollment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/enrollments', async (req, res) => {
  try {
    const { numero_libreta, cod_mat, enrollment_date, grade, status } = req.body;
    const result = await pool.query(
      'INSERT INTO enrollments (numero_libreta, cod_mat, enrollment_date, grade, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [numero_libreta, cod_mat, enrollment_date, grade, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating enrollment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/enrollments/:numero_libreta/:cod_mat', async (req, res) => {
  try {
    const { numero_libreta, cod_mat } = req.params;
    const { enrollment_date, grade, status } = req.body;
    const result = await pool.query(
      'UPDATE enrollments SET enrollment_date = $1, grade = $2, status = $3 WHERE numero_libreta = $4 AND cod_mat = $5 RETURNING *',
      [enrollment_date, grade, status, numero_libreta, cod_mat]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating enrollment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/enrollments/:numero_libreta/:cod_mat', async (req, res) => {
  try {
    const { numero_libreta, cod_mat } = req.params;
    const result = await pool.query('DELETE FROM enrollments WHERE numero_libreta = $1 AND cod_mat = $2 RETURNING *', [numero_libreta, cod_mat]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    res.json({ message: 'Enrollment deleted successfully' });
  } catch (error) {
    console.error('Error deleting enrollment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve static files from frontend dist
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Catch-all handler: send back index.html for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});