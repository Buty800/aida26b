import { updateDBWithStudent, updateDBWithSubject } from "./test_helpers";

/*Test objects*/
const homeroSimpson = {numero_libreta: '1/23', dni: '123456789', first_name: 'Homero', last_name: 'Simpson', email: 'homeroSimpson@dc.uba.ar', enrollment_date: '2023-02-12T03:00:00.000Z', status: 'active'};

const homeroModified = {numero_libreta: '1/23', dni: '987654321', first_name: 'Homero', last_name: 'Simpson', email: 'homeroSimpson@dc.uba.ar', enrollment_date: '2026-02-12T03:00:00.000Z', status: 'graduated'};

const ari = {cod_mat: 'ARI1C26', name: 'Almacenamiento y Recuperación de la Información', description: 'Bases de datos para los amigos', credits: 0, department: 'DC'};

const ariModified = {cod_mat: 'ARI1C26', name: "Almacenamiento y Recuperación de la Información", description: 'Ex bases de datos.', credits: 0, department: 'DC'};

const enrollmentHomeroAri = {
    numero_libreta: homeroSimpson.numero_libreta,
    cod_mat: ari.cod_mat,
    enrollment_date:  '2023-02-11T03:00:00.000Z',
    grade: 0,
    status: 'enrolled'
}

const enrollmentHomeroAriExpectedResponse = {
    numero_libreta: '1/23',
  cod_mat: 'ARI1C26',
  student_name: 'Homero Simpson',
  subject_name: 'Almacenamiento y Recuperación de la Información',
  enrollment_date: '2023-02-11T03:00:00.000Z',
  grade: '0.00',
  status: 'enrolled'
}

const enrollmentHomeroAriModified = {
    numero_libreta: homeroSimpson.numero_libreta,
    cod_mat: ari.cod_mat,
    enrollment_date:  '2026-02-11T03:00:00.000Z',
    grade: 10,
    status: 'completed'
}

const enrollmentHomeroAriModifiedExpectedResponse = {
  numero_libreta: '1/23',
  cod_mat: 'ARI1C26',
  student_name: 'Homero Simpson',
  subject_name: 'Almacenamiento y Recuperación de la Información',
  enrollment_date: '2026-02-11T03:00:00.000Z',
  grade: 10,
  status: 'completed'
}

const DBWithStudentAndSubject = async () => {
    await updateDBWithStudent(homeroSimpson.numero_libreta, homeroSimpson.dni, homeroSimpson.first_name, homeroSimpson.last_name, homeroSimpson.email, homeroSimpson.enrollment_date, homeroSimpson.status, false);
    await updateDBWithSubject(ari.cod_mat, ari.name, ari.description, ari.credits, ari.department, false);
}

export { homeroSimpson, homeroModified, enrollmentHomeroAri, enrollmentHomeroAriExpectedResponse, enrollmentHomeroAriModified, enrollmentHomeroAriModifiedExpectedResponse, ari, ariModified, DBWithStudentAndSubject };