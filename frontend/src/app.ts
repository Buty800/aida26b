// Main application file
// Code and comments in English

const API_BASE = '/api';



type TypeMap = {
  string: string;
  number: number;
  boolean: boolean;
  date: Date;
};

type MyTypeNames = keyof TypeMap;


type ColumnDef = {
  type: MyTypeNames;
  label?: string;
  input?: 'text' | 'email' | 'date' | 'number' | 'textarea' | 'select';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  editable?: boolean;
  readonlyOnEdit?: boolean;
  nullable?: boolean;
}

type TableStructure = {
  columns: Record<string, ColumnDef>
  pk: string | string[]
  uiName: string
  endpoint? : string
}

type InferType<FieldDefs extends Record<string, ColumnDef>> = {
  [K in keyof FieldDefs]: TypeMap[FieldDefs[K]['type']]
}


const structure = {
  tables: {
    students: {
      columns:{
        numero_libreta   :{type: 'string', label: "Número de Libreta / Student ID:", required: true, readonlyOnEdit: true},
        dni              :{type: 'string', label: 'DNI / ID Number:', required: true},
        first_name       :{type: 'string', label: 'Nombre / First Name:', required: true},
        last_name        :{type: 'string', label: 'Apellido / Last Name:', required: true},
        email            :{type: 'string', label: 'Email:', input: 'email'},
        enrollment_date  :{type: 'string', label: 'Fecha de Inscripción / Enrollment Date:', input: 'date'},
        status           :{type: 'string', label: 'Estado / Status:', input: 'select', options: [
          { value: 'active', label: 'Activo / Active' },
          { value: 'graduated', label: 'Graduado / Graduated' },
          { value: 'interrupted', label: 'Interrumpido / Interrupted' },
        ]},
      },
      pk: 'numero_libreta',
      uiName: 'Student'
    } satisfies TableStructure,
    subjects: {
      columns:{
        cod_mat     :{type: 'string', label: 'Código / Code:', required: true, readonlyOnEdit: true},
        name        :{type: 'string', label: 'Nombre / Name:', required: true},
        description :{type: 'string', label: 'Descripción / Description:', input: 'textarea'},
        credits     :{type: 'number', label: 'Créditos / Credits:', input: 'number', nullable: false},
        department  :{type: 'string', label: 'Departamento / Department:'},
      },
      pk: 'cod_mat',
      uiName: 'Subject'
    } satisfies TableStructure,
    enrollments: {
        pk: ['numero_libreta', 'cod_mat'],
        uiName: 'Enrollment',
        columns: {
          numero_libreta: { type: 'string', label: 'Número de Libreta / Student ID:', required: true, readonlyOnEdit: true },
          student_name: { type: 'string', label: 'Nombre del Alumno / Student Name:', editable: false },
          cod_mat: { type: 'string', label: 'Código de Materia / Subject Code:', required: true, readonlyOnEdit: true },
          subject_name: { type: 'string', label: 'Nombre de Materia / Subject Name:', editable: false },
          enrollment_date: { type: 'string', label: 'Fecha de Inscripción / Enrollment Date:', input: 'date', required: true },
          grade: { type: 'number', label: 'Nota / Grade:', input: 'number', nullable: true },
          status: { type: 'string', label: 'Estado / Status:', input: 'select', options: [
            { value: 'enrolled', label: 'Inscrito / Enrolled' },
            { value: 'completed', label: 'Completado / Completed' },
            { value: 'failed', label: 'Fallido / Failed' },
          ] }
        }
    } satisfies TableStructure
  }
}




type Student = InferType<typeof structure.tables.students.columns>;

type Subject = InferType<typeof structure.tables.subjects.columns>;

type Enrollment = InferType<typeof structure.tables.enrollments.columns>;

// DOM elements
const studentsBtn = document.getElementById('students-btn') as HTMLButtonElement;
const subjectsBtn = document.getElementById('subjects-btn') as HTMLButtonElement;
const enrollmentsBtn = document.getElementById('enrollments-btn') as HTMLButtonElement;

