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


type RendererProps<K extends TableKey> = {
  id: string;
  fieldName: keyof TableRecordMap[K] & string;
  column: ColumnDef;
  record?: Partial<TableRecordMap[K]>;
  isEdit?: boolean;
};

const renderers = {
  input<K extends TableKey>({ id, fieldName, column, record, isEdit }: RendererProps<K>) {
    const inp = document.createElement('input');
    inp.id = id;
    inp.type = column.input ?? (column.type === 'number' ? 'number' : 'text');
    if (column.required) inp.required = true;
    if (isEdit && column.readonlyOnEdit) inp.readOnly = true;
    (inp as HTMLInputElement).value = String(record?.[fieldName] ?? '');
    return inp;
  },
  textarea<K extends TableKey>({ id, fieldName, column, record }: RendererProps<K>) {
    const ta = document.createElement('textarea');
    ta.id = id;
    if (column.required) ta.required = true;
    (ta as HTMLTextAreaElement).value = String(record?.[fieldName] ?? '');
    return ta;
  },
  select<K extends TableKey>({ id, fieldName, column, record }: RendererProps<K>) {
    const sel = document.createElement('select');
    sel.id = id;
    if (column.required) sel.required = true;
    (column.options || []).forEach((opt: { value: string; label: string }) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (String(record?.[fieldName] ?? '') === opt.value) o.selected = true;
      sel.appendChild(o);
    });
    return sel;
  }
};

function getRenderer<K extends TableKey>(key: 'input' | 'textarea' | 'select') {
  return (renderers as any)[key] as (props: RendererProps<K>) => HTMLElement;
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




type TableKey = keyof typeof structure.tables;

type TableRecordMap = {
  students: InferType<typeof structure.tables.students.columns>;
  subjects: InferType<typeof structure.tables.subjects.columns>;
  enrollments: InferType<typeof structure.tables.enrollments.columns>;
};

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
async function loadTableData<K extends TableKey>(tableKey: K) {    
  try {
    const response = await fetch(`${API_BASE}/${tableKey}`);
    const data = (await response.json()) as TableRecordMap[K][];
    renderAnyTable(tableKey, data);
  } catch (error) {
    console.error(`Error loading ${tableKey}:`, error);
  }
}

function renderAnyTable<K extends TableKey>(tableKey: K, records: TableRecordMap[K][]) {
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

  records.forEach((record) => {
    const { pk } = tableStructure;
    const pkFields = Array.isArray(pk) ? pk : [pk];
    const row = document.createElement('tr');
    const columnNames = Object.keys(tableStructure.columns) as Array<keyof TableRecordMap[K] & string>;

    // create data cells
    columnNames.forEach((name) => {
      const td = document.createElement('td');
      td.textContent = String(record[name] ?? '');
      row.appendChild(td);
    });

    // actions cell with event listeners (avoid inline onclick/double-encoding)
    const actionsTd = document.createElement('td');
    actionsTd.className = 'actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = 'Editar / Edit';
    editBtn.dataset.table = String(tableKey);
    editBtn.dataset.pk = JSON.stringify(pkFields.map((field) => String(record[field as keyof TableRecordMap[K]] ?? '')));
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


addRecordBtn.addEventListener('click', () => showAnyForm(activeTableKey));

function getPkFields(tableKey: TableKey): string[] {
  const tableConfig = structure.tables[tableKey];
  return Array.isArray(tableConfig.pk) ? tableConfig.pk : [tableConfig.pk];
}

function getFieldElementId(tableKey: TableKey, fieldName: string): string {
  return `${tableKey}-${fieldName}`;
}


function renderFormField<K extends TableKey>(tableKey: K, fieldName: keyof TableRecordMap[K] & string, column: ColumnDef, record?: Partial<TableRecordMap[K]>, isEdit = false): HTMLElement {
  const id = getFieldElementId(tableKey, fieldName);
  const labelText = column.label ?? '';
  const wrapper = document.createElement('div');
  wrapper.className = 'form-group';

  const labelEl = document.createElement('label');
  labelEl.htmlFor = id;
  labelEl.textContent = labelText;
  wrapper.appendChild(labelEl);
  const rendererKey = (column.input === 'textarea' || column.input === 'select' ? column.input : 'input') as 'input' | 'textarea' | 'select';
  const renderer = getRenderer<K>(rendererKey);
  const inputEl = renderer({ id, fieldName, column, record, isEdit });
  wrapper.appendChild(inputEl);
  return wrapper;
}

function collectFormData<K extends TableKey>(tableKey: K): Partial<TableRecordMap[K]> {
  const tableConfig = structure.tables[tableKey];
  const payload: Partial<TableRecordMap[K]> = {};

  Object.entries(tableConfig.columns)
    .filter(([, column]) => column.editable !== false)
    .forEach(([fieldName, column]) => {
      const id = getFieldElementId(tableKey, fieldName);
      const element = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      const rawValue = element?.value ?? '';

      if (column.type === 'number') {
        if (rawValue === '') {
          payload[fieldName as keyof TableRecordMap[K]] = (column.nullable ? null : 0) as TableRecordMap[K][keyof TableRecordMap[K]];
        } else {
          payload[fieldName as keyof TableRecordMap[K]] = Number(rawValue) as TableRecordMap[K][keyof TableRecordMap[K]];
        }
        return;
      }

      payload[fieldName as keyof TableRecordMap[K]] = rawValue as TableRecordMap[K][keyof TableRecordMap[K]];
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

async function showAnyForm<K extends TableKey>(tableKey: K, record?: Partial<TableRecordMap[K]>): Promise<void> {
  const tableConfig = structure.tables[tableKey];
  const isEdit = !!record;
  const formId = `${tableKey}-form`;

  const fields = Object.entries(tableConfig.columns)
    .filter(([, column]) => column.editable !== false)
    .map(([fieldName, column]) => renderFormField(tableKey, fieldName as keyof TableRecordMap[K] & string, column, record, isEdit));

  // build form DOM
  formContainer.innerHTML = '';
  const form = document.createElement('form');
  form.id = formId;
  const h3 = document.createElement('h3');
  h3.textContent = isEdit ? `Editar ${tableConfig.uiName} / Edit ${tableConfig.uiName}` : `Agregar ${tableConfig.uiName} / Add ${tableConfig.uiName}`;
  form.appendChild(h3);
  fields.forEach((f) => form.appendChild(f));

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'form-actions';
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = isEdit ? 'Actualizar / Update' : 'Agregar / Add';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cancel-btn';
  cancelBtn.textContent = 'Cancelar / Cancel';
  cancelBtn.addEventListener('click', hideAnyForm);
  actionsDiv.appendChild(submitBtn);
  actionsDiv.appendChild(cancelBtn);
  form.appendChild(actionsDiv);

  formContainer.appendChild(form);
  formContainer.style.display = 'block';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = collectFormData(tableKey);

    const pkPath = isEdit
        ? `/${getPkFields(tableKey)
          .map((fieldName) => encodeURIComponent(String((payload as Record<string, unknown>)[fieldName] ?? (record as Record<string, unknown> | undefined)?.[fieldName] ?? '')))
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
(window as any).editRecord = async <K extends TableKey>(tableKey: K, ...pkValues: string[]) => {
  try {
    const response = await fetch(`${API_BASE}/${tableKey}${getRecordPath(pkValues)}`);
    const record = (await response.json()) as TableRecordMap[K];
    showAnyForm(tableKey, record);
  } catch (error) {
    console.error(`Error loading ${tableKey} for edit:`, error);
  }
};

(window as any).deleteRecord = async <K extends TableKey>(tableKey: K, ...pkValues: string[]) => {
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