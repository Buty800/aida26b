import { Pool } from "pg";
import express from 'express';
import { structure } from '../../../shared/src/ssot/structure.js';
import { ColumnDef } from '../../../shared/src/types/types.js';

export function buildListQuery(
  tableNameOrCTE: string,
  query: any,
  filterConfig: Record<string, ColumnDef>,
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

      if (config.type === 'string' && !config.options) {
        conditions.push(`"${fieldName}"::text ${negated ? 'NOT ' : ''}ILIKE $${paramIndex}`);
        values.push(`%${actualVal}%`);
        paramIndex++;
      } else if (config.options) {
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
            const nMin = parseFloat(minPart);
            const nMax = parseFloat(maxPart);
            if (isNaN(nMin) || isNaN(nMax)) continue;
            if (negated) {
              conditions.push(`("${fieldName}" < $${paramIndex} OR "${fieldName}" > $${paramIndex + 1})`);
            } else {
              conditions.push(`"${fieldName}" >= $${paramIndex} AND "${fieldName}" <= $${paramIndex + 1}`);
            }
            values.push(nMin, nMax);
            paramIndex += 2;
          } else if (hasMin) {
            const n = parseFloat(minPart);
            if (isNaN(n)) continue;
            conditions.push(`"${fieldName}" ${negated ? '<' : '>='} $${paramIndex}`);
            values.push(n);
            paramIndex++;
          } else if (hasMax) {
            const n = parseFloat(maxPart);
            if (isNaN(n)) continue;
            conditions.push(`"${fieldName}" ${negated ? '>' : '<='} $${paramIndex}`);
            values.push(n);
            paramIndex++;
          }
        } else {
          const n = parseFloat(actualVal);
          if (isNaN(n)) continue;
          conditions.push(`"${fieldName}" ${negated ? '<' : '>='} $${paramIndex}`);
          values.push(n);
          paramIndex++;
        }
      }
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortCol = query.sort && allowedColumns.includes(query.sort as string) ? query.sort : defaultSort;
  const sortDir = query.dir === 'desc' ? 'DESC' : 'ASC';
  const orderClause = `ORDER BY "${sortCol}" ${sortDir}`;
  const page = Math.max(1, Math.min(parseInt(query.page as string) || 1, 1000));
  const limit = 20;
  const offset = (page - 1) * limit;
  const fromClause = tableNameOrCTE.includes(' ') ? `FROM (${tableNameOrCTE}) as base` : `FROM ${tableNameOrCTE}`;
  const dataQuery = `SELECT * ${fromClause} ${whereClause} ${orderClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  const dataValues = [...values, limit, offset];
  const countQuery = `SELECT COUNT(*) ${fromClause} ${whereClause}`;
  return { dataQuery, dataValues, countQuery, countValues: values };
}


async function fetchStudentsTable(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const { dataQuery, dataValues, countQuery, countValues } = buildListQuery('students', req.query, structure.tables.students.columns, 'numero_libreta');
    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, dataValues),
      pool.query(countQuery, countValues)
    ]);
    res.json({ data: dataResult.rows, total: parseInt(countResult.rows[0].count) });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getStudentsHandler(req: express.Request, res: express.Response, pool: Pool) {
  const isListRequest = Object.keys(req.query).length === 0 || req.query.page || req.query.sort || Object.keys(req.query).some(k => k.startsWith('filter_'));
  if (isListRequest) {
    fetchStudentsTable(req, res, pool);
  } else {
    fetchStudent(req, res, pool);
  }
}

async function fetchStudent(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const pksValues = Object.values(req.query) as any[];
    const result = await pool.query('SELECT * FROM students WHERE numero_libreta = $1', pksValues);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function fetchSubjectsTable(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const { dataQuery, dataValues, countQuery, countValues } = buildListQuery('subjects', req.query, structure.tables.subjects.columns, 'cod_mat');
    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, dataValues),
      pool.query(countQuery, countValues)
    ]);
    res.json({ data: dataResult.rows, total: parseInt(countResult.rows[0].count) });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getSubjectsHandler(req: express.Request, res: express.Response, pool: Pool) {
  const isListRequest = Object.keys(req.query).length === 0 || req.query.page || req.query.sort || Object.keys(req.query).some(k => k.startsWith('filter_'));
  if (isListRequest) {
    fetchSubjectsTable(req, res, pool);
  } else {
    fetchSubject(req, res, pool);
  }
}

async function fetchSubject(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const pksValues = Object.values(req.query) as any[];
    const result = await pool.query('SELECT * FROM subjects WHERE cod_mat = $1', pksValues);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function fetchEnrollmentsTable(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const baseQuery = `
      SELECT e.*, s.first_name || ' ' || s.last_name as student_name, sub.name as subject_name
      FROM enrollments e
      JOIN students s ON e.numero_libreta = s.numero_libreta
      JOIN subjects sub ON e.cod_mat = sub.cod_mat
    `;
    const { dataQuery, dataValues, countQuery, countValues } = buildListQuery(baseQuery, req.query, structure.tables.enrollments.columns as Record<string, ColumnDef>, 'numero_libreta');
    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, dataValues),
      pool.query(countQuery, countValues)
    ]);
    res.json({ data: dataResult.rows, total: parseInt(countResult.rows[0].count) });
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getEnrollmentsHandler(req: express.Request, res: express.Response, pool: Pool) {
  const isListRequest = Object.keys(req.query).length === 0 || req.query.page || req.query.sort || Object.keys(req.query).some(k => k.startsWith('filter_'));
  if (isListRequest) {
    fetchEnrollmentsTable(req, res, pool);
  } else {
    fetchEnrollment(req, res, pool);
  }
}

async function fetchEnrollment(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const pksValues = Object.values(req.query) as any[];
    const result = await pool.query('SELECT * FROM enrollments WHERE numero_libreta = $1 AND cod_mat = $2', pksValues);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching enrollment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export { getStudentsHandler, getSubjectsHandler, getEnrollmentsHandler };