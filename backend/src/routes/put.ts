import express from 'express';
import { Pool } from 'pg';
import { validateFullObject, sendErrorsIfInvalid } from '../validation/validate';

async function updateStudent(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const validated = validateFullObject('students', req.body);
    if (sendErrorsIfInvalid(res, validated)) return;
    const s = validated.data;
    const result = await pool.query(
      'UPDATE students SET dni = $1, first_name = $2, last_name = $3, email = $4, enrollment_date = $5, status = $6 WHERE numero_libreta = $7 RETURNING *',
      [s.dni, s.first_name, s.last_name, s.email, s.enrollment_date, s.status, s.numero_libreta]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateSubject(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const validated = validateFullObject('subjects', req.body);
    if (sendErrorsIfInvalid(res, validated)) return;
    const s = validated.data;
    const result = await pool.query(
      'UPDATE subjects SET name = $1, description = $2, credits = $3, department = $4 WHERE cod_mat = $5 RETURNING *',
      [s.name, s.description, s.credits, s.department, s.cod_mat]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateEnrollment(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const validated = validateFullObject('enrollments', req.body);
    if (sendErrorsIfInvalid(res, validated)) return;
    const e = validated.data;
    const result = await pool.query(
      'UPDATE enrollments SET enrollment_date = $1, grade = $2, status = $3 WHERE numero_libreta = $4 AND cod_mat = $5 RETURNING *',
      [e.enrollment_date, e.grade, e.status, e.numero_libreta, e.cod_mat]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating enrollment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export { updateStudent, updateSubject, updateEnrollment };
