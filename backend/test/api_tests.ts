import * as asserts from './test_assertions.ts';
import * as test_objects from './test_objects';
import { updateDBWithEnrollment, updateDBWithStudent, updateDBWithSubject, fetchFullTable } from './test_helpers.ts';
import { createAppGivenPool } from '../src/app';
import { Pool } from 'pg';
import test from 'node:test';
import assert from 'node:assert';
import dotenv from 'dotenv';

const TESTS_PORT = 4000;
export const API_BASE = `http://localhost:${TESTS_PORT}/api`;

dotenv.config({path: '.env.tests'});
let server: any;

const testsPool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
})

test.before(async () => {    
    const app = createAppGivenPool(testsPool);
    server = app.listen(TESTS_PORT);
});

test.afterEach(async () => await clearDatabase());

test.after(async () => {
  testsPool.end();
  server.close();
});

test('GET /students of empty db returns Response object with success and correct message', async () => {
  try {
    await await asserts.toGetAnEmptyTable('students')
  } catch (error) {
        handleError(error);
  }
});

test('GET /subjects of empty db returns Response object with success and correct message', async () => {
  try {
    await asserts.toGetAnEmptyTable('subjects');
  } catch (error) {
        handleError(error);
  }
});

test('GET /enrollments of empty db returns Response object with success and correct message', async () => {
  try {
    await asserts.toGetAnEmptyTable('enrollments');
  } catch (error) {
        handleError(error);
  }
});

test('POST & GET /student to an empty db inserts student to db', async () => {
  try {
    await asserts.studentInsertedToEmptyTableCorrectly(test_objects.homeroSimpson);
    } 
    catch (error) {
        handleError(error);
  }
});

test('POST & GET /subject to an empty db inserts subject to db', async () => {
  try {
    await asserts.subjectInsertedToEmptyTableCorrectly(test_objects.ari);
  } catch (error) {
        handleError(error);
  }
});

test('POST & GET /enrollment to an empty db inserts enrollment to db', async () => {
  try {
    await asserts.studentInsertedToEmptyTableCorrectly(test_objects.homeroSimpson);
    await asserts.subjectInsertedToEmptyTableCorrectly(test_objects.ari);
    await asserts.enrollmentInsertedToEmptyTableCorrectly(test_objects.enrollmentHomeroAri, test_objects.enrollmentHomeroAriExpectedResponse);
  } catch (error) {
        handleError(error);
  }
});

test('DELETE /student', async () => {
  try {
    await asserts.studentInsertedToEmptyTableCorrectly(test_objects.homeroSimpson);
    await asserts.studentUniqueInTableDeletedCorrectly(test_objects.homeroSimpson);
  } catch (error) {
        handleError(error);
  }
});

test('DELETE /subject', async () => {
  try {
    await asserts.subjectInsertedToEmptyTableCorrectly(test_objects.ari);
    await asserts.subjectUniqueInTableDeletedCorrectly(test_objects.ari);
  } catch (error) {
        handleError(error);
  }
});

test('DELETE /enrollment', async () => {
  try {
    await asserts.studentInsertedToEmptyTableCorrectly(test_objects.homeroSimpson);
    await asserts.subjectInsertedToEmptyTableCorrectly(test_objects.ari);
    await asserts.enrollmentInsertedToEmptyTableCorrectly(test_objects.enrollmentHomeroAri, test_objects.enrollmentHomeroAriExpectedResponse);
    await asserts.enrollmentUniqueInTableDeletedCorrectly(test_objects.enrollmentHomeroAri);
  } catch (error) {
        handleError(error);
  }
});

test('PUT /student', async () => {
    try {
    await asserts.studentInsertedToEmptyTableCorrectly(test_objects.homeroSimpson);
    let response = await updateDBWithStudent(test_objects.homeroModified.numero_libreta, test_objects.homeroModified.dni, test_objects.homeroModified.first_name, test_objects.homeroModified.last_name, test_objects.homeroModified.email, test_objects.homeroModified.enrollment_date, test_objects.homeroModified.status, true);
    assert.strictEqual(response.status, 202);
    let body = await response.json();
    asserts.operationPerformedSuccesfully(body, 'students', test_objects.homeroModified, 'updated');
    response = await fetchFullTable('students');
    body = await response.json()
    asserts.tableOnlyContains(body, 'students', test_objects.homeroModified);
    } 
    catch (error) {
        handleError(error);
  }
});

test('PUT /subject', async () => {
  try {
    await asserts.subjectInsertedToEmptyTableCorrectly(test_objects.ari);
    let response = await updateDBWithSubject(test_objects.ariModified.cod_mat, test_objects.ariModified.name, test_objects.ariModified.description, test_objects.ariModified.credits, test_objects.ariModified.department, true);
    assert.strictEqual(response.status, 202);
    let body = await response.json();
    asserts.operationPerformedSuccesfully(body, 'subjects', test_objects.ariModified, 'updated');
    response = await fetchFullTable('subjects');
    body = await response.json();
    asserts.tableOnlyContains(body, 'subjects', test_objects.ariModified);
    } 
    catch (error) {
        handleError(error);
   }
});

test('PUT /enrollment', async () => {
  try {
    await test_objects.DBWithStudentAndSubject();
    await asserts.enrollmentInsertedToEmptyTableCorrectly(test_objects.enrollmentHomeroAri, test_objects.enrollmentHomeroAriExpectedResponse);
    let response = await updateDBWithEnrollment(test_objects.enrollmentHomeroAriModified.numero_libreta, test_objects.enrollmentHomeroAriModified.cod_mat, test_objects.enrollmentHomeroAriModified.enrollment_date,test_objects.enrollmentHomeroAriModified.grade, test_objects.enrollmentHomeroAriModified.status, true);
    assert.strictEqual(response.status, 202);
    let body = await response.json();
    asserts.operationPerformedSuccesfully(body, 'enrollments', test_objects.enrollmentHomeroAriModified, 'updated');
    response = await fetchFullTable('enrollments'); 
    body = await response.json();
    asserts.tableOnlyContains(body, 'enrollments', test_objects.enrollmentHomeroAriModifiedExpectedResponse);
    } 
    catch (error) {
        handleError(error);
  }
});

function handleError(error: unknown) {
    clearDatabase();
    console.log(error);
    throw error;
}

async function clearDatabase(){
    await testsPool.query(`TRUNCATE TABLE students, subjects, enrollments CASCADE`);
}