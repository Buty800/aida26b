// Main application file
// Code and comments in English

const API_BASE = '/api';
const storedLanguage = localStorage.getItem('language');
let currentLanguage: Language = isLanguage(storedLanguage) ? storedLanguage : 'es';

// Types
type TypeMap = {
  string: string;
  number: number;
  boolean: boolean;
  date: Date;
};

type MyTypeNames = keyof TypeMap;

type ColumnDef = {
  type: MyTypeNames;
  label?: LocalizedText
  input?: 'text' | 'email' | 'date' | 'number' | 'textarea' | 'select';
  options?: Array<{ value: string; label: LocalizedText }>;
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

type RendererFunc = <K extends TableKey>(props: RendererProps<K>) => HTMLElement;

const renderers: Record<'input'|'textarea'|'select', RendererFunc> = {
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
    (column.options || []).forEach((opt: { value: string; label: LocalizedText }) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent =  getLocalizedText(opt.label);
      if (String(record?.[fieldName] ?? '') === opt.value) o.selected = true;
      sel.appendChild(o);
    });
    return sel;
  }
};

type RendererKey = keyof typeof renderers;

function getRenderer<K extends TableKey>(key: RendererKey) {
  return renderers[key] as (props: RendererProps<K>) => HTMLElement;
}

function mapInputToRenderer(input?: ColumnDef['input']): RendererKey {
  if (!input) return 'input';
  if (input === 'textarea') return 'textarea';
  if (input === 'select') return 'select';
  return 'input';
}

type TableStructure = {
  columns: Record<string, ColumnDef>
  pk: string | string[]
  uiName: LocalizedText;
  title?: LocalizedText;
  addButtonLabel?: LocalizedText;
}

type InferType<FieldDefs extends Record<string, ColumnDef>> = {
  [K in keyof FieldDefs]: TypeMap[FieldDefs[K]['type']]
}

const structure = {
  tables: {
    students: {
      columns:{
        numero_libreta   :{type: 'string', label: { es: 'Número de Libreta', en: 'Student ID' }, required: true, readonlyOnEdit: true},
        dni              :{type: 'string', label: { es: 'DNI', en: 'ID Number' }, required: true},
        first_name       :{type: 'string', label: { es: 'Nombre', en: 'First Name' }, required: true},
        last_name        :{type: 'string', label: { es: 'Apellido', en: 'Last Name' }, required: true},
        email            :{type: 'string', label: { es: 'Email', en: 'Email' }, input: 'email'},
        enrollment_date  :{type: 'string', label: { es: 'Fecha de Inscripción', en: 'Enrollment Date' }, input: 'date'},
        status           :{type: 'string', label: { es: 'Estado', en: 'Status' }, input: 'select', options: [
          { value: 'active', label: { es: 'Activo', en: 'Active' } },
          { value: 'graduated', label: { es: 'Graduado', en: 'Graduated' } },
          { value: 'interrupted', label: { es: 'Interrumpido', en: 'Interrupted' } },
        ]},
      },
      pk: 'numero_libreta',
      uiName: { es: 'Alumno', en: 'Student' },
      title: { es: 'Alumnos', en: 'Students' },
      addButtonLabel: { es: 'Agregar Alumno', en: 'Add Student' }
    } satisfies TableStructure,
    subjects: {
      columns:{
        cod_mat     :{type: 'string', label: { es: 'Código', en: 'Code' }, required: true, readonlyOnEdit: true},
        name        :{type: 'string', label: { es: 'Nombre', en: 'Name' }, required: true},
        description :{type: 'string', label: { es: 'Descripción', en: 'Description' }, input: 'textarea'},
        credits     :{type: 'number', label: { es: 'Créditos', en: 'Credits' }, input: 'number', nullable: false},
        department  :{type: 'string', label: { es: 'Departamento', en: 'Department' }},
      },
      pk: 'cod_mat',
      uiName: { es: 'Materia', en: 'Subject' },
      title: { es: 'Materias', en: 'Subjects' },
      addButtonLabel: { es: 'Agregar Materia', en: 'Add Subject' }
    } satisfies TableStructure,
    enrollments: {
        pk: ['numero_libreta', 'cod_mat'],
        uiName: { es: 'Inscripción', en: 'Enrollment' },
        columns: {
          numero_libreta: { type: 'string', label: { es: 'Número de Libreta', en: 'Student ID' }, required: true, readonlyOnEdit: true },
          student_name: { type: 'string', label: { es: 'Nombre del Alumno', en: 'Student Name' }, editable: false },
          cod_mat: { type: 'string', label: { es: 'Código de Materia', en: 'Subject Code' }, required: true, readonlyOnEdit: true },
          subject_name: { type: 'string', label: { es: 'Nombre de Materia', en: 'Subject Name' }, editable: false },
          enrollment_date: { type: 'string', label: { es: 'Fecha de Inscripción', en: 'Enrollment Date' }, input: 'date', required: true },
          grade: { type: 'number', label: { es: 'Nota', en: 'Grade' }, input: 'number', nullable: true },
          status: { type: 'string', label: { es: 'Estado', en: 'Status' }, input: 'select', options: [
            { value: 'enrolled', label: { es: 'Inscrito', en: 'Enrolled' } },
            { value: 'completed', label: { es: 'Completado', en: 'Completed' } },
            { value: 'failed', label: { es: 'Fallido', en: 'Failed' } },
          ] }
        }
      ,
        title: { es: 'Inscripciones', en: 'Enrollments' },
        addButtonLabel: { es: 'Agregar Inscripción', en: 'Add Enrollment' }
      } satisfies TableStructure
  },
  menu: {
    theme: {
      title: { es: 'Tema', en: 'Theme' },
      id: 'theme-picker',
      handler: (value: string) => {
        document.body.setAttribute('data-theme', value);
        localStorage.setItem('theme', value);
      },
      options: [
        { value: 'light', label: { es: 'Claro', en: 'Light' } },
        { value: 'dark', label: { es: 'Oscuro', en: 'Dark' } }
      ],
      initial: () => localStorage.getItem('theme') || 'light'
    },
    language: {
      title: { es: 'Idioma', en: 'Language' },
      id: 'language-picker',
      handler: (value: string) => {
        setLanguage(value as Language);
        updateNavButtonsText();
        showSection(activeTableKey);
        if (menuContainer) {
          menuContainer.innerHTML = '';
          showMenu();
        }
        const appTitleEl = document.getElementById('app-title');
        if (appTitleEl) appTitleEl.textContent = getLocalizedText(structure.commonText.appTitle);
      },
      options: [
        { value: 'es', label: { es: 'Español', en: 'Spanish' } },
        { value: 'en', label: { es: 'Inglés', en: 'English' } }
      ],
      initial: () => getLanguage()
    }
  },
  commonText:{
    actions: { es: 'Acciones', en: 'Actions' },
    add: { es: 'Agregar', en: 'Add' },
    appTitle: { es: 'Sistema de Gestión Académica', en: 'Academic Management System' },
    cancel: { es: 'Cancelar', en: 'Cancel' },
    delete: { es: 'Eliminar', en: 'Delete' },
    edit: { es: 'Editar', en: 'Edit' },
    update: { es: 'Actualizar', en: 'Update' },
  } satisfies Record<string, LocalizedText>
}