const studentsSection = document.getElementById('students-section') as HTMLElement;
const subjectsSection = document.getElementById('subjects-section') as HTMLElement;
const enrollmentsSection = document.getElementById('enrollments-section') as HTMLElement;

const addStudentBtn = document.getElementById('add-student-btn') as HTMLButtonElement;
const addSubjectBtn = document.getElementById('add-subject-btn') as HTMLButtonElement;
const addEnrollmentBtn = document.getElementById('add-enrollment-btn') as HTMLButtonElement;

const studentsForm = document.getElementById('students-form') as HTMLElement;
const subjectsForm = document.getElementById('subjects-form') as HTMLElement;
const enrollmentsForm = document.getElementById('enrollments-form') as HTMLElement;

const studentsTable = document.getElementById('students-table') as HTMLTableElement;
const subjectsTable = document.getElementById('subjects-table') as HTMLTableElement;
const enrollmentsTable = document.getElementById('enrollments-table') as HTMLTableElement;

// Navigation
studentsBtn.addEventListener('click', () => showSection('students'));
subjectsBtn.addEventListener('click', () => showSection('subjects'));
enrollmentsBtn.addEventListener('click', () => showSection('enrollments'));

function showSection(section: string) {
  // Hide all sections
  studentsSection.classList.remove('active');
  subjectsSection.classList.remove('active');
  enrollmentsSection.classList.remove('active');

  // Remove active class from buttons
  studentsBtn.classList.remove('active');
  subjectsBtn.classList.remove('active');
  enrollmentsBtn.classList.remove('active');

  // Show selected section
  switch (section) {
    case 'students':
      studentsSection.classList.add('active');
      studentsBtn.classList.add('active');
      loadStudents();
      break;
    case 'subjects':
      subjectsSection.classList.add('active');
      subjectsBtn.classList.add('active');
      loadSubjects();
      break;
    case 'enrollments':
      enrollmentsSection.classList.add('active');
      enrollmentsBtn.classList.add('active');
      loadEnrollments();
      break;
  }
}

//Load 
async function loadTableData(tableElement: HTMLTableElement, structureKey: keyof typeof structure.tables) {
  const tableConfig = structure.tables[structureKey] as any;
  const endpoint = tableConfig.endpoint || structureKey;
  try {
    const response = await fetch(`${API_BASE}/${endpoint}`);
    let data = await response.json();
    renderAnyTable(tableElement, tableConfig, data);
  } catch (error) {
    console.error(`Error loading ${endpoint}:`, error);
  }
}
const loadStudents = () => loadTableData(studentsTable, 'students');
const loadSubjects = () => loadTableData(subjectsTable, 'subjects');
const loadEnrollments = () => loadTableData(enrollmentsTable, 'enrollments');

