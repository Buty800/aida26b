// Main application file
// Code and comments in English
import {structure} from '@shared/ssot/structure';
import {TypeMap, MyTypeNames, ColumnDef, TableStructure, InferType, TableKey, TableRecordMap} from '@shared/types/types';
import {getPkFields} from '@shared/utils/utils';
import '../styles/style.css';

const API_BASE = '/api';

type Role = 'admin' | 'editor' | 'reader';
type AuthUser = {
  id: number;
  username: string;
  email: string | null;
  role: Role;
  is_active: boolean;
  must_change_password: boolean;
};





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


// DOM elements (derive nav buttons from `structure.tables` keys to avoid duplication)
const authSection = document.getElementById('auth-section') as HTMLElement;
const passwordSection = document.getElementById('password-section') as HTMLElement;
const appShell = document.getElementById('app-shell') as HTMLElement;
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const loginError = document.getElementById('login-error') as HTMLElement;
const passwordForm = document.getElementById('password-form') as HTMLFormElement;
const passwordError = document.getElementById('password-error') as HTMLElement;
const currentUserEl = document.getElementById('current-user') as HTMLElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
const statusMessage = document.getElementById('status-message') as HTMLElement;
const viewTitle = document.getElementById('view-title') as HTMLElement;
const addRecordBtn = document.getElementById('add-record-btn') as HTMLButtonElement;
const adminActions = document.getElementById('admin-actions') as HTMLElement;
const addTeacherBtn = document.getElementById('add-teacher-btn') as HTMLButtonElement;
const addAdminBtn = document.getElementById('add-admin-btn') as HTMLButtonElement;
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
  btn.textContent = cfg.title ?? cfg.uiName;
  navContainer.appendChild(btn);
  tableNavButtons[key] = btn;
  btn.addEventListener('click', () => showSection(key));
}

let activeTableKey: TableKey = tableKeys[0] as TableKey;
let currentUser: AuthUser | null = null;

function canWriteAcademic() {
  return currentUser?.role === 'admin' || currentUser?.role === 'editor';
}

function setMessage(message = '') {
  statusMessage.textContent = message;
  statusMessage.hidden = !message;
}

function showLogin(message = '') {
  currentUser = null;
  authSection.style.display = 'block';
  passwordSection.style.display = 'none';
  appShell.style.display = 'none';
  loginError.textContent = message;
  loginError.hidden = !message;
}

function showPasswordChange(user: AuthUser) {
  currentUser = user;
  authSection.style.display = 'none';
  passwordSection.style.display = 'block';
  appShell.style.display = 'none';
  passwordError.hidden = true;
}

function showApp(user: AuthUser) {
  if (user.must_change_password) {
    showPasswordChange(user);
    return;
  }

  currentUser = user;
  authSection.style.display = 'none';
  passwordSection.style.display = 'none';
  appShell.style.display = 'block';
  currentUserEl.textContent = `${user.username} (${user.role})`;
  showSection(activeTableKey);
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = options.body
    ? { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> | undefined) }
    : options.headers;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'same-origin' });

  if (response.status === 401) {
    showLogin('La sesión expiró / Session expired');
    throw new Error('Authentication required');
  }
  if (response.status === 403) {
    const data = await response.clone().json().catch(() => ({}));
    const message = data.error === 'Password change required'
      ? 'Hay que cambiar la contraseña / Password change required'
      : 'No tenés permiso para esa acción / You do not have permission for that action';
    setMessage(message);
    throw new Error(data.error || 'Forbidden');
  }

  return response;
}

function showSection(section: TableKey) {
  activeTableKey = section;
  setMessage();

  Object.entries(tableNavButtons).forEach(([key, button]) => {
    button.classList.toggle('active', key === section);
  });

  const tableConfig = structure.tables[section];
  viewTitle.textContent = tableConfig.title;
  addRecordBtn.textContent = tableConfig.addButtonLabel || `Agregar ${tableConfig.uiName} / Add ${tableConfig.uiName}`;
  addRecordBtn.style.display = canWriteAcademic() ? 'inline-block' : 'none';
  adminActions.hidden = currentUser?.role !== 'admin' || section !== 'students';
  hideAnyForm();
  loadTableData(section);
}