type TableKey = keyof typeof structure.tables;

type TableRecordMap = {
  [T in keyof typeof structure.tables]: InferType<(typeof structure.tables)[T]['columns']>
};

// DOM elements (derive nav buttons from `structure.tables` keys to avoid duplication)
const viewTitle = document.getElementById('view-title') as HTMLElement;
const addRecordBtn = document.getElementById('add-record-btn') as HTMLButtonElement;
const formContainer = document.getElementById('record-form') as HTMLElement;
const sharedTable = document.getElementById('records-table') as HTMLTableElement;

const tableKeys = Object.keys(structure.tables) as TableKey[];
const menuKeys = Object.keys(structure.menu) as Array<keyof typeof structure.menu>;
const navContainer = document.getElementById('table-nav') as HTMLElement | null;
const menuContainer = document.getElementById('menu-nav') as HTMLElement | null;

if (!navContainer) throw new Error('Missing #table-nav element in DOM');
if (!menuContainer) throw new Error('Missing #menu-nav element in DOM');

const tableNavButtons = {} as Record<TableKey, HTMLButtonElement>;
for (const key of tableKeys) {
  const cfg = structure.tables[key];
  const btn = document.createElement('button');
  btn.id = `${key}-btn`;
  btn.textContent = getLocalizedText(cfg.title) ?? getLocalizedText(cfg.uiName) ?? key;
  navContainer.appendChild(btn);
  tableNavButtons[key] = btn;
  btn.addEventListener('click', () => showSection(key));
}

let activeTableKey: TableKey = tableKeys[0] as TableKey;

function updateNavButtonsText(): void {
  tableKeys.forEach((key) => {
    const cfg = structure.tables[key];
    const btn = tableNavButtons[key];
    btn.textContent = getLocalizedText(cfg.title) ?? getLocalizedText(cfg.uiName) ?? key;
  });
}