function renderAnyTable(tableElement: HTMLTableElement, tableStructure: TableStructure, records: Record<string, any>[]){
  const tbody = tableElement.querySelector('tbody')!;
  tbody.innerHTML = '';

  records.forEach(record => {
    const {pk, uiName} = tableStructure;
    const pkFields = Array.isArray(pk) ? pk : [pk];
    const actionArgs = pkFields
      .map((field) => `'${encodeURIComponent(String(record[field] ?? ''))}'`)
      .join(', ');
    const row = document.createElement('tr');
    row.innerHTML = 
      Object.entries(tableStructure.columns).map(([name]) => `<td>${record[name] ?? ''}</td>`).join('')
      +
    `
      <td class="actions">
        <button class="edit-btn" onclick="edit${uiName}(${actionArgs})">Editar / Edit</button>
        <button class="delete-btn" onclick="delete${uiName}(${actionArgs})">Eliminar / Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Render table functions
function renderStudentsTable(students: Student[]) {
  console.log(`viendo los estudiantes que arrancan con ${students[0].first_name}`)
  return renderAnyTable(studentsTable, structure.tables.students, students);
}

function renderSubjectsTable(subjects: Subject[]) {
  return renderAnyTable(subjectsTable, structure.tables.subjects, subjects);
}

function renderEnrollmentsTable(enrollments: Enrollment[]) {
  return renderAnyTable(enrollmentsTable, structure.tables.enrollments, enrollments);}

// Form functions
type TableKey = keyof typeof structure.tables;

const formContainers: Record<TableKey, HTMLElement> = {
  students: studentsForm,
  subjects: subjectsForm,
  enrollments: enrollmentsForm,
};

const tableReloaders: Record<TableKey, () => void> = {
  students: loadStudents,
  subjects: loadSubjects,
  enrollments: loadEnrollments,
};

addStudentBtn.addEventListener('click', () => showAnyForm('students'));
addSubjectBtn.addEventListener('click', () => showAnyForm('subjects'));
addEnrollmentBtn.addEventListener('click', () => showAnyForm('enrollments'));

function toLabel(fieldName: string): string {
  return fieldName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getPkFields(tableKey: TableKey): string[] {
  const tableConfig = structure.tables[tableKey];
  return Array.isArray(tableConfig.pk) ? tableConfig.pk : [tableConfig.pk];
}

function getFieldElementId(tableKey: TableKey, fieldName: string): string {
  return `${tableKey}-${fieldName}`;
}

function getInputType(column: ColumnDef): string {
  if (column.input) return column.input;
  if (column.type === 'number') return 'number';
  return 'text';
}

function renderFormField(tableKey: TableKey, fieldName: string, column: ColumnDef, record?: Record<string, any>, isEdit = false): string {
  const id = getFieldElementId(tableKey, fieldName);
  const label = column.label || `${toLabel(fieldName)}:`;
  const value = record?.[fieldName] ?? '';
  const requiredAttr = column.required ? 'required' : '';
  const readonlyAttr = isEdit && column.readonlyOnEdit ? 'readonly' : '';
  const inputType = getInputType(column);

  if (inputType === 'textarea') {
    return `
      <div class="form-group">
        <label for="${id}">${label}</label>
        <textarea id="${id}" ${requiredAttr}>${value}</textarea>
      </div>
    `;
  }

  if (inputType === 'select' && column.options) {
    const options = column.options
      .map((option) => `<option value="${option.value}" ${String(value) === option.value ? 'selected' : ''}>${option.label}</option>`)
      .join('');
    return `
      <div class="form-group">
        <label for="${id}">${label}</label>
        <select id="${id}" ${requiredAttr}>
          ${options}
        </select>
      </div>
    `;
  }

  return `
    <div class="form-group">
      <label for="${id}">${label}</label>
      <input type="${inputType}" id="${id}" value="${value}" ${readonlyAttr} ${requiredAttr}>
    </div>
  `;
}

function collectFormData(tableKey: TableKey): Record<string, any> {
  const tableConfig = structure.tables[tableKey];
  const payload: Record<string, any> = {};

  Object.entries(tableConfig.columns)
    .filter(([, column]) => column.editable !== false)
    .forEach(([fieldName, column]) => {
      const id = getFieldElementId(tableKey, fieldName);
      const element = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      const rawValue = element?.value ?? '';

      if (column.type === 'number') {
        if (rawValue === '') {
          payload[fieldName] = column.nullable ? null : 0;
        } else {
          payload[fieldName] = Number(rawValue);
        }
        return;
      }

      payload[fieldName] = rawValue;
    });

  return payload;
}

function hideAnyForm(tableKey: TableKey): void {
  formContainers[tableKey].style.display = 'none';
}

async function showAnyForm(tableKey: TableKey, record?: Record<string, any>): Promise<void> {
  const tableConfig = structure.tables[tableKey];
  const isEdit = !!record;
  const endpoint = ('endpoint' in tableConfig && tableConfig.endpoint) ? tableConfig.endpoint : tableKey;
  const formId = `${tableKey}-form`;

  const fieldsHtml = Object.entries(tableConfig.columns)
    .filter(([, column]) => column.editable !== false)
    .map(([fieldName, column]) => renderFormField(tableKey, fieldName, column, record, isEdit))
    .join('');

  formContainers[tableKey].innerHTML = `
    <form id="${formId}">
      <h3>${isEdit ? `Editar ${tableConfig.uiName} / Edit ${tableConfig.uiName}` : `Agregar ${tableConfig.uiName} / Add ${tableConfig.uiName}`}</h3>
      ${fieldsHtml}
      <div class="form-actions">
        <button type="submit">${isEdit ? 'Actualizar / Update' : 'Agregar / Add'}</button>
        <button type="button" class="cancel-btn" onclick="hideAnyForm('${tableKey}')">Cancelar / Cancel</button>
      </div>
    </form>
  `;

  formContainers[tableKey].style.display = 'block';

  const form = document.getElementById(formId) as HTMLFormElement | null;
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = collectFormData(tableKey);

    const pkPath = isEdit
      ? `/${getPkFields(tableKey)
          .map((fieldName) => encodeURIComponent(String(payload[fieldName] ?? record?.[fieldName] ?? '')))
          .join('/')}`
      : '';

    try {
      await fetch(`${API_BASE}/${endpoint}${pkPath}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      hideAnyForm(tableKey);
      tableReloaders[tableKey]();
    } catch (error) {
      console.error(`Error saving ${tableConfig.uiName.toLowerCase()}:`, error);
    }
  });
}