//Load 
async function loadTableData<K extends TableKey>(tableKey: K) {    
  try {
    const response = await apiFetch(`/${tableKey}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as TableRecordMap[K][];
    renderAnyTable(tableKey, data);
  } catch (error) {
    if ((error as Error).message !== 'Authentication required' && (error as Error).message !== 'Forbidden') {
      setMessage('Error cargando datos / Error loading data');
      console.error(`Error loading ${tableKey}:`, error);
    }
  }
}

function renderAnyTable<K extends TableKey>(tableKey: K, records: TableRecordMap[K][]) {
  const thead = sharedTable.querySelector('thead')!;
  const tbody = sharedTable.querySelector('tbody')!;
  const tableStructure = structure.tables[tableKey];
  const showActions = canWriteAcademic();
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const headerRow = document.createElement('tr');
  Object.values(tableStructure.columns).forEach((column) => {
    const th = document.createElement('th');
    th.textContent = column.label;
    headerRow.appendChild(th);
  });

  if (showActions) {
    const actionsHeader = document.createElement('th');
    actionsHeader.textContent = 'Acciones / Actions';
    headerRow.appendChild(actionsHeader);
  }
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

    if (showActions) {
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
        window.editRecord(tableKey, ...pkValues);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = 'Eliminar / Delete';
      deleteBtn.dataset.table = String(tableKey);
      deleteBtn.dataset.pk = editBtn.dataset.pk;
      deleteBtn.addEventListener('click', (e) => {
        const pkValues = JSON.parse((e.currentTarget as HTMLElement).dataset.pk || '[]');
        window.deleteRecord(tableKey, ...pkValues);
      });

      actionsTd.appendChild(editBtn);
      actionsTd.appendChild(deleteBtn);
      row.appendChild(actionsTd);
    }

    tbody.appendChild(row);
  });
}


addRecordBtn.addEventListener('click', () => showAnyForm(activeTableKey));


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

function appendPasswordField(form: HTMLFormElement, id: string, label: string) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-group';

  const labelEl = document.createElement('label');
  labelEl.htmlFor = id;
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);

  const input = document.createElement('input');
  input.id = id;
  input.type = 'password';
  input.minLength = 8;
  input.required = true;
  wrapper.appendChild(input);
  form.appendChild(wrapper);
}

function showUserForm(role: Exclude<Role, 'reader'>) {
  if (currentUser?.role !== 'admin') {
    setMessage('Solo admin puede crear usuarios / Only admin can create users');
    return;
  }

  const label = role === 'editor' ? 'Profesor / Professor' : 'Admin';
  formContainer.innerHTML = '';
  const form = document.createElement('form');
  const title = document.createElement('h3');
  title.textContent = `Agregar ${label} / Add ${label}`;
  form.appendChild(title);

  ['username', 'email'].forEach((field) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-group';
    const labelEl = document.createElement('label');
    labelEl.htmlFor = `user-${field}`;
    labelEl.textContent = field === 'username' ? 'Usuario / Username' : 'Email';
    wrapper.appendChild(labelEl);

    const input = document.createElement('input');
    input.id = `user-${field}`;
    input.type = field === 'email' ? 'email' : 'text';
    input.required = field === 'username';
    wrapper.appendChild(input);
    form.appendChild(wrapper);
  });
  appendPasswordField(form, 'user-password', 'Contraseña inicial / Initial Password');

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'form-actions';
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Agregar / Add';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cancel-btn';
  cancelBtn.textContent = 'Cancelar / Cancel';
  cancelBtn.addEventListener('click', hideAnyForm);
  actionsDiv.appendChild(submitBtn);
  actionsDiv.appendChild(cancelBtn);
  form.appendChild(actionsDiv);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = (document.getElementById('user-username') as HTMLInputElement).value.trim();
    const email = (document.getElementById('user-email') as HTMLInputElement).value.trim();
    const password = (document.getElementById('user-password') as HTMLInputElement).value;

    try {
      const response = await apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username, email, password, role }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      hideAnyForm();
      setMessage(`${label} agregado / ${label} added`);
    } catch (error) {
      if ((error as Error).message !== 'Authentication required' && (error as Error).message !== 'Forbidden') {
        setMessage('Error creando usuario / Error creating user');
        console.error('Error creating user:', error);
      }
    }
  });

  formContainer.appendChild(form);
  formContainer.style.display = 'block';
}

async function showAnyForm<K extends TableKey>(tableKey: K, record?: Partial<TableRecordMap[K]>): Promise<void> {
  if (!canWriteAcademic()) {
    setMessage('No tenés permiso para editar / You do not have edit permission');
    return;
  }

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
  if (tableKey === 'students' && !isEdit) {
    appendPasswordField(form, 'students-password', 'Contraseña inicial / Initial Password');
  }

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
    const payload = collectFormData(tableKey) as Record<string, unknown>;
    if (tableKey === 'students' && !isEdit) {
      payload.password = (document.getElementById('students-password') as HTMLInputElement).value;
    }

    const pkAndTheirValues = getPkFields(tableKey).map((pkFieldName) => [pkFieldName, String((payload as Record<string, unknown>)[pkFieldName])?? String((record as Record<string, unknown> | undefined)?.[pkFieldName]) ?? '']);
    const queryParams = new URLSearchParams(pkAndTheirValues).toString();

    try {
      const response = await apiFetch(`/${tableKey}?` + queryParams, {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      hideAnyForm();
      if (tableKey === 'students' && !isEdit) {
        setMessage('Alumno y usuario creados / Student and user created');
      }
      loadTableData(tableKey);
    } catch (error) {
      if ((error as Error).message !== 'Authentication required' && (error as Error).message !== 'Forbidden') {
        setMessage('Error guardando / Error saving');
        console.error(`Error saving ${tableConfig.uiName.toLowerCase()}:`, error);
      }
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
    const queryParams = new URLSearchParams(getPkFields(tableKey).map((pkFieldName, index) => [pkFieldName, pkValues[index]])).toString();
    const response = await apiFetch(`/${tableKey}?` + queryParams);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const record = (await response.json()) as TableRecordMap[K];
    showAnyForm(tableKey, record);
  } catch (error) {
    if ((error as Error).message !== 'Authentication required' && (error as Error).message !== 'Forbidden') {
      setMessage('Error cargando registro / Error loading record');
      console.error(`Error loading ${tableKey} for edit:`, error);
    }
  }
};
window.deleteRecord = async <K extends TableKey>(tableKey: K, ...pkValues: string[]) => {
  const tableConfig = structure.tables[tableKey];
  if (confirm(`¿Está seguro de que desea eliminar este ${tableConfig.uiName.toLowerCase()}? / Are you sure you want to delete this ${tableConfig.uiName.toLowerCase()}?`)) {
    try {
      const queryParams = new URLSearchParams(getPkFields(tableKey).map((pkFieldName, index) => [pkFieldName, pkValues[index]])).toString();
      const response = await apiFetch(`/${tableKey}?` + queryParams, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      loadTableData(tableKey);
    } catch (error) {
      if ((error as Error).message !== 'Authentication required' && (error as Error).message !== 'Forbidden') {
        setMessage('Error eliminando / Error deleting');
        console.error(`Error deleting ${tableKey}:`, error);
      }
    }
  }
};

const renderAnyMenuOption = (key:string) => {
  const cfg = structure.menu[key as keyof typeof structure.menu];
  const btn = document.createElement('button');
  btn.id = cfg.id;
  btn.textContent = cfg.title;
  btn.addEventListener('click', cfg.handler);
  menuContainer.appendChild(btn);
}

const showMenu = () => {
  menuKeys.forEach((key) => {renderAnyMenuOption(key)});
};

addTeacherBtn.addEventListener('click', () => showUserForm('editor'));
addAdminBtn.addEventListener('click', () => showUserForm('admin'));

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.hidden = true;

  const formData = new FormData(loginForm);
  const payload = {
    username: String(formData.get('username') ?? ''),
    password: String(formData.get('password') ?? ''),
  };

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      showLogin('Credenciales inválidas / Invalid credentials');
      return;
    }

    const data = await response.json() as { user: AuthUser };
    loginForm.reset();
    showApp(data.user);
  } catch (error) {
    showLogin('Error ingresando / Login error');
    console.error('Login error:', error);
  }
});

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  passwordError.hidden = true;

  const formData = new FormData(passwordForm);
  const payload = {
    current_password: String(formData.get('current_password') ?? ''),
    new_password: String(formData.get('new_password') ?? ''),
  };

  try {
    const response = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      passwordError.textContent = 'No se pudo cambiar la contraseña / Password change failed';
      passwordError.hidden = false;
      return;
    }

    const data = await response.json() as { user: AuthUser };
    passwordForm.reset();
    showApp(data.user);
  } catch (error) {
    passwordError.textContent = 'Error cambiando contraseña / Password change error';
    passwordError.hidden = false;
    console.error('Password change error:', error);
  }
});

logoutBtn.addEventListener('click', async () => {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'same-origin' });
  showLogin();
});

async function initialize() {
  showMenu();

  try {
    const response = await fetch(`${API_BASE}/auth/me`, { credentials: 'same-origin' });
    if (!response.ok) {
      showLogin();
      return;
    }

    const data = await response.json() as { user: AuthUser };
    showApp(data.user);
  } catch (error) {
    showLogin();
    console.error('Session check failed:', error);
  }
}

initialize();

export {};