function showSection(section: TableKey) {
  activeTableKey = section;

  Object.entries(tableNavButtons).forEach(([key, button]) => {
    button.classList.toggle('active', key === section);
  });

  const tableConfig = structure.tables[section];
  viewTitle.textContent = getLocalizedText(tableConfig.title);
  addRecordBtn.textContent = getLocalizedText(tableConfig.addButtonLabel) || `Agregar ${getLocalizedText(tableConfig.uiName)} / Add ${getLocalizedText(tableConfig.uiName) }`;
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

  const headerRow = document.createElement('tr');
  Object.values(tableStructure.columns).forEach((column) => {
    const th = document.createElement('th');
    th.textContent = getLocalizedText(column.label);
    headerRow.appendChild(th);
  });

  const actionsHeader = document.createElement('th');
  actionsHeader.textContent = getLocalizedText(structure.commonText.actions);
  headerRow.appendChild(actionsHeader);
  thead.appendChild(headerRow);
  
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
    editBtn.textContent = getLocalizedText(structure.commonText.edit);
    editBtn.dataset.table = String(tableKey);
    editBtn.dataset.pk = JSON.stringify(pkFields.map((field) => String(record[field as keyof TableRecordMap[K]] ?? '')));
    editBtn.addEventListener('click', (e) => {
      const pkValues = JSON.parse((e.currentTarget as HTMLElement).dataset.pk || '[]');
      window.editRecord(tableKey, ...pkValues);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = getLocalizedText(structure.commonText.delete);
    deleteBtn.dataset.table = String(tableKey);
    deleteBtn.dataset.pk = editBtn.dataset.pk;
    deleteBtn.addEventListener('click', (e) => {
      const pkValues = JSON.parse((e.currentTarget as HTMLElement).dataset.pk || '[]');
      window.deleteRecord(tableKey, ...pkValues);
    });

    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(deleteBtn);
    row.appendChild(actionsTd);

    tbody.appendChild(row);
  });
}

//Form Logic
addRecordBtn.addEventListener('click', () => showAnyForm(activeTableKey, { onSaved: loadTableData }));

function getPkFields(tableKey: TableKey): string[] {
  const tableConfig = structure.tables[tableKey];
  return Array.isArray(tableConfig.pk) ? tableConfig.pk : [tableConfig.pk];
}

function getFieldElementId(tableKey: TableKey, fieldName: string): string {
  return `${tableKey}-${fieldName}`;
}

function renderFormField<K extends TableKey>(tableKey: K, fieldName: keyof TableRecordMap[K] & string, column: ColumnDef, record?: Partial<TableRecordMap[K]>, isEdit = false): HTMLElement {
  const id = getFieldElementId(tableKey, fieldName);
  const wrapper = document.createElement('div');
  wrapper.className = 'form-group';

  const labelEl = document.createElement('label');
  labelEl.htmlFor = id;
  labelEl.textContent = getLocalizedText(column.label);
  wrapper.appendChild(labelEl);
  const rendererKey = mapInputToRenderer(column.input);
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
        payload[fieldName as keyof TableRecordMap[K]] = (rawValue === ''
          ? column.nullable
            ? null
            : 0
          : Number(rawValue)) as TableRecordMap[K][keyof TableRecordMap[K]];
        return;
      }

      payload[fieldName as keyof TableRecordMap[K]] = rawValue as TableRecordMap[K][keyof TableRecordMap[K]];
    });

  return payload;
}

export function getRecordPath(recordValues: string[]): string {
  return `/${recordValues.map((value) => encodeURIComponent(value)).join('/')}`;
}

export function hideAnyForm(): void {
  formContainer.style.display = 'none';
  formContainer.innerHTML = '';
}

