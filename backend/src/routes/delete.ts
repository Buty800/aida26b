import express from 'express';
import { Pool } from 'pg';
import { validateOnlyPk, sendErrorsIfInvalid } from '../validation/validate';

async function deleteStudent(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const pk = validateOnlyPk('students', req.query);
    if (sendErrorsIfInvalid(res, pk)) return;
    const result = await pool.query('DELETE FROM students WHERE numero_libreta = $1 RETURNING *', [pk.data.numero_libreta]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteSubject(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const pk = validateOnlyPk('subjects', req.query);
    if (sendErrorsIfInvalid(res, pk)) return;
    const result = await pool.query('DELETE FROM subjects WHERE cod_mat = $1 RETURNING *', [pk.data.cod_mat]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteEnrollment(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const pk = validateOnlyPk('enrollments', req.query);
    if (sendErrorsIfInvalid(res, pk)) return;
    const result = await pool.query('DELETE FROM enrollments WHERE numero_libreta = $1 AND cod_mat = $2 RETURNING *', [pk.data.numero_libreta, pk.data.cod_mat]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    res.json({ message: 'Enrollment deleted successfully' });
  } catch (error) {
    console.error('Error deleting enrollment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export { deleteStudent, deleteSubject, deleteEnrollment };
