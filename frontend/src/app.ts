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
  title?: string
  addButtonLabel?: string
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
      uiName: 'Student',
      title: 'Alumnos / Students',
      addButtonLabel: 'Agregar Alumno / Add Student'
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
      uiName: 'Subject',
      title: 'Materias / Subjects',
      addButtonLabel: 'Agregar Materia / Add Subject'
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
      ,
        title: 'Inscripciones / Enrollments',
        addButtonLabel: 'Agregar Inscripción / Add Enrollment'
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

const viewTitle = document.getElementById('view-title') as HTMLElement;
const addRecordBtn = document.getElementById('add-record-btn') as HTMLButtonElement;
const formContainer = document.getElementById('record-form') as HTMLElement;
const sharedTable = document.getElementById('records-table') as HTMLTableElement;

const tableNavButtons: Record<TableKey, HTMLButtonElement> = {
  students: studentsBtn,
  subjects: subjectsBtn,
  enrollments: enrollmentsBtn,
};

let activeTableKey: TableKey = 'students';

// Navigation
studentsBtn.addEventListener('click', () => showSection('students'));
subjectsBtn.addEventListener('click', () => showSection('subjects'));
enrollmentsBtn.addEventListener('click', () => showSection('enrollments'));

function showSection(section: TableKey) {
  activeTableKey = section;

  Object.entries(tableNavButtons).forEach(([key, button]) => {
    button.classList.toggle('active', key === section);
  });

  const tableConfig = structure.tables[section];
  viewTitle.textContent = tableConfig.title;
  addRecordBtn.textContent = tableConfig.addButtonLabel || `Agregar ${tableConfig.uiName} / Add ${tableConfig.uiName}`;
  hideAnyForm();
  loadTableData(section);
}

//Load 
async function loadTableData(tableKey: TableKey) {    
  try {
    const response = await fetch(`${API_BASE}/${tableKey}`);
    let data = await response.json();
    renderAnyTable(tableKey, data);
  } catch (error) {
    console.error(`Error loading ${tableKey}:`, error);
  }
}

function renderAnyTable(tableKey: TableKey, records: Record<string, any>[]){
  const thead = sharedTable.querySelector('thead')!;
  const tbody = sharedTable.querySelector('tbody')!;
  const tableStructure = structure.tables[tableKey];
  thead.innerHTML = '';
  tbody.innerHTML = '';

  thead.innerHTML = `
    <tr>
      ${Object.values(tableStructure.columns)
        .map((column) => `<th>${column.label}</th>`)
        .join('')}
      <th>Acciones / Actions</th>
    </tr>
  `;

  records.forEach(record => {
    const { pk } = tableStructure;
    const pkFields = Array.isArray(pk) ? pk : [pk];
    const row = document.createElement('tr');

    // create data cells
    Object.entries(tableStructure.columns).forEach(([name]) => {
      const td = document.createElement('td');
      td.textContent = String((record as any)[name] ?? '');
      row.appendChild(td);
    });

    // actions cell with event listeners (avoid inline onclick/double-encoding)
    const actionsTd = document.createElement('td');
    actionsTd.className = 'actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = 'Editar / Edit';
    editBtn.dataset.table = String(tableKey);
    editBtn.dataset.pk = JSON.stringify(pkFields.map((field) => String((record as any)[field] ?? '')));
    editBtn.addEventListener('click', (e) => {
      const pkValues = JSON.parse((e.currentTarget as HTMLElement).dataset.pk || '[]');
      (window as any).editRecord(tableKey, ...pkValues);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Eliminar / Delete';
    deleteBtn.dataset.table = String(tableKey);
    deleteBtn.dataset.pk = editBtn.dataset.pk;
    deleteBtn.addEventListener('click', (e) => {
      const pkValues = JSON.parse((e.currentTarget as HTMLElement).dataset.pk || '[]');
      (window as any).deleteRecord(tableKey, ...pkValues);
    });

    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(deleteBtn);
    row.appendChild(actionsTd);

    tbody.appendChild(row);
  });
}


// Form functions
type TableKey = keyof typeof structure.tables;

addRecordBtn.addEventListener('click', () => showAnyForm(activeTableKey));

function getPkFields(tableKey: TableKey): string[] {
  const tableConfig = structure.tables[tableKey];
  return Array.isArray(tableConfig.pk) ? tableConfig.pk : [tableConfig.pk];
}

function getFieldElementId(tableKey: TableKey, fieldName: string): string {
  return `${tableKey}-${fieldName}`;
}


function renderFormField(tableKey: TableKey, fieldName: string, column: ColumnDef, record?: Record<string, any>, isEdit = false): string {
  const id = getFieldElementId(tableKey, fieldName);
  const label = column.label ?? '';
  const value = record?.[fieldName] ?? '';
  const requiredAttr = column.required ? 'required' : '';
  const readonlyAttr = isEdit && column.readonlyOnEdit ? 'readonly' : '';
  const inputType = column.input ? column.input : 'text';

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

function getRecordPath(recordValues: string[]): string {
  return `/${recordValues.map((value) => encodeURIComponent(value)).join('/')}`;
}

function hideAnyForm(): void {
  formContainer.style.display = 'none';
  formContainer.innerHTML = '';
}

async function showAnyForm(tableKey: TableKey, record?: Record<string, any>): Promise<void> {
  const tableConfig = structure.tables[tableKey];
  const isEdit = !!record;
  const formId = `${tableKey}-form`;

  const fieldsHtml = Object.entries(tableConfig.columns)
    .filter(([, column]) => column.editable !== false)
    .map(([fieldName, column]) => renderFormField(tableKey, fieldName, column, record, isEdit))
    .join('');

  formContainer.innerHTML = `
    <form id="${formId}">
      <h3>${isEdit ? `Editar ${tableConfig.uiName} / Edit ${tableConfig.uiName}` : `Agregar ${tableConfig.uiName} / Add ${tableConfig.uiName}`}</h3>
      ${fieldsHtml}
      <div class="form-actions">
        <button type="submit">${isEdit ? 'Actualizar / Update' : 'Agregar / Add'}</button>
        <button type="button" class="cancel-btn" onclick="hideAnyForm()">Cancelar / Cancel</button>
      </div>
    </form>
  `;

  formContainer.style.display = 'block';

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
      await fetch(`${API_BASE}/${tableKey}${pkPath}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      hideAnyForm();
      loadTableData(tableKey);
    } catch (error) {
      console.error(`Error saving ${tableConfig.uiName.toLowerCase()}:`, error);
    }
  });
}

(window as any).hideAnyForm = hideAnyForm;

// Global functions for onclick
(window as any).editRecord = async (tableKey: TableKey, ...pkValues: string[]) => {
  try {
    const response = await fetch(`${API_BASE}/${tableKey}${getRecordPath(pkValues)}`);
    const record = await response.json();
    showAnyForm(tableKey, record);
  } catch (error) {
    console.error(`Error loading ${tableKey} for edit:`, error);
  }
};

(window as any).deleteRecord = async (tableKey: TableKey, ...pkValues: string[]) => {
  const tableConfig = structure.tables[tableKey];
  if (confirm(`¿Está seguro de que desea eliminar este ${tableConfig.uiName.toLowerCase()}? / Are you sure you want to delete this ${tableConfig.uiName.toLowerCase()}?`)) {
    try {
      await fetch(`${API_BASE}/${tableKey}${getRecordPath(pkValues)}`, { method: 'DELETE' });
      loadTableData(tableKey);
    } catch (error) {
      console.error(`Error deleting ${tableKey}:`, error);
    }
  }
};

// Initialize
showSection('students');