export async function showAnyForm<K extends TableKey>(
  tableKey: K,
  options: {
    record?: Partial<TableRecordMap[K]>;
    onSaved: (tableKey: K) => void;
  },
): Promise<void> {
  const { record, onSaved } = options;
  const tableConfig = structure.tables[tableKey];
  const isEdit = !!record;
  const formId = `${tableKey}-form`;

  const fields = Object.entries(tableConfig.columns)
    .filter(([, column]) => column.editable !== false)
    .map(([fieldName, column]) => renderFormField(tableKey, fieldName as keyof TableRecordMap[K] & string, column, record, isEdit));

  formContainer.innerHTML = '';
  const form = document.createElement('form');
  form.id = formId;

  const h3 = document.createElement('h3');
  h3.textContent = `${isEdit ? getLocalizedText(structure.commonText.edit) : getLocalizedText(structure.commonText.add)} ${getLocalizedText(tableConfig.uiName)}`;;
  form.appendChild(h3);
  fields.forEach((field) => form.appendChild(field));

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'form-actions';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = isEdit ? getLocalizedText(structure.commonText.update) : getLocalizedText(structure.commonText.add);;

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cancel-btn';
  cancelBtn.textContent = getLocalizedText(structure.commonText.cancel);
  cancelBtn.addEventListener('click', hideAnyForm);

  actionsDiv.appendChild(submitBtn);
  actionsDiv.appendChild(cancelBtn);
  form.appendChild(actionsDiv);
  formContainer.appendChild(form);
  formContainer.style.display = 'flex';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = collectFormData(tableKey);
    const recordValues = record as Record<string, unknown> | undefined;
    const pkPath = isEdit
      ? `/${getPkFields(tableKey)
          .map((fieldName) => encodeURIComponent(String((payload as Record<string, unknown>)[fieldName] ?? recordValues?.[fieldName] ?? '')))
          .join('/')}`
      : '';

    try {
      await fetch(`${API_BASE}/${tableKey}${pkPath}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      hideAnyForm();
      onSaved(tableKey);
    } catch (error) {
      console.error(`Error saving ${getLocalizedText(tableConfig.uiName).toLowerCase()}:`, error);
    }
  });
}

declare global {
  interface Window {
    hideAnyForm: () => void;
    editRecord: <K extends TableKey>(tableKey: K, ...pkValues: string[]) => Promise<void>;
    deleteRecord: <K extends TableKey>(tableKey: K, ...pkValues: string[]) => Promise<void>;
  }
}

// Global functions for onclick
window.hideAnyForm = hideAnyForm;

window.editRecord = async <K extends TableKey>(tableKey: K, ...pkValues: string[]) => {
  try {
    const response = await fetch(`${API_BASE}/${tableKey}${getRecordPath(pkValues)}`);
    const record = (await response.json()) as TableRecordMap[K];
    showAnyForm(tableKey, { record, onSaved: loadTableData });
  } catch (error) {
    console.error(`Error loading ${tableKey} for edit:`, error);
  }
};
window.deleteRecord = async <K extends TableKey>(tableKey: K, ...pkValues: string[]) => {
  const tableConfig = structure.tables[tableKey];
  if (confirm(`¿Está seguro de que desea eliminar este ${getLocalizedText(tableConfig.uiName).toLowerCase()}? / Are you sure you want to delete this ${getLocalizedText(tableConfig.uiName).toLowerCase()}?`)) {
    try {
      await fetch(`${API_BASE}/${tableKey}${getRecordPath(pkValues)}`, { method: 'DELETE' });
      loadTableData(tableKey);
    } catch (error) {
      console.error(`Error deleting ${tableKey}:`, error);
    }
  }
};

// Settings menu rendering and logic
type Language = 'es' | 'en';
type LocalizedText = Record<Language, string>;

const renderAnyMenuOption = (key:string) => {
  const cfg = structure.menu[key as keyof typeof structure.menu];
  if (!cfg.options) return;

  const selectEl = document.createElement('select');
  selectEl.id = cfg.id;
  selectEl.classList.add('picker');

  const initialValue =
    typeof cfg.initial === 'function'
      ? cfg.initial()
      : cfg.initial;

  cfg.options.forEach(opt => {
    const optionEl = document.createElement('option');

    optionEl.value = opt.value;
    optionEl.textContent = getLocalizedText(opt.label);

    if (opt.value === initialValue) {
      optionEl.selected = true;
    }

    selectEl.appendChild(optionEl);
  });

  selectEl.classList.add('picker');
  selectEl.addEventListener('change', (e) => {
    cfg.handler((e.target as HTMLSelectElement).value);
  });
  
  const wrapper = document.createElement('div');
  wrapper.className = 'picker-wrapper';
  const label = document.createElement('label');
  label.htmlFor = cfg.id;
  label.textContent = getLocalizedText(cfg.title);
  wrapper.appendChild(label);
  wrapper.appendChild(selectEl);
  menuContainer.appendChild(wrapper);  
};

const showMenu = () => {
  menuKeys.forEach((key) => {renderAnyMenuOption(key)});
};

function isLanguage(value: string | null): value is Language {
  return value === 'es' || value === 'en';
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(language: Language): void {
  currentLanguage = language;
  localStorage.setItem('language', language);
}

export function getLocalizedText(text?: LocalizedText): string {
  return text?.[currentLanguage] ?? '';
}

// Inicialización de tema y lenguaje
const initialTheme = localStorage.getItem('theme') || 'light';
document.body.setAttribute('data-theme', initialTheme);
const appTitleEl = document.getElementById('app-title');
if (appTitleEl) appTitleEl.textContent = getLocalizedText(structure.commonText.appTitle);

// Renderizado inicial de menú y sección
showSection(activeTableKey);
showMenu();

export {};