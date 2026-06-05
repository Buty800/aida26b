import type { Response, TableKey } from '../../shared/src/types/types';
import { getEntityName } from '../src/helpers';
import { fetchFullTable, deleteStudent, deleteEnrollment, deleteSubject, updateDBWithEnrollment, updateDBWithStudent, updateDBWithSubject } from './test_helpers';
import assert from 'node:assert';

export async function toGetAnEmptyTable(tableName: string){
    const response = await fetchFullTable(tableName);
    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.strictEqual(body.data.length, 0);
    assert.equal(Array.isArray(body.data), true);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.message, `${getEntityName(tableName as TableKey)}s fetched successfully`);
}

export async function studentUniqueInTableDeletedCorrectly(students: any){
    const response = await deleteStudent(students.numero_libreta);
    const body = await response.json();
    assert.strictEqual(response.status, 200);
    operationPerformedSuccesfully(body, 'students', students, 'deleted');
    await toGetAnEmptyTable('students');
}


export async function subjectUniqueInTableDeletedCorrectly(subject: any){
    const response = await deleteSubject(subject.cod_mat);
    const body = await response.json();
    assert.strictEqual(response.status, 200);
    operationPerformedSuccesfully(body, 'subjects', subject, 'deleted');
    await toGetAnEmptyTable('subjects');
}

export async function enrollmentUniqueInTableDeletedCorrectly(enrollment: any){
    const response = await deleteEnrollment(enrollment.numero_libreta, enrollment.cod_mat);
    const body = await response.json();
    assert.strictEqual(response.status, 200);
    operationPerformedSuccesfully(body, 'enrollments', enrollment, 'deleted');
    await toGetAnEmptyTable('enrollments');
}


export async function subjectInsertedToEmptyTableCorrectly(subject: any){
    await toGetAnEmptyTable('subjects');    
    let response = await updateDBWithSubject(subject.cod_mat, subject.name, subject.description, subject.credits, subject.department, false);
    assert.strictEqual(response.status, 201);
    let body = await response.json();
    assert.deepEqual(body.data, subject);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.message, 'Subject created successfully');
}

export async function enrollmentInsertedToEmptyTableCorrectly(enrollmentInserted: any, enrollmentResponse: any){
    await toGetAnEmptyTable('enrollments');    
    let response = await updateDBWithEnrollment(enrollmentInserted.numero_libreta, enrollmentInserted.cod_mat, enrollmentInserted.enrollment_date,enrollmentInserted.grade, enrollmentInserted.status, false);
    assert.strictEqual(response.status, 201);
    let body = await response.json();
    assert.deepEqual(body.data, enrollmentInserted);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.message, 'Enrollment created successfully');
    response = await fetchFullTable('enrollments');
    body = await response.json();
    tableOnlyContains(body, 'enrollments', enrollmentResponse);
}

export async function studentInsertedToEmptyTableCorrectly(student: any){
    await toGetAnEmptyTable('students');    
    let response = await updateDBWithStudent(student.numero_libreta, student.dni, student.first_name, student.last_name, student.email, student.enrollment_date, student.status, false);
    assert.strictEqual(response.status, 201);
    let body = await response.json();
    assert.deepEqual(body.data, student);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.message, 'Student created successfully');
    response = await fetchFullTable('students');
    body = await response.json();
    tableOnlyContains(body, 'students', student);
}

export async function operationPerformedSuccesfully(body: Response, tableName: TableKey, insertedElement: any, operationDone: string){
    assert.deepEqual(body.data, insertedElement);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.message, `${getEntityName(tableName)} ${operationDone} successfully`);
}

export function tableOnlyContains(body: Response, tableName: TableKey, insertedElement: any) {
    assert.equal(body.data.length, 1);
    assert.ok(Array.isArray(body.data));
    assert.deepEqual(body.data[0], insertedElement);
    assert.ok(body.success);
    assert.strictEqual(body.message, `${getEntityName(tableName)}s fetched successfully`);
}
