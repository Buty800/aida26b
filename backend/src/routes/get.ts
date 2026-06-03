import { Pool } from "pg";
import express from 'express';
import { validateOnlyPk, sendErrorsIfInvalid } from '../validation/validate';
import { getPkFields } from '../../../shared/src/utils/utils';
import type { TableKey } from '../../../shared/src/types/types';

// A request targets a single record only when every PK field is present in the query string.
function hasFullPk(table: TableKey, query: express.Request['query']): boolean {
  return getPkFields(table).every((field) => query[field] !== undefined);
}

async function fetchStudentsTable(req: express.Request, res: express.Response, pool: Pool)  {
  try {
    const result = await pool.query('SELECT * FROM students ORDER BY numero_libreta');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function getStudentsHandler(req: express.Request, res: express.Response, pool: Pool) {
  if (hasFullPk('students', req.query)){
    fetchStudent(req, res, pool);
  }
  else{
    fetchStudentsTable(req, res, pool);
  }
}

async function fetchStudent(req: express.Request, res: express.Response, pool: Pool)  {
  try {
    const pk = validateOnlyPk('students', req.query);
    if (sendErrorsIfInvalid(res, pk)) return;
    const result = await pool.query('SELECT * FROM students WHERE numero_libreta = $1', [pk.data.numero_libreta]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function fetchSubjectsTable(req: express.Request, res: express.Response, pool: Pool)  {
  try {
    const result = await pool.query('SELECT * FROM subjects ORDER BY cod_mat');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function getSubjectsHandler(req: express.Request, res: express.Response, pool: Pool) {
  if (hasFullPk('subjects', req.query)){
    fetchSubject(req, res, pool);
  }
  else{
    fetchSubjectsTable(req, res, pool);
  }
}


async function fetchSubject (req: express.Request, res: express.Response, pool: Pool)  {
  try {
    const pk = validateOnlyPk('subjects', req.query);
    if (sendErrorsIfInvalid(res, pk)) return;
    const result = await pool.query('SELECT * FROM subjects WHERE cod_mat = $1', [pk.data.cod_mat]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function fetchEnrollmentsTable(req: express.Request, res: express.Response, pool: Pool)  {
  try {
    const result = await pool.query(`
      SELECT e.*, s.first_name, s.last_name, sub.name as subject_name
      FROM enrollments e
      JOIN students s ON e.numero_libreta = s.numero_libreta
      JOIN subjects sub ON e.cod_mat = sub.cod_mat
      ORDER BY e.numero_libreta, e.cod_mat
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function getEnrollmentsHandler(req: express.Request, res: express.Response, pool: Pool) {
  if (hasFullPk('enrollments', req.query)){
    fetchEnrollment(req, res, pool);
  }
  else{
    fetchEnrollmentsTable(req, res, pool);
  }
}

async function fetchEnrollment(req: express.Request, res: express.Response, pool: Pool)  {
  try {
    const pk = validateOnlyPk('enrollments', req.query);
    if (sendErrorsIfInvalid(res, pk)) return;
    const result = await pool.query('SELECT * FROM enrollments WHERE numero_libreta = $1 AND cod_mat = $2', [pk.data.numero_libreta, pk.data.cod_mat]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching enrollment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export {getStudentsHandler, getSubjectsHandler, getEnrollmentsHandler};
