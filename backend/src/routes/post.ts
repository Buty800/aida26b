import express from 'express';
import { Pool } from 'pg';
import { validateFullObject, sendErrorsIfInvalid } from '../validation/validate';

async function insertStudent(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const validated = validateFullObject('students', req.body);
    if (sendErrorsIfInvalid(res, validated)) return;
    const s = validated.data;
    const result = await pool.query(
      'INSERT INTO students (numero_libreta, dni, first_name, last_name, email, enrollment_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [s.numero_libreta, s.dni, s.first_name, s.last_name, s.email, s.enrollment_date, s.status]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function insertSubject(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const validated = validateFullObject('subjects', req.body);
    if (sendErrorsIfInvalid(res, validated)) return;
    const s = validated.data;
    const result = await pool.query(
      'INSERT INTO subjects (cod_mat, name, description, credits, department) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [s.cod_mat, s.name, s.description, s.credits, s.department]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating subject:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function insertEnrollment(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const validated = validateFullObject('enrollments', req.body);
    if (sendErrorsIfInvalid(res, validated)) return;
    const e = validated.data;
    const result = await pool.query(
      'INSERT INTO enrollments (numero_libreta, cod_mat, enrollment_date, grade, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [e.numero_libreta, e.cod_mat, e.enrollment_date, e.grade, e.status]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating enrollment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export { insertStudent, insertSubject, insertEnrollment };