function showStudentForm(student?: Student): void {
  showAnyForm('students', student as Record<string, any> | undefined);
}

function showSubjectForm(subject?: Subject): void {
  showAnyForm('subjects', subject as Record<string, any> | undefined);
}

function showEnrollmentForm(enrollment?: Enrollment): void {
  showAnyForm('enrollments', enrollment as Record<string, any> | undefined);
}

function hideStudentForm(): void {
  hideAnyForm('students');
}

function hideSubjectForm(): void {
  hideAnyForm('subjects');
}

function hideEnrollmentForm(): void {
  hideAnyForm('enrollments');
}

(window as any).hideAnyForm = hideAnyForm;

// Global functions for onclick
(window as any).editStudent = async (numero_libreta: string) => {
  try {
    const response = await fetch(`${API_BASE}/students/${numero_libreta}`);
    const student: Student = await response.json();
    showStudentForm(student);
  } catch (error) {
    console.error('Error loading student for edit:', error);
  }
};

(window as any).deleteStudent = async (numero_libreta: string) => {
  if (confirm('¿Está seguro de que desea eliminar este alumno? / Are you sure you want to delete this student?')) {
    try {
      await fetch(`${API_BASE}/students/${numero_libreta}`, { method: 'DELETE' });
      loadStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
    }
  }
};

(window as any).editSubject = async (cod_mat: string) => {
  try {
    const response = await fetch(`${API_BASE}/subjects/${cod_mat}`);
    const subject: Subject = await response.json();
    showSubjectForm(subject);
  } catch (error) {
    console.error('Error loading subject for edit:', error);
  }
};

(window as any).deleteSubject = async (cod_mat: string) => {
  if (confirm('¿Está seguro de que desea eliminar esta materia? / Are you sure you want to delete this subject?')) {
    try {
      await fetch(`${API_BASE}/subjects/${cod_mat}`, { method: 'DELETE' });
      loadSubjects();
    } catch (error) {
      console.error('Error deleting subject:', error);
    }
  }
};

(window as any).editEnrollment = async (numero_libreta: string, cod_mat: string) => {
  try {
    const response = await fetch(`${API_BASE}/enrollments/${numero_libreta}/${cod_mat}`);
    const enrollment: Enrollment = await response.json();
    showEnrollmentForm(enrollment);
  } catch (error) {
    console.error('Error loading enrollment for edit:', error);
  }
};

(window as any).deleteEnrollment = async (numero_libreta: string, cod_mat: string) => {
  if (confirm('¿Está seguro de que desea eliminar esta inscripción? / Are you sure you want to delete this enrollment?')) {
    try {
      await fetch(`${API_BASE}/enrollments/${numero_libreta}/${cod_mat}`, { method: 'DELETE' });
      loadEnrollments();
    } catch (error) {
      console.error('Error deleting enrollment:', error);
    }
  }
};

// Initialize
showSection('students');