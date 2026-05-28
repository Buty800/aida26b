import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fetchStudentsTable, fetchSubjectsTable, fetchEnrollmentsTable, fetchStudent, fetchSubject, fetchEnrollment } from './routes/get';
import { updateStudent, updateSubject, updateEnrollment } from './routes/put';
import { insertStudent, insertSubject, insertEnrollment } from './routes/post';
import { deleteStudent, deleteSubject, deleteEnrollment } from './routes/delete';



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

// Student routes
app.get('/api/students', async (req, res) => fetchStudentsTable(req, res, pool));

app.get('/api/students/:numero_libreta', async (req, res) => fetchStudent(req, res, pool));

app.post('/api/students', async (req, res) => insertStudent(req, res, pool));

app.put('/api/students/:numero_libreta', async (req, res) => updateStudent(req, res, pool));

app.delete('/api/students/:numero_libreta', async (req, res) => deleteStudent(req, res, pool));

// Subjects routes
app.get('/api/subjects', async (req, res) => fetchSubjectsTable(req, res, pool));

app.get('/api/subjects/:cod_mat', async (req, res) => fetchSubject(req, res, pool));

app.post('/api/subjects', async (req, res) => insertSubject(req, res, pool));

app.put('/api/subjects/:cod_mat', async (req, res) => updateSubject(req, res, pool));

app.delete('/api/subjects/:cod_mat', async (req, res) => deleteSubject(req, res, pool));

// Enrollments routes
app.get('/api/enrollments', async (req, res) => fetchEnrollmentsTable(req, res, pool));

app.get('/api/enrollments/:numero_libreta/:cod_mat', async (req, res) => fetchEnrollment(req, res, pool));

app.post('/api/enrollments', async (req, res) => insertEnrollment(req, res, pool));

app.put('/api/enrollments/:numero_libreta/:cod_mat', async (req, res) => updateEnrollment(req, res, pool));

app.delete('/api/enrollments/:numero_libreta/:cod_mat', async (req, res) => deleteEnrollment(req, res, pool));

// Serve static files from frontend dist
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Catch-all handler: send back index.html for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});