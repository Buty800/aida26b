import { API_BASE } from './api_tests';

/*Helpers*/
async function fetchStudent(numero_libreta: string) {
    const queryParams = new URLSearchParams([['numero_libreta', numero_libreta]]).toString();
    try {
        return await fetch(`${API_BASE}/students?` + queryParams);
    } catch (error) {
        console.log(error);
        throw error;
    }
}

async function fetchSubject(cod_mat: string){
    const queryParams = new URLSearchParams([['cod_mat', cod_mat]]).toString();
    try {
        return await fetch(`${API_BASE}/subjects?` + queryParams);
    } catch (error) {
        console.log(error);
        throw error;
    }
}

async function fetchEnrollment(numero_libreta: string, cod_mat: string){
    const queryParams = new URLSearchParams([['numero_libreta', numero_libreta], ['cod_mat', cod_mat]]).toString();
    try {
        return await fetch(`${API_BASE}/enrollments?` + queryParams);
    } catch (error) {
        console.log(error);
        throw error;
    }
}

async function fetchFullTable(tableName: string){
    try {
        return await fetch(`${API_BASE}/${tableName}`);
    } catch (error) {
        console.log(error);
        throw error;
    }
}

async function updateDBWithStudent(numero_libreta: string, dni: string, first_name: string, last_name: string, email: string, enrollment_date: string, status: string, isEdit: boolean) {
    const requestBody = {numero_libreta: numero_libreta,
         dni: dni, 
         first_name: first_name,
         last_name: last_name,
         email: email, 
         enrollment_date: enrollment_date,
         status: status};
    const queryParams: string = new URLSearchParams([['numero_libreta', numero_libreta]]).toString();
    try {
        return await fetch(`${API_BASE}/students?` + queryParams, {
            method: isEdit ? 'PUT' : 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(requestBody),
        });
    } catch (error) {
        console.log(error);
        throw error;
    }
}

async function updateDBWithSubject(cod_mat: string, name: string, description: string, credits: number, department: string, isEdit: boolean) {
    const requestBody = {cod_mat: cod_mat, name: name, description: description, credits: credits, department: department};
    const queryParams: string = new URLSearchParams([['cod_mat', cod_mat]]).toString();
    try {
        return await fetch(`${API_BASE}/subjects?` + queryParams, {
            method: isEdit? 'PUT' : 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(requestBody),
        });
    } catch (error) {
        console.log(error);
        throw error;
    }}

async function updateDBWithEnrollment(numero_libreta: string, cod_mat: string, enrollment_date: string, grade: number, status: string, isEdit: boolean) {
    const requestBody = {numero_libreta: numero_libreta, cod_mat: cod_mat, enrollment_date: enrollment_date, grade: grade,status: status};
    
    const queryParams: string = new URLSearchParams([['numero_libreta', numero_libreta], ['cod_mat', cod_mat]]).toString();
    
    try {
        return await fetch(`${API_BASE}/enrollments?` + queryParams, {
            method: isEdit ? 'PUT' : 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(requestBody),
        });
    } catch (error) {
        console.log(error);
        throw error;
    }
}

async function deleteStudent(numero_libreta: string) {
    const queryParams: string = new URLSearchParams([['numero_libreta', numero_libreta]]).toString();
    try {
        return await fetch(`${API_BASE}/students?` + queryParams, {method: 'DELETE'});
    } catch (error) {
        console.log(error);
        throw error;
    }
}

async function deleteSubject(cod_mat: string) {
    const queryParams: string = new URLSearchParams([['cod_mat', cod_mat]]).toString();
    try {
        return await fetch(`${API_BASE}/subjects?` + queryParams, {method: 'DELETE'});
    } catch (error) {
        console.log(error);
        throw error;
    }}

async function deleteEnrollment(numero_libreta: string, cod_mat: string) {
    const queryParams: string = new URLSearchParams([['numero_libreta', numero_libreta], ['cod_mat', cod_mat]]).toString();
    try {
        return await fetch(`${API_BASE}/enrollments?` + queryParams, {method: 'DELETE'});
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export { updateDBWithEnrollment, updateDBWithStudent, updateDBWithSubject, fetchFullTable, deleteStudent, deleteEnrollment, deleteSubject };