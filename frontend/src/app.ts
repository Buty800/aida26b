// Main application file
// Code and comments in English
import { structure } from '@shared/ssot/structure';
import {
  Language,
  LocalizedText,
  ForeignKeyDef,
  ColumnDef,
  TableStructure,
  TableKey,
  TableRecordMap,
  RendererProps,
  RendererFunc,
  Response as ApiResponse,
} from '@shared/types/types';
import { getPkFields } from '@shared/utils/utils';
import { validateField } from '@shared/validation/validate';
import '../styles/styles.css';

const API_BASE = '/api';
const PAGE_SIZE = 20;

type Role = 'admin' | 'editor' | 'reader';

type AuthUser = {
  id: number;
  username: string;
  email: string | null;
  role: Role;
  is_active: boolean;
  must_change_password: boolean;
};

// -----------------------------------------------------------------------------
// Localization
// -----------------------------------------------------------------------------

const storedLanguage = localStorage.getItem('language');

function isLanguage(value: string | null): value is Language {
  return value === 'es' || value === 'en';
}

let currentLanguage: Language = isLanguage(storedLanguage) ? storedLanguage : 'es';

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(language: Language): void {
  currentLanguage = language;
  localStorage.setItem('language', language);
}

export function getLocalizedText(text?: LocalizedText | string): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[currentLanguage] ?? text.es ?? text.en ?? '';
}

// -----------------------------------------------------------------------------
// DOM elements
// -----------------------------------------------------------------------------

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
const addUserBtn = document.getElementById('add-user-btn') as HTMLButtonElement;

const formContainer = document.getElementById('record-form') as HTMLElement;
const sharedTable = document.getElementById('records-table') as HTMLTableElement;
const navContainer = document.getElementById('table-nav') as HTMLElement;
const menuContainer = document.getElementById('menu-nav') as HTMLElement;

const tableKeys = Object.keys(structure.tables) as TableKey[];
const menuKeys = Object.keys(structure.menu) as Array<keyof typeof structure.menu>;
const tableNavButtons = {} as Record<TableKey, HTMLButtonElement>;

// -----------------------------------------------------------------------------
// Auth/session state
// -----------------------------------------------------------------------------

let currentUser: AuthUser | null = null;

function canWriteAcademic(): boolean {
  return currentUser?.role === 'admin' || currentUser?.role === 'editor';
}

function setMessage(message = ''): void {
  statusMessage.textContent = message;
  statusMessage.hidden = !message;
}

function showLogin(message = ''): void {
  currentUser = null;

  authSection.style.display = 'block';
  passwordSection.style.display = 'none';
  appShell.style.display = 'none';

  loginError.textContent = message;
  loginError.hidden = !message;
}

function hideApplication() {
    appShell.style.display = "none";
    trackerShell.style.display = "none";
    passwordSection.style.display = "none";
}

function showPasswordChange(user: AuthUser): void {
  currentUser = user;

  authSection.style.display = 'none';
  passwordSection.style.display = 'block';
  appShell.style.display = 'none';

  passwordError.hidden = true;
}

function showApp(user: AuthUser): void {
  if (user.must_change_password) {
    showPasswordChange(user);
    return;
  }

  currentUser = user;

  authSection.style.display = 'none';
  passwordSection.style.display = 'none';

  renderRoute();
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<globalThis.Response> {
  const headers = options.body
    ? {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
      }
    : options.headers;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  if (response.status === 401) {
    showLogin(getLocalizedText(structure.commonText.sessionExpired));
    throw new Error('Authentication required');
  }

  if (response.status === 403) {
    const data = await response
      .clone()
      .json()
      .catch(() => ({} as { error?: string }));

    const message =
      data.error === 'Password change required'
        ? getLocalizedText(structure.commonText.passwordChangeRequired)
        : getLocalizedText(structure.commonText.noPermission);

    setMessage(message);
    throw new Error(data.error || 'Forbidden');
  }

  return response;
}

// -----------------------------------------------------------------------------
// UI feedback
// -----------------------------------------------------------------------------

function showSuccessMessage(message: string): void {
  if (!message) return;

  const outputContainer = document.querySelector('.successOutputInfoContainer');
  const outputText = document.querySelector('.successOutputInfo') as HTMLDivElement | null;

  if (!outputContainer || !outputText) return;

  if (outputContainer.classList.contains('invisible')) {
    outputText.textContent = message;
    outputContainer.classList.remove('invisible');

    setTimeout(() => {
      outputText.textContent = '';
      outputContainer.classList.add('invisible');
    }, 1500);
  }
}

function showErrorMessage(message: string): void {
  const dialog = document.createElement('dialog');
  dialog.classList.add('dialogErrorMessage');

  const dialogTitle = document.createElement('h1');
  dialogTitle.textContent = 'Error';

  const dialogMessage = document.createElement('p');
  dialogMessage.textContent = message;

  const closeButton = document.createElement('button');
  closeButton.textContent = 'Aceptar';
  closeButton.addEventListener('click', () => {
    dialog.close();
    dialog.remove();
  });

  dialog.addEventListener('click', (event) => {
    const dialogRect = dialog.getBoundingClientRect();

    if (
      event.clientX < dialogRect.left ||
      event.clientX > dialogRect.right ||
      event.clientY < dialogRect.top ||
      event.clientY > dialogRect.bottom
    ) {
      dialog.close();
      dialog.remove();
    }
  });

  appendChildren(dialog, [dialogTitle, dialogMessage, closeButton]);
  document.querySelector('.container')?.appendChild(dialog);
  dialog.setAttribute('closedby', 'any');
  dialog.showModal();
}

function appendChildren(element: HTMLElement, children: HTMLElement[]): void {
  children.forEach((child) => element.appendChild(child));
}

async function errorMessage(response: globalThis.Response): Promise<string> {
  try {
    const body = await response.json();

    if (body && typeof body.message === 'string') return body.message;
    if (body && typeof body.error === 'string') return body.error;

    if (body && Array.isArray(body.errors)) {
      return body.errors.join('\n');
    }
  } catch {
    // Response body was not JSON.
  }

  return `Error ${response.status}`;
}

// -----------------------------------------------------------------------------
// API helpers
// -----------------------------------------------------------------------------

function getRowsFromApiResult(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;

  if (
    result &&
    typeof result === 'object' &&
    Array.isArray((result as { data?: unknown }).data)
  ) {
    return (result as { data: unknown[] }).data;
  }

  return [];
}

async function fetchRows(path: string): Promise<unknown[]> {
  const response = await apiFetch(path);

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  const result = await response.json();
  return getRowsFromApiResult(result);
}

// -----------------------------------------------------------------------------
// Renderers
// -----------------------------------------------------------------------------

function toInputValue(column: ColumnDef, raw: unknown): string {
  if (raw == null) return '';
  if (column.input === 'date') return String(raw).slice(0, 10);
  return String(raw);
}

const renderers: Record<'input' | 'textarea' | 'select', RendererFunc> = {
  input<K extends TableKey>({
    id,
    fieldName,
    column,
    record,
    isEdit,
  }: RendererProps<K>) {
    const input = document.createElement('input');

    input.id = id;
    input.type = column.input ?? (column.type === 'number' ? 'number' : 'text');

    if (column.validator?.required) input.required = true;
    if (isEdit && column.readonlyOnEdit) input.readOnly = true;

    input.value = toInputValue(column, record?.[fieldName]);

    return input;
  },

  textarea<K extends TableKey>({
    id,
    fieldName,
    column,
    record,
  }: RendererProps<K>) {
    const textarea = document.createElement('textarea');

    textarea.id = id;

    if (column.validator?.required) textarea.required = true;

    textarea.value = String(record?.[fieldName] ?? '');

    return textarea;
  },

  select<K extends TableKey>({
    id,
    fieldName,
    column,
    record,
    isEdit,
  }: RendererProps<K>) {
    const select = document.createElement('select');

    select.id = id;

    if (isEdit && column.readonlyOnEdit) select.disabled = true;
    if (column.validator?.required) select.required = true;

    const blankOption = document.createElement('option');
    blankOption.value = '';
    blankOption.textContent = '--';
    select.appendChild(blankOption);

    (column.options || []).forEach((option) => {
      const optionEl = document.createElement('option');

      optionEl.value = option.value;
      optionEl.textContent = getLocalizedText(option.label as LocalizedText | string);

      if (String(record?.[fieldName] ?? '') === option.value) {
        optionEl.selected = true;
      }

      select.appendChild(optionEl);
    });

    return select;
  },
};

type RendererKey = keyof typeof renderers;

function getRenderer<K extends TableKey>(key: RendererKey) {
  return renderers[key] as (props: RendererProps<K>) => HTMLElement;
}

function mapInputToRenderer(input?: ColumnDef['input']): RendererKey {
  if (input === 'textarea') return 'textarea';
  if (input === 'select') return 'select';
  return 'input';
}

// -----------------------------------------------------------------------------
// Navigation and state
// -----------------------------------------------------------------------------

let activeTableKey: TableKey = tableKeys[0];

type FilterEntry = {
  negated: boolean;
  value?: string;
  min?: string;
  max?: string;
};

type TableState = {
  page: number;
  sort?: string;
  dir?: 'asc' | 'desc';
  filters: Record<string, FilterEntry[]>;
};

let currentState: TableState = {
  page: 1,
  filters: {},
};

function serializeFilterValue(fieldName: string, entry: FilterEntry): string | null {
  const column = (structure.tables[activeTableKey] as TableStructure).columns[fieldName];

  let value: string;

  if (column?.type === 'number') {
    value = `${entry.min ?? ''},${entry.max ?? ''}`;
    if (value === ',') return null;
  } else {
    value = entry.value ?? '';
    if (!value) return null;
  }

  return entry.negated ? `!${value}` : value;
}

function syncStateToUrl(): void {
  const params = new URLSearchParams();

  params.set('table', activeTableKey);
  params.set('page', String(currentState.page));

  if (currentState.sort) {
    params.set('sort', currentState.sort);
    params.set('dir', currentState.dir || 'asc');
  }

  for (const [fieldName, entries] of Object.entries(currentState.filters)) {
    for (const entry of entries) {
      const value = serializeFilterValue(fieldName, entry);

      if (value !== null) {
        params.append(`filter_${fieldName}`, value);
      }
    }
  }

  window.history.pushState({}, '', `?${params.toString()}`);
}

function syncUrlToState(): void {
  const params = new URLSearchParams(window.location.search);
  const table = params.get('table') as TableKey | null;

  if (table && structure.tables[table]) {
    activeTableKey = table;
  }

  currentState.page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
  currentState.sort = params.get('sort') || undefined;
  currentState.dir = (params.get('dir') as 'asc' | 'desc' | null) || undefined;
  currentState.filters = {};

  params.forEach((value, key) => {
    if (!key.startsWith('filter_')) return;

    const fieldName = key.slice(7);
    const column = (structure.tables[activeTableKey] as TableStructure).columns[fieldName];

    if (!column || !value) return;

    const negated = value.startsWith('!');
    const actualValue = negated ? value.slice(1) : value;
    const entry: FilterEntry = { negated };

    if (column.type === 'number') {
      const commaIdx = actualValue.indexOf(',');

      if (commaIdx >= 0) {
        entry.min = actualValue.slice(0, commaIdx);
        entry.max = actualValue.slice(commaIdx + 1);
      } else {
        entry.min = actualValue;
      }
    } else {
      entry.value = actualValue;
    }

    currentState.filters[fieldName] ??= [];
    currentState.filters[fieldName].push(entry);
  });
}

function setLocalizedElementText(id: string, text: LocalizedText | string): void {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = getLocalizedText(text);
  }
}

function applyStaticLanguageToUI(): void {
  document.documentElement.lang = currentLanguage;

  setLocalizedElementText('app-title', structure.commonText.appTitle);
  setLocalizedElementText('login-title', structure.commonText.login);
  setLocalizedElementText('login-username-label', structure.commonText.usernameLabel);
  setLocalizedElementText('login-password-label', structure.commonText.password);
  setLocalizedElementText('login-submit-btn', structure.commonText.login);
  setLocalizedElementText('password-title', structure.commonText.changePassword);
  setLocalizedElementText('current-password-label', structure.commonText.currentPassword);
  setLocalizedElementText('new-password-label', structure.commonText.newPassword);
  setLocalizedElementText('password-submit-btn', structure.commonText.update);
  setLocalizedElementText('logout-btn', structure.commonText.logout);
  setLocalizedElementText('add-user-btn', structure.commonText.addUser);
}

function updateNavButtonsText(): void {
  tableKeys.forEach((key) => {
    const config = structure.tables[key];
    const button = tableNavButtons[key];

    if (!button) return;

    button.textContent =
      getLocalizedText(config.title) || getLocalizedText(config.uiName) || key;
  });
}

function createTableNavButtons(): void {
  navContainer.innerHTML = '';

  for (const key of tableKeys) {
    const config = structure.tables[key];
    const button = document.createElement('button');

    button.id = `${key}-btn`;
    button.textContent =
      getLocalizedText(config.title) || getLocalizedText(config.uiName) || key;

    button.addEventListener('click', () => showSection(key));

    navContainer.appendChild(button);
    tableNavButtons[key] = button;
  }
}

function resetStateForTable(tableKey: TableKey): void {
  currentState = {
    page: 1,
    filters: {},
  };

  const config = structure.tables[tableKey];
  const pkField = Array.isArray(config.pk) ? config.pk[0] : config.pk;
  const pkColumn = (config.columns as Record<string, ColumnDef>)[pkField];

  if (!pkColumn) return;

  currentState.filters[pkField] = [
    pkColumn.type === 'number'
      ? { negated: false, min: '', max: '' }
      : { negated: false, value: '' },
  ];
}

function showSection(section: TableKey, pushState = true): void {
  if (activeTableKey !== section && pushState) {
    resetStateForTable(section);
  }

  activeTableKey = section;
  setMessage();

  if (pushState) {
    syncStateToUrl();
  }

  Object.entries(tableNavButtons).forEach(([key, button]) => {
    button.classList.toggle('active', key === section);
  });

  const tableConfig = structure.tables[section];

  viewTitle.textContent = getLocalizedText(tableConfig.title);

  addRecordBtn.textContent =
    getLocalizedText(tableConfig.addButtonLabel) ||
    `${getLocalizedText(structure.commonText.add)} ${getLocalizedText(tableConfig.uiName)}`;

  addRecordBtn.style.display = canWriteAcademic() ? 'inline-block' : 'none';

  if (adminActions) {
    adminActions.hidden = currentUser?.role !== 'admin';
  }

  hideAnyForm();
  renderFilters(section);
  loadTableData(section);
}

window.addEventListener('popstate', () => {
  if (window.location.pathname === '/panel') {
    syncUrlToState();

    if (currentUser && !currentUser.must_change_password) {
      showSection(activeTableKey, false);
    }
  } else {
    renderRoute();
  }
});

// -----------------------------------------------------------------------------
// Menu
// -----------------------------------------------------------------------------

function renderAnyMenuOption(key: keyof typeof structure.menu): void {
  const config = structure.menu[key];

  if (!config.options) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'picker-wrapper';

  const label = document.createElement('label');
  label.htmlFor = config.id;
  label.textContent = getLocalizedText(config.title);

  const select = document.createElement('select');
  select.id = config.id;
  select.classList.add('picker');

  const initialValue =
    typeof config.initial === 'function' ? config.initial() : config.initial;

  config.options.forEach((option) => {
    const optionEl = document.createElement('option');

    optionEl.value = option.value;
    optionEl.textContent = getLocalizedText(option.label);

    if (option.value === initialValue) {
      optionEl.selected = true;
    }

    select.appendChild(optionEl);
  });

  select.addEventListener('change', (event) => {
    const value = (event.target as HTMLSelectElement).value;

    (config.handler as (value: string) => void)(value);

    if (key === 'language' && isLanguage(value)) {
      setLanguage(value);
      applyLanguageToUI();
    }
  });

  wrapper.appendChild(label);
  wrapper.appendChild(select);
  menuContainer.appendChild(wrapper);
}

function showMenu(): void {
  menuContainer.innerHTML = '';
  menuKeys.forEach((key) => renderAnyMenuOption(key));
}

function applyLanguageToUI(): void {
  applyStaticLanguageToUI();
  updateNavButtonsText();
  showMenu();

  if (currentUser && !currentUser.must_change_password) {
    showSection(activeTableKey, false);
  }
}

window.addEventListener('languagechange', (event) => {
  const language = (event as CustomEvent<{ language?: string }>).detail?.language;

  if (isLanguage(language ?? null)) {
    setLanguage(language as Language);
    applyLanguageToUI();
  }
});

// -----------------------------------------------------------------------------
// Table rendering
// -----------------------------------------------------------------------------

const filterContainer = document.createElement('div');
filterContainer.className = 'filter-container';
filterContainer.style.display = 'flex';
filterContainer.style.gap = '10px';
filterContainer.style.flexWrap = 'wrap';
filterContainer.style.marginBottom = '15px';

const paginationContainer = document.createElement('div');
paginationContainer.className = 'pagination-container';
paginationContainer.style.marginTop = '15px';
paginationContainer.style.display = 'flex';
paginationContainer.style.gap = '10px';
paginationContainer.style.alignItems = 'center';

const tableWrapper = sharedTable.closest('.table-wrapper') || sharedTable;
tableWrapper.parentNode?.insertBefore(filterContainer, tableWrapper);
tableWrapper.parentNode?.insertBefore(paginationContainer, tableWrapper.nextSibling);

function renderAnyTable<K extends TableKey>(
  tableKey: K,
  records: TableRecordMap[K][]
): void {
  const thead = sharedTable.querySelector('thead')!;
  const tbody = sharedTable.querySelector('tbody')!;
  const tableStructure = structure.tables[tableKey];
  const showActions = canWriteAcademic();

  thead.innerHTML = '';
  tbody.innerHTML = '';

  const headerRow = document.createElement('tr');

  Object.entries(tableStructure.columns).forEach(([fieldName, column]) => {
    const th = document.createElement('th');

    th.textContent = getLocalizedText(column.label as LocalizedText | string) || fieldName;
    th.className = 'sortable';
    th.title = 'Click to sort';

    if (currentState.sort === fieldName) {
      th.classList.add(currentState.dir === 'desc' ? 'sorted-desc' : 'sorted-asc');
    }

    th.addEventListener('click', () => {
      if (currentState.sort === fieldName) {
        currentState.dir = currentState.dir === 'asc' ? 'desc' : 'asc';
      } else {
        currentState.sort = fieldName;
        currentState.dir = 'asc';
      }

      currentState.page = 1;
      syncStateToUrl();
      loadTableData(tableKey);
    });

    headerRow.appendChild(th);
  });

  if (showActions) {
    const actionsHeader = document.createElement('th');
    actionsHeader.textContent = getLocalizedText(structure.commonText.actions);
    headerRow.appendChild(actionsHeader);
  }

  thead.appendChild(headerRow);

  records.forEach((record) => {
    const pkFields = Array.isArray(tableStructure.pk)
      ? tableStructure.pk
      : [tableStructure.pk];

    const row = document.createElement('tr');
    const columnNames = Object.keys(tableStructure.columns) as Array<
      keyof TableRecordMap[K] & string
    >;

    columnNames.forEach((name) => {
      const td = document.createElement('td');
      td.className = name;
      const val = String(record[name] ?? '');
      td.textContent = val;
      if (val.length > 20) {
        td.title = val;
      }
      row.appendChild(td);
    });

    if (showActions) {
      const actionsTd = document.createElement('td');
      actionsTd.className = 'actions';

      const pkValues = pkFields.map((field) =>
        String(record[field as keyof TableRecordMap[K]] ?? '')
      );

      const editBtn = document.createElement('button');
      editBtn.className = 'edit-btn';
      editBtn.textContent = getLocalizedText(structure.commonText.edit);
      editBtn.dataset.pk = JSON.stringify(pkValues);
      editBtn.addEventListener('click', (event) => {
        const values = JSON.parse(
          (event.currentTarget as HTMLElement).dataset.pk || '[]'
        );
        window.editRecord(tableKey, ...values);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = getLocalizedText(structure.commonText.delete);
      deleteBtn.dataset.pk = JSON.stringify(pkValues);
      deleteBtn.addEventListener('click', (event) => {
        const values = JSON.parse(
          (event.currentTarget as HTMLElement).dataset.pk || '[]'
        );
        window.deleteRecord(tableKey, ...values);
      });

      actionsTd.appendChild(editBtn);
      actionsTd.appendChild(deleteBtn);
      row.appendChild(actionsTd);
    }

    tbody.appendChild(row);
  });
}

async function loadTableData<K extends TableKey>(tableKey: K): Promise<void> {
  try {
    const params = new URLSearchParams();

    params.set('page', String(currentState.page));

    if (currentState.sort) {
      params.set('sort', currentState.sort);
      params.set('dir', currentState.dir || 'asc');
    }

    for (const [fieldName, entries] of Object.entries(currentState.filters)) {
      for (const entry of entries) {
        const value = serializeFilterValue(fieldName, entry);

        if (value !== null) {
          params.append(`filter_${fieldName}`, value);
        }
      }
    }

    const response = await apiFetch(`/${tableKey}?${params.toString()}`);

    if (!response.ok) {
      return showErrorMessage(await errorMessage(response));
    }

    const result = await response.json();
    const data = (result.data ?? getRowsFromApiResult(result)) as TableRecordMap[K][];
    const total = Number(result.total ?? data.length);

    renderAnyTable(tableKey, data);
    renderPagination(total);

    if (result.message) {
      showSuccessMessage(result.message);
    }
  } catch (error) {
    const message = (error as Error).message;

    if (message !== 'Authentication required' && message !== 'Forbidden') {
      setMessage(getLocalizedText(structure.commonText.errorLoadingData));
      console.error(`Error loading ${tableKey}:`, error);
    }
  }
}

function renderPagination(total: number): void {
  paginationContainer.innerHTML = '';

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  const info = document.createElement('span');
  info.textContent = `${getLocalizedText(structure.commonText.pageInfo)} ${currentState.page} ${getLocalizedText(structure.commonText.pageOf)} ${totalPages} (${getLocalizedText(structure.commonText.total)}: ${total})`;
  paginationContainer.appendChild(info);

  const prevBtn = document.createElement('button');
  prevBtn.textContent = getLocalizedText(structure.commonText.previous);
  prevBtn.disabled = currentState.page <= 1;
  prevBtn.addEventListener('click', () => {
    if (currentState.page > 1) {
      currentState.page--;
      syncStateToUrl();
      loadTableData(activeTableKey);
    }
  });
  paginationContainer.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.textContent = getLocalizedText(structure.commonText.next);
  nextBtn.disabled = currentState.page >= totalPages;
  nextBtn.addEventListener('click', () => {
    if (currentState.page < totalPages) {
      currentState.page++;
      syncStateToUrl();
      loadTableData(activeTableKey);
    }
  });
  paginationContainer.appendChild(nextBtn);
}

// -----------------------------------------------------------------------------
// Filters
// -----------------------------------------------------------------------------

function getFilterType(column: ColumnDef): 'string' | 'number' | 'enum' {
  if (column.type === 'number') return 'number';
  if (column.input === 'select' && column.options) return 'enum';
  return 'string';
}

function createFilterControl(
  entry: FilterEntry,
  column: ColumnDef,
  onChange: () => void
): HTMLElement {
  if (column.type === 'number') {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '4px';

    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.placeholder = 'Min';
    minInput.value = entry.min ?? '';
    minInput.style.width = '80px';
    minInput.addEventListener('change', () => {
      entry.min = minInput.value;
      onChange();
    });

    const separator = document.createElement('span');
    separator.textContent = '—';

    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.placeholder = 'Max';
    maxInput.value = entry.max ?? '';
    maxInput.style.width = '80px';
    maxInput.addEventListener('change', () => {
      entry.max = maxInput.value;
      onChange();
    });

    container.appendChild(minInput);
    container.appendChild(separator);
    container.appendChild(maxInput);

    return container;
  }

  if (column.input === 'select' && column.options) {
    const select = document.createElement('select');

    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '--';
    select.appendChild(blank);

    for (const option of column.options) {
      const optionEl = document.createElement('option');

      optionEl.value = option.value;
      optionEl.textContent = getLocalizedText(option.label as LocalizedText | string);

      if (entry.value === option.value) {
        optionEl.selected = true;
      }

      select.appendChild(optionEl);
    }

    select.addEventListener('change', () => {
      entry.value = select.value || undefined;
      onChange();
    });

    return select;
  }

  const input = document.createElement('input');

  input.type = 'text';
  input.placeholder = getLocalizedText(structure.commonText.filterPlaceholder);
  input.value = entry.value ?? '';
  input.style.width = '150px';

  input.addEventListener('change', () => {
    entry.value = input.value || undefined;
    onChange();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;

    event.preventDefault();
    entry.value = input.value || undefined;
    onChange();
  });

  return input;
}

function renderFilters<K extends TableKey>(tableKey: K): void {
  filterContainer.innerHTML = '';

  const tableStructure = structure.tables[tableKey];
  const allColumns = Object.entries(tableStructure.columns);

  const addBar = document.createElement('div');
  addBar.style.marginBottom = '10px';
  addBar.style.display = 'flex';
  addBar.style.gap = '8px';
  addBar.style.alignItems = 'center';

  const addBtn = document.createElement('button');
  addBtn.textContent = `+ ${getLocalizedText(structure.commonText.addFilter)}`;
  addBtn.className = 'add-btn';
  addBtn.style.marginBottom = '0';

  const addDropdown = document.createElement('select');
  addDropdown.style.display = 'none';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = `-- ${getLocalizedText(structure.commonText.selectColumn)} --`;
  addDropdown.appendChild(placeholder);

  allColumns.forEach(([fieldName, column]) => {
    const option = document.createElement('option');

    option.value = fieldName;
    option.textContent =
      getLocalizedText(column.label as LocalizedText | string) || fieldName;

    addDropdown.appendChild(option);
  });

  addBtn.addEventListener('click', () => {
    addDropdown.style.display =
      addDropdown.style.display === 'none' ? 'inline-block' : 'none';
  });

  addDropdown.addEventListener('change', () => {
    const fieldName = addDropdown.value;

    addDropdown.value = '';
    addDropdown.style.display = 'none';

    if (!fieldName) return;

    const column = (tableStructure.columns as Record<string, ColumnDef>)[fieldName];

    if (!column) return;

    const entry: FilterEntry =
      column.type === 'number'
        ? { negated: false, min: '', max: '' }
        : { negated: false, value: '' };

    currentState.filters[fieldName] ??= [];
    currentState.filters[fieldName].push(entry);
    currentState.page = 1;

    syncStateToUrl();
    renderFilters(tableKey);
    loadTableData(tableKey);
  });

  addBar.appendChild(addBtn);
  addBar.appendChild(addDropdown);
  filterContainer.appendChild(addBar);

  for (const [fieldName, entries] of Object.entries(currentState.filters)) {
    entries.forEach((entry, idx) => {
      const column = (tableStructure.columns as Record<string, ColumnDef>)[fieldName];

      if (!column) return;

      const row = document.createElement('div');
      row.className = 'filter-row';

      if (entry.negated) {
        row.classList.add('negated');
      }

      const columnDropdown = document.createElement('select');
      columnDropdown.className = 'filter-col-select';

      allColumns.forEach(([candidateFieldName, candidateColumn]) => {
        const option = document.createElement('option');

        option.value = candidateFieldName;
        option.textContent =
          getLocalizedText(candidateColumn.label as LocalizedText | string) ||
          candidateFieldName;

        if (candidateFieldName === fieldName) {
          option.selected = true;
        }

        columnDropdown.appendChild(option);
      });

      columnDropdown.addEventListener('change', () => {
        const newField = columnDropdown.value;

        if (newField === fieldName) return;

        const newColumn = (tableStructure.columns as Record<string, ColumnDef>)[newField];

        if (!newColumn) return;

        const oldType = getFilterType(column);
        const newType = getFilterType(newColumn);

        if (oldType !== newType) {
          entry.value = undefined;
          entry.min = undefined;
          entry.max = undefined;
        }

        if (newColumn.type === 'number') {
          if (entry.value) {
            entry.min = entry.value;
            entry.value = undefined;
          }
        } else if (entry.min !== undefined) {
          entry.value = entry.min;
          entry.min = undefined;
          entry.max = undefined;
        }

        currentState.filters[newField] ??= [];
        currentState.filters[newField].push(entry);
        currentState.filters[fieldName].splice(idx, 1);

        if (currentState.filters[fieldName].length === 0) {
          delete currentState.filters[fieldName];
        }

        currentState.page = 1;

        syncStateToUrl();
        renderFilters(tableKey);
        loadTableData(tableKey);
      });

      const onChange = () => {
        currentState.page = 1;
        syncStateToUrl();
        loadTableData(tableKey);
      };

      const negBtn = document.createElement('button');
      negBtn.textContent = 'NOT';
      negBtn.className = 'negate-btn';
      negBtn.title = 'Toggle negation';

      if (entry.negated) {
        negBtn.classList.add('active');
      }

      negBtn.addEventListener('click', () => {
        entry.negated = !entry.negated;
        currentState.page = 1;

        syncStateToUrl();
        renderFilters(tableKey);
        loadTableData(tableKey);
      });

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '✕';
      removeBtn.className = 'remove-filter-btn';
      removeBtn.title = 'Remove filter';
      removeBtn.addEventListener('click', () => {
        currentState.filters[fieldName].splice(idx, 1);

        if (currentState.filters[fieldName].length === 0) {
          delete currentState.filters[fieldName];
        }

        currentState.page = 1;

        syncStateToUrl();
        renderFilters(tableKey);
        loadTableData(tableKey);
      });

      row.appendChild(columnDropdown);
      row.appendChild(createFilterControl(entry, column, onChange));
      row.appendChild(negBtn);
      row.appendChild(removeBtn);
      filterContainer.appendChild(row);
    });
  }
}

// -----------------------------------------------------------------------------
// Form logic
// -----------------------------------------------------------------------------

addRecordBtn.addEventListener('click', () => showAnyForm(activeTableKey));

function getFieldElementId(tableKey: TableKey, fieldName: string): string {
  return `${tableKey}-${fieldName}`;
}

function coerceFieldValue(column: ColumnDef, rawValue: string): unknown {
  if (column.type === 'number') {
    return rawValue === '' ? null : Number(rawValue);
  }

  return rawValue;
}

function showFieldValidation(
  tableKey: TableKey,
  fieldName: string,
  column: ColumnDef
): string | undefined {
  const id = getFieldElementId(tableKey, fieldName);
  const element = document.getElementById(id) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | null;

  const errorEl = document.getElementById(`${id}-error`);
  const message = validateField(
    tableKey,
    fieldName,
    coerceFieldValue(column, element?.value ?? '')
  );

  if (errorEl) {
    errorEl.textContent = message ?? '';
  }

  element?.classList.toggle('invalid', !!message);

  return message;
}

function validateForm<K extends TableKey>(tableKey: K): boolean {
  return Object.entries(structure.tables[tableKey].columns)
    .filter(([, column]) => column.editable !== false)
    .map(([fieldName, column]) => showFieldValidation(tableKey, fieldName, column))
    .every((message) => !message);
}

function appendPasswordField(form: HTMLFormElement, id: string, label: string): void {
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

async function renderFormField<K extends TableKey>(
  tableKey: K,
  fieldName: keyof TableRecordMap[K] & string,
  column: ColumnDef,
  record?: Partial<TableRecordMap[K]>,
  isEdit = false
): Promise<HTMLElement> {
  const id = getFieldElementId(tableKey, fieldName);
  const wrapper = document.createElement('div');

  wrapper.className = 'form-group';

  const labelEl = document.createElement('label');
  labelEl.htmlFor = id;
  labelEl.textContent =
    getLocalizedText(column.label as LocalizedText | string) || fieldName;

  wrapper.appendChild(labelEl);

  await loadDefaultOptions(column);

  const rendererKey = mapInputToRenderer(column.input);
  const renderer = getRenderer<K>(rendererKey);
  const inputEl = renderer({ id, fieldName, column, record, isEdit });

  wrapper.appendChild(inputEl);

  const errorEl = document.createElement('small');
  errorEl.className = 'field-error';
  errorEl.id = `${id}-error`;
  wrapper.appendChild(errorEl);

  inputEl.addEventListener('blur', () => {
    showFieldValidation(tableKey, fieldName, column);
  });

  inputEl.addEventListener('input', () => {
    if (errorEl.textContent) {
      showFieldValidation(tableKey, fieldName, column);
    }
  });

  return wrapper;
}

function getForeignKeyLabel(row: Record<string, unknown>, foreignKey: ForeignKeyDef): string {
  const labelField = foreignKey.labelField;

  if (row[labelField] != null) {
    return String(row[labelField]);
  }

  // Supports simple SQL-like labels such as:
  // first_name || ' ' || last_name
  if (labelField.includes('||')) {
    return labelField
      .split('||')
      .map((part) => part.trim())
      .map((part) => {
        const quoted = part.match(/^['"](.*)['"]$/);
        if (quoted) return quoted[1];

        return String(row[part] ?? '');
      })
      .join('');
  }

  return String(row[foreignKey.valueField] ?? '');
}

async function loadDefaultOptions(column: ColumnDef): Promise<void> {
  const foreignKey = column.foreignKey;

  if (!foreignKey || foreignKey.dependsOn) return;

  const rows = await fetchRows(`/${foreignKey.table}?page=1`);

  column.options = rows.map((row) => {
    const record = row as Record<string, unknown>;
    const value = String(record[foreignKey.valueField] ?? '');

    return {
      value,
      label: `${value} - ${getForeignKeyLabel(record, foreignKey)}`,
    };
  }) as any;
}

function setupDependentSelects<K extends TableKey>(
  tableKey: K,
  record?: Partial<TableRecordMap[K]>
): void {
  const tableConfig = structure.tables[tableKey];

  for (const [fieldName, column] of Object.entries(tableConfig.columns)) {
    const foreignKey = column.foreignKey;

    if (!foreignKey?.dependsOn) continue;

    const childId = getFieldElementId(tableKey, fieldName);
    const parentId = getFieldElementId(tableKey, foreignKey.dependsOn.field);
    const childSelect = document.getElementById(childId) as HTMLSelectElement | null;
    const parentSelect = document.getElementById(parentId) as HTMLSelectElement | null;

    if (!childSelect || !parentSelect) continue;

    loadDependentOptions(
      parentSelect,
      childSelect,
      foreignKey,
      fieldName as keyof TableRecordMap[K],
      record
    );

    parentSelect.addEventListener('change', () => {
      loadDependentOptions(
        parentSelect,
        childSelect,
        foreignKey,
        fieldName as keyof TableRecordMap[K],
        record
      );
    });
  }
}

async function loadDependentOptions<K extends TableKey>(
  parentSelect: HTMLSelectElement,
  childSelect: HTMLSelectElement,
  foreignKey: ForeignKeyDef,
  fieldName: keyof TableRecordMap[K],
  record?: Partial<TableRecordMap[K]>
): Promise<void> {
  if (!foreignKey.dependsOn) return;

  const parentValue = parentSelect.value;

  childSelect.innerHTML = '';

  if (!parentValue) return;

  try {
    const rows = await fetchRows(
      `/${foreignKey.table}?filter_${foreignKey.dependsOn.foreignField}=${encodeURIComponent(parentValue)}`
    );

    rows.forEach((row) => {
      const recordRow = row as Record<string, unknown>;
      const value = String(recordRow[foreignKey.valueField] ?? '');

      const option = document.createElement('option');
      option.value = value;
      option.textContent = `${value} - ${getForeignKeyLabel(recordRow, foreignKey)}`;
      childSelect.appendChild(option);
    });

    const currentValue = record?.[fieldName];

    if (currentValue != null) {
      childSelect.value = String(currentValue);
    }
  } catch (error) {
    console.error('Error loading dependent options:', error);
  }
}

async function resolveDependingForeignKeys<K extends TableKey>(
  tableKey: K,
  record?: Partial<TableRecordMap[K]>
): Promise<void> {
  if (!record) return;

  const tableConfig = structure.tables[tableKey];

  for (const [fieldName, column] of Object.entries(tableConfig.columns)) {
    const foreignKey = column.foreignKey;

    if (!foreignKey?.dependsOn) continue;

    const childValue = (record as Record<string, unknown>)[fieldName];

    if (childValue == null) continue;

    try {
      const queryParams = new URLSearchParams([
        [foreignKey.valueField, String(childValue)],
      ]).toString();

      const response = await apiFetch(`/${foreignKey.table}?${queryParams}`);

      if (!response.ok) continue;

      const responseJson: ApiResponse = await response.json();
      const foreignRecord = responseJson.data as Record<string, unknown> | undefined;

      if (!foreignRecord) continue;

      (record as Record<string, unknown>)[foreignKey.dependsOn.field] =
        foreignRecord[foreignKey.dependsOn.foreignField];
    } catch (error) {
      console.error('Error resolving dependent foreign key:', error);
    }
  }
}

function collectFormData<K extends TableKey>(
  tableKey: K
): Partial<TableRecordMap[K]> {
  const tableConfig = structure.tables[tableKey];
  const payload: Partial<TableRecordMap[K]> = {};

  Object.entries(tableConfig.columns)
    .filter(([, column]) => column.editable !== false)
    .forEach(([fieldName, column]) => {
      const id = getFieldElementId(tableKey, fieldName);
      const element = document.getElementById(id) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | null;

      payload[fieldName as keyof TableRecordMap[K]] = coerceFieldValue(
        column,
        element?.value ?? ''
      ) as TableRecordMap[K][keyof TableRecordMap[K]];
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

function showUserForm(): void {
  if (currentUser?.role !== 'admin') {
    setMessage(getLocalizedText(structure.commonText.onlyAdminCanCreateUsers));
    return;
  }

  formContainer.innerHTML = '';

  const form = document.createElement('form');

  const title = document.createElement('h3');
  title.textContent = getLocalizedText(structure.commonText.addUser);
  form.appendChild(title);

  ['username', 'email'].forEach((field) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-group';

    const labelEl = document.createElement('label');
    labelEl.htmlFor = `user-${field}`;
    labelEl.textContent = field === 'username' ? getLocalizedText(structure.commonText.usernameLabel) : getLocalizedText(structure.commonText.emailLabel);
    wrapper.appendChild(labelEl);

    const input = document.createElement('input');
    input.id = `user-${field}`;
    input.type = field === 'email' ? 'email' : 'text';
    input.required = field === 'username';
    wrapper.appendChild(input);

    form.appendChild(wrapper);
  });

  const roleWrapper = document.createElement('div');
  roleWrapper.className = 'form-group';

  const roleLabelEl = document.createElement('label');
  roleLabelEl.htmlFor = 'user-role';
  roleLabelEl.textContent = getLocalizedText(structure.commonText.roleLabel);
  roleWrapper.appendChild(roleLabelEl);

  const roleSelect = document.createElement('select');
  roleSelect.id = 'user-role';
  roleSelect.required = true;

  const roles: Array<{ value: Role; label: LocalizedText }> = [
    { value: 'admin', label: structure.commonText.adminRole },
    { value: 'editor', label: structure.commonText.editorRole },
    { value: 'reader', label: structure.commonText.readerRole },
  ];

  roles.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = r.value;
    opt.textContent = getLocalizedText(r.label);
    roleSelect.appendChild(opt);
  });

  roleWrapper.appendChild(roleSelect);
  form.appendChild(roleWrapper);

  appendPasswordField(form, 'user-password', getLocalizedText(structure.commonText.initialPassword));

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'form-actions';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = getLocalizedText(structure.commonText.add);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cancel-btn';
  cancelBtn.textContent = getLocalizedText(structure.commonText.cancel);
  cancelBtn.addEventListener('click', hideAnyForm);

  actionsDiv.appendChild(submitBtn);
  actionsDiv.appendChild(cancelBtn);
  form.appendChild(actionsDiv);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = (document.getElementById('user-username') as HTMLInputElement).value.trim();
    const email = (document.getElementById('user-email') as HTMLInputElement).value.trim();
    const password = (document.getElementById('user-password') as HTMLInputElement).value;
    const role = (document.getElementById('user-role') as HTMLSelectElement).value;

    try {
      const response = await apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username, email, password, role }),
      });

      if (!response.ok) {
        return showErrorMessage(await errorMessage(response));
      }

      hideAnyForm();
      setMessage(getLocalizedText(structure.commonText.userAdded));
    } catch (error) {
      const message = (error as Error).message;

      if (message !== 'Authentication required' && message !== 'Forbidden') {
        setMessage(getLocalizedText(structure.commonText.errorCreatingUser));
        console.error('Error creating user:', error);
      }
    }
  });

  formContainer.appendChild(form);
  formContainer.style.display = 'block';
}

async function showAnyForm<K extends TableKey>(
  tableKey: K,
  record?: Partial<TableRecordMap[K]>
): Promise<void> {
  if (!canWriteAcademic()) {
    setMessage(getLocalizedText(structure.commonText.noEditPermission));
    return;
  }

  const tableConfig = structure.tables[tableKey];
  const isEdit = !!record;
  const formId = `${tableKey}-form`;

  await resolveDependingForeignKeys(tableKey, record);

  const fields = await Promise.all(
    Object.entries(tableConfig.columns)
      .filter(([, column]) => column.editable !== false)
      .map(([fieldName, column]) =>
        renderFormField(
          tableKey,
          fieldName as keyof TableRecordMap[K] & string,
          column,
          record,
          isEdit
        )
      )
  );

  formContainer.innerHTML = '';

  const form = document.createElement('form');
  form.id = formId;

  const title = document.createElement('h3');
  title.textContent = `${
    isEdit
      ? getLocalizedText(structure.commonText.edit)
      : getLocalizedText(structure.commonText.add)
  } ${getLocalizedText(tableConfig.uiName)}`;
  form.appendChild(title);

  fields.forEach((field) => form.appendChild(field));



  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'form-actions';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = isEdit
    ? getLocalizedText(structure.commonText.update)
    : getLocalizedText(structure.commonText.add);

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

  setupDependentSelects(tableKey, record);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!validateForm(tableKey)) return;

    const payload = collectFormData(tableKey) as Record<string, unknown>;



    const pkAndTheirValues = getPkFields(tableKey).map((pkFieldName) => {
      const value =
        payload[pkFieldName] ??
        (record as Record<string, unknown> | undefined)?.[pkFieldName] ??
        '';

      return [pkFieldName, String(value)];
    });

    const queryParams = new URLSearchParams(pkAndTheirValues).toString();

    try {
      const response = await apiFetch(`/${tableKey}?${queryParams}`, {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return showErrorMessage(await errorMessage(response));
      }

      const responseJson: ApiResponse = await response.json();

      if (!responseJson.success) {
        return showErrorMessage(responseJson.message ?? 'Error saving record');
      }

      hideAnyForm();

      showSuccessMessage(responseJson.message ?? '');

      loadTableData(tableKey);
    } catch (error) {
      const message = (error as Error).message;

      if (message !== 'Authentication required' && message !== 'Forbidden') {
        setMessage(getLocalizedText(structure.commonText.errorSaving));
        console.error(
          `Error saving ${getLocalizedText(tableConfig.uiName).toLowerCase()}:`,
          error
        );
      }
    }
  });
}

// -----------------------------------------------------------------------------
// Global actions
// -----------------------------------------------------------------------------

declare global {
  interface Window {
    hideAnyForm: () => void;
    editRecord: <K extends TableKey>(
      tableKey: K,
      ...pkValues: string[]
    ) => Promise<void>;
    deleteRecord: <K extends TableKey>(
      tableKey: K,
      ...pkValues: string[]
    ) => Promise<void>;
  }
}

window.hideAnyForm = hideAnyForm;

window.editRecord = async <K extends TableKey>(
  tableKey: K,
  ...pkValues: string[]
) => {
  try {
    const queryParams = new URLSearchParams(
      getPkFields(tableKey).map((pkFieldName, index) => [
        pkFieldName,
        pkValues[index] ?? '',
      ])
    ).toString();

    const response = await apiFetch(`/${tableKey}?${queryParams}`);

    if (!response.ok) {
      return showErrorMessage(await errorMessage(response));
    }

    const responseAnswer: ApiResponse = await response.json();

    if (!responseAnswer.success) {
      return showErrorMessage(responseAnswer.message ?? 'Error loading record');
    }

    const record = responseAnswer.data as TableRecordMap[K];

    showAnyForm(tableKey, record);
  } catch (error) {
    const message = (error as Error).message;

    if (message !== 'Authentication required' && message !== 'Forbidden') {
      setMessage(getLocalizedText(structure.commonText.errorLoadingRecord));
      console.error(`Error loading ${tableKey} for edit:`, error);
    }
  }
};

window.deleteRecord = async <K extends TableKey>(
  tableKey: K,
  ...pkValues: string[]
) => {
  const tableConfig = structure.tables[tableKey];
  const entityName = getLocalizedText(tableConfig.uiName).toLowerCase();

  const confirmed = confirm(
    `${getLocalizedText(structure.commonText.deleteConfirm)} ${entityName}?`
  );

  if (!confirmed) return;

  try {
    const queryParams = new URLSearchParams(
      getPkFields(tableKey).map((pkFieldName, index) => [
        pkFieldName,
        pkValues[index] ?? '',
      ])
    ).toString();

    const response = await apiFetch(`/${tableKey}?${queryParams}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      return showErrorMessage(await errorMessage(response));
    }

    const responseAnswer: ApiResponse = await response.json();

    if (!responseAnswer.success) {
      return showErrorMessage(responseAnswer.message ?? 'Error deleting record');
    }

    showSuccessMessage(responseAnswer.message ?? '');
    loadTableData(tableKey);
  } catch (error) {
    const message = (error as Error).message;

    if (message !== 'Authentication required' && message !== 'Forbidden') {
      setMessage(getLocalizedText(structure.commonText.errorDeleting));
      console.error(`Error deleting ${tableKey}:`, error);
    }
  }
};

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------

const initialTheme = localStorage.getItem('theme') || 'light';
document.body.setAttribute('data-theme', initialTheme);

applyStaticLanguageToUI();

addUserBtn.addEventListener('click', () => showUserForm());

// Register mode state and form toggling
let isRegisterMode = false;

const toggleAuthLink = document.getElementById('toggle-auth-link') as HTMLAnchorElement | null;
const displaynameGroup = document.getElementById('displayname-group') as HTMLElement | null;
const loginTitle = document.getElementById('login-title') as HTMLElement | null;
const loginSubmitBtn = document.getElementById('login-submit-btn') as HTMLButtonElement | null;

if (toggleAuthLink) {
  toggleAuthLink.addEventListener('click', (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    if (displaynameGroup && loginTitle && loginSubmitBtn) {
      const passwordHint = document.getElementById('password-hint');
      if (isRegisterMode) {
        displaynameGroup.style.display = 'block';
        if (passwordHint) passwordHint.style.display = 'block';
        loginTitle.textContent = 'Registrarse';
        loginSubmitBtn.textContent = 'Registrarse';
        toggleAuthLink.textContent = '¿Ya tienes cuenta? Ingresa';
      } else {
        displaynameGroup.style.display = 'none';
        if (passwordHint) passwordHint.style.display = 'none';
        loginTitle.textContent = 'Ingresar';
        loginSubmitBtn.textContent = 'Ingresar';
        toggleAuthLink.textContent = '¿No tienes cuenta? Regístrate';
      }
    }
  });
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.hidden = true;

  const formData = new FormData(loginForm);

  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');

  if (isRegisterMode) {
    const displayname = String(formData.get('displayname') ?? '');
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayname, password }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        loginError.textContent = err.error || 'Error al registrar usuario';
        loginError.hidden = false;
        return;
      }

      // Reset login form fields back to login state
      isRegisterMode = false;
      if (displaynameGroup && loginTitle && loginSubmitBtn && toggleAuthLink) {
        displaynameGroup.style.display = 'none';
        loginTitle.textContent = 'Ingresar';
        loginSubmitBtn.textContent = 'Ingresar';
        toggleAuthLink.textContent = '¿No tienes cuenta? Regístrate';
      }
    } catch (error) {
      loginError.textContent = 'Error de conexión al registrar';
      loginError.hidden = false;
      return;
    }
  }

  const payload = { username, password };

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      showLogin(getLocalizedText(structure.commonText.invalidCredentials));
      return;
    }

    const data = (await response.json()) as { user: AuthUser };

    loginForm.reset();
    showApp(data.user);
  } catch (error) {
    showLogin(getLocalizedText(structure.commonText.loginError));
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
      passwordError.textContent =
        getLocalizedText(structure.commonText.passwordChangeFailed);
      passwordError.hidden = false;
      return;
    }

    const data = (await response.json()) as { user: AuthUser };

    passwordForm.reset();
    showApp(data.user);
  } catch (error) {
    passwordError.textContent =
      getLocalizedText(structure.commonText.passwordChangeError);
    passwordError.hidden = false;
    console.error('Password change error:', error);
  }
});

// -----------------------------------------------------------------------------
// Tracker Routing and Interface Boilerplate
// -----------------------------------------------------------------------------

const trackerShell = document.getElementById('tracker-shell') as HTMLElement;
const goToTrackerBtn = document.getElementById('go-to-tracker-btn') as HTMLButtonElement;
const goToAdminBtn = document.getElementById('go-to-admin-btn') as HTMLButtonElement;

function renderRoute(): void {
  if (!currentUser) {
    showLogin();
    return;
  }

  const path = window.location.pathname;

  if (path === '/panel') {
    if (currentUser.role === 'admin') {
      appShell.style.display = 'block';
      trackerShell.style.display = 'none';
      currentUserEl.textContent = `${currentUser.username} (${currentUser.role})`;
      if (goToTrackerBtn) goToTrackerBtn.style.display = 'inline-block';
      showSection(activeTableKey, false);
    } else {
      // Redirect non-admins to main '/'
      window.history.replaceState({}, '', '/');
      renderRoute();
    }
  } else {
    // Show tracker shell
    appShell.style.display = 'none';
    trackerShell.style.display = 'block';
    
    const trackerUserEl = document.getElementById('tracker-current-user');
    if (trackerUserEl) {
      trackerUserEl.textContent = `${currentUser.username} (${currentUser.role})`;
    }
    
    const welcomeName = document.getElementById('welcome-name');
    if (welcomeName) {
      welcomeName.textContent = currentUser.username;
    }

    if (goToAdminBtn) {
      goToAdminBtn.style.display = currentUser.role === 'admin' ? 'inline-block' : 'none';
    }

    // Parse tracker path for tab and group detail
    const groupMatch = path.match(/^\/groups\/(.+)$/);
    if (groupMatch) {
      switchTrackerTab('groups', { updateUrl: false, loadData: false });
      showTrackerGroupById(groupMatch[1]);
    } else if (path === '/groups') {
      switchTrackerTab('groups', { updateUrl: false });
    } else if (path === '/friends') {
      switchTrackerTab('friends', { updateUrl: false });
    } else {
      switchTrackerTab('dashboard', { updateUrl: false });
    }
  }
}

if (goToTrackerBtn) {
  goToTrackerBtn.addEventListener('click', () => {
    window.history.pushState({}, '', '/');
    renderRoute();
  });
}

if (goToAdminBtn) {
  goToAdminBtn.addEventListener('click', () => {
    window.history.pushState({}, '', '/panel');
    renderRoute();
  });
}

const trackerLogoutBtn = document.getElementById('tracker-logout-btn');
if (trackerLogoutBtn) {
  trackerLogoutBtn.addEventListener('click', async () => {
    
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'same-origin',
    });
  showLogin();
  hideApplication();
  });
}

// Tab switcher controller
const trackerTabs = {
  dashboard: {
    btn: document.getElementById('tab-dashboard-btn') as HTMLButtonElement,
    section: document.getElementById('tracker-tab-dashboard') as HTMLElement
  },
  groups: {
    btn: document.getElementById('tab-groups-btn') as HTMLButtonElement,
    section: document.getElementById('tracker-tab-groups') as HTMLElement
  },
  friends: {
    btn: document.getElementById('tab-friends-btn') as HTMLButtonElement,
    section: document.getElementById('tracker-tab-friends') as HTMLElement
  }
};


let statGroupsCount: HTMLSpanElement;
let statFriendsCount: HTMLSpanElement;
let statLogsCount: HTMLSpanElement;

function cacheDashboardElements() {
  statGroupsCount = document.getElementById(
    'stat-groups-count'
  ) as HTMLSpanElement;

  statFriendsCount = document.getElementById(
    'stat-friends-count'
  ) as HTMLSpanElement;

  statLogsCount = document.getElementById(
    'stat-logs-count'
  ) as HTMLSpanElement;
}

cacheDashboardElements();


async function loadDashboardStats() {
  try {
    const response = await fetch(`${API_BASE}/tracker/stats`, {
      credentials: 'same-origin',
    });

    if (!response.ok) {
      throw new Error('Failed to load dashboard stats');
    }

    const result = await response.json();

    statGroupsCount.textContent = result.data.groups.toString();
    statFriendsCount.textContent = result.data.friends.toString();
    statLogsCount.textContent = result.data.logs.toString();
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
  }
}

trackerTabs.dashboard.btn.addEventListener('click', async () => {
  await loadDashboardStats();
});

loadDashboardStats();

function switchTrackerTab(tabKey: 'dashboard' | 'groups' | 'friends', { updateUrl = true, loadData = true } = {}) {
  Object.entries(trackerTabs).forEach(([key, value]) => {
    if (value.btn && value.section) {
      const active = key === tabKey;
      value.btn.classList.toggle('active', active);
      value.section.style.display = active ? 'block' : 'none';
    }
  });

  if (loadData) {
    if (tabKey === 'dashboard') loadTrackerDashboard();
    else if (tabKey === 'groups') loadTrackerGroups();
    else if (tabKey === 'friends') loadTrackerFriends();
  }

  if (updateUrl) {
    const url = tabKey === 'dashboard' ? '/' : `/${tabKey}`;
    window.history.pushState({ tab: tabKey }, '', url);
  }
}

Object.entries(trackerTabs).forEach(([key, value]) => {
  if (value.btn) {
    value.btn.addEventListener('click', () => {
      switchTrackerTab(key as any);
    });
  }
});

let currentGroupId: string | null = null;
let currentGroupRole: string | null = null;

// Helper functions for Tracker Data Loading
async function loadTrackerDashboard() {
  const recentLogsList = document.getElementById('recent-logs-list');
  if (!recentLogsList) return;

  try {
    const response = await apiFetch('/tracker/logs');
    if (!response.ok) {
      recentLogsList.innerHTML = `<p class="error-text">Error al cargar registros</p>`;
      return;
    }
    const resAnswer = await response.json();
    if (!resAnswer.success) {
      recentLogsList.innerHTML = `<p class="error-text">${resAnswer.error || 'Error'}</p>`;
      return;
    }

    const logs = resAnswer.data || [];
    if (logs.length === 0) {
      recentLogsList.innerHTML = `<p class="empty-text">No hay registros recientes</p>`;
      return;
    }

    recentLogsList.innerHTML = logs.map((log: any) => `
      <div class="log-item">
        <div class="log-info">
          <div class="log-title">${log.activity_title}</div>
          <div class="log-meta">${log.group_name} - ${new Date(log.fecha).toLocaleDateString()}</div>
        </div>
        <div class="log-value-badge">${log.value}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Dashboard load failed:', error);
    recentLogsList.innerHTML = `<p class="error-text">Error de conexión</p>`;
  }
}

async function loadTrackerGroups() {
  const groupsList = document.getElementById('groups-list');
  const groupDetailsView = document.getElementById('group-details-view');
  if (!groupsList) return;

  groupsList.style.display = 'grid';
  if (groupDetailsView) groupDetailsView.style.display = 'none';

  try {
    const response = await apiFetch('/tracker/groups');
    if (!response.ok) {
      groupsList.innerHTML = `<p class="error-text">Error al cargar grupos</p>`;
      return;
    }
    const resAnswer = await response.json();
    if (!resAnswer.success) {
      groupsList.innerHTML = `<p class="error-text">${resAnswer.error || 'Error'}</p>`;
      return;
    }

    const groups = resAnswer.data || [];
    if (groups.length === 0) {
      groupsList.innerHTML = `<p class="empty-text">No perteneces a ningún grupo aún.</p>`;
      return;
    }

    groupsList.innerHTML = groups.map((group: any) => `
      <div class="group-card" id="group-card-${group.id}" style="cursor: pointer;">
        <h3>${group.displayname}</h3>
        <p>${group.description || 'Sin descripción'}</p>
        <div class="group-card-footer">
          <span>Rol: ${group.role === 'admin' ? 'Administrador' : 'Miembro'}</span>
          <span class="badge ${group.role === 'admin' ? 'admin' : 'member'}">${group.status === 'active' ? 'Activo' : 'Pendiente'}</span>
        </div>
      </div>
    `).join('');

    groups.forEach((group: any) => {
      const card = document.getElementById(`group-card-${group.id}`);
      if (card) {
        card.addEventListener('click', () => {
          showTrackerGroupDetails(group.id, group.displayname, group.description || '', group.role);
        });
      }
    });
  } catch (error) {
    console.error('Groups load failed:', error);
    groupsList.innerHTML = `<p class="error-text">Error de conexión</p>`;
  }
}

async function showTrackerGroupDetails(groupId: string, name: string, desc: string, role: string, { updateUrl = true } = {}) {
  currentGroupId = groupId;
  currentGroupRole = role;

  const groupsList = document.getElementById('groups-list');
  const groupDetailsView = document.getElementById('group-details-view');
  if (!groupsList || !groupDetailsView) return;

  groupsList.style.display = 'none';
  groupDetailsView.style.display = 'block';

  const titleEl = document.getElementById('group-detail-title');
  const descEl = document.getElementById('group-detail-desc');
  if (titleEl) titleEl.textContent = name;
  if (descEl) descEl.textContent = desc;

  // Enforce role-based actions on the UI
  const inviteMemberBtn = document.getElementById('invite-member-btn');
  const addActivityBtn = document.getElementById('add-activity-btn');
  const deleteGroupBtn = document.getElementById('delete-group-btn');
  if (inviteMemberBtn) {
    inviteMemberBtn.style.display = role === 'admin' ? 'inline-block' : 'none';
  }
  if (addActivityBtn) {
    addActivityBtn.style.display = role === 'admin' ? 'inline-block' : 'none';
  }
  if (deleteGroupBtn) {
    deleteGroupBtn.style.display = role === 'admin' ? 'inline-block' : 'none';
  }

  // Hide stats if open, show columns
  const columns = document.getElementById('group-columns');
  const statsContainer = document.getElementById('group-stats-container');
  if (columns) columns.style.display = '';
  if (statsContainer) statsContainer.style.display = 'none';

  await loadGroupActivities(groupId);
  await loadGroupMembers(groupId);

  if (updateUrl) {
    window.history.pushState(
      { tab: 'groups', groupId, groupName: name, groupDesc: desc, groupRole: role },
      '',
      `/groups/${groupId}`
    );
  }
}

async function showTrackerGroupById(groupId: string) {
  const state = window.history.state;
  if (state?.tab === 'groups' && state?.groupId === groupId && state?.groupName) {
    showTrackerGroupDetails(groupId, state.groupName, state.groupDesc || '', state.groupRole || 'member', { updateUrl: false });
    return;
  }
  try {
    const response = await apiFetch('/tracker/groups');
    if (!response.ok) return;
    const groups = (await response.json()).data || [];
    const group = groups.find((g: any) => g.id === groupId);
    if (group) {
      showTrackerGroupDetails(group.id, group.displayname, group.description || '', group.role, { updateUrl: false });
    }
  } catch (error) {
    console.error('Failed to load group:', error);
  }
}

async function loadGroupActivities(groupId: string) {
  const activitiesList = document.getElementById('group-activities-list');
  if (!activitiesList) return;

  try {
    const response = await apiFetch(`/tracker/groups/${groupId}/activities`);
    if (!response.ok) {
      activitiesList.innerHTML = `<p class="error-text">Error al cargar actividades</p>`;
      return;
    }
    const resAnswer = await response.json();
    const activities = resAnswer.data || [];

    if (activities.length === 0) {
      activitiesList.innerHTML = `<p class="empty-text">No hay actividades registradas en este grupo.</p>`;
      return;
    }

    activitiesList.innerHTML = activities.map((act: any) => {
      const escapedTitle = act.title.replace(/'/g, "\\'");
      const isAdmin = currentGroupRole === 'admin';
      return `
      <div class="activity-item">
        <div class="activity-info" style="cursor:pointer;" onclick="window.openActivityStats('${act.id}', '${escapedTitle}')">
          <h4>${act.title}</h4>
          <p>${act.body || 'Sin descripción'}</p>
        </div>
        <div class="activity-actions">
          <button class="add-btn" style="margin-bottom: 0;" onclick="window.openLogActivityModal('${act.id}', '${escapedTitle}')">Registrar</button>
          <button class="nav-toggle-btn" onclick="window.openActivityStats('${act.id}', '${escapedTitle}')">Progreso</button>
          ${isAdmin ? `<button class="delete-btn-sm" onclick="window.deleteActivity('${currentGroupId}', '${act.id}')" style="margin-bottom:0;">−</button>` : ''}
        </div>
      </div>
    `}).join('');
  } catch (error) {
    console.error('Activities load failed:', error);
    activitiesList.innerHTML = `<p class="error-text">Error de conexión</p>`;
  }
}

async function loadGroupMembers(groupId: string) {
  const membersList = document.getElementById('group-members-list');
  if (!membersList) return;

  try {
    const response = await apiFetch(`/tracker/groups/${groupId}/members`);
    if (!response.ok) {
      membersList.innerHTML = `<p class="error-text">Error al cargar miembros</p>`;
      return;
    }
    const resAnswer = await response.json();
    const members = resAnswer.data || [];

    const isAdmin = currentGroupRole === 'admin';

    let html = members.map((member: any) => {
      const canKick = isAdmin && member.role !== 'admin';
      return `
        <div class="member-item">
          <div class="member-info">
            <span class="name">${member.displayname || member.user_id}</span>
            <span class="username">@${member.user_id}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge ${member.role === 'admin' ? 'admin' : 'member'}">${member.status === 'active' ? (member.role === 'admin' ? 'Admin' : 'Miembro') : 'Pendiente'}</span>
            ${canKick ? `<button class="delete-btn-sm" onclick="window.kickMember('${groupId}', '${member.user_id}')">−</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Leave group button for non-admins
    if (!isAdmin) {
      html += `
        <div style="margin-top:12px;text-align:center;">
          <button class="delete-btn" onclick="window.leaveGroup('${groupId}')" style="width:100%;">Salir del grupo</button>
        </div>
      `;
    }

    membersList.innerHTML = html;
  } catch (error) {
    console.error('Members load failed:', error);
    membersList.innerHTML = `<p class="error-text">Error de conexión</p>`;
  }
}

async function loadTrackerFriends() {
  const friendsList = document.getElementById('friends-list');
  const pendingList = document.getElementById('pending-friends-list');
  if (!friendsList || !pendingList) return;

  try {
    const response = await apiFetch('/tracker/friends');
    if (!response.ok) {
      friendsList.innerHTML = `<p class="error-text">Error al cargar amigos</p>`;
      return;
    }
    const resAnswer = await response.json();
    const { friends, pendingSent, pendingReceived } = resAnswer.data || { friends: [], pendingSent: [], pendingReceived: [] };

    if (friends.length === 0) {
      friendsList.innerHTML = `<p class="empty-text">Aún no tienes amigos agregados.</p>`;
    } else {
      friendsList.innerHTML = friends.map((friend: any) => {
        const initials = (friend.displayname || friend.username).slice(0, 2).toUpperCase();
        return `
          <div class="friend-card">
            <div class="friend-avatar">${initials}</div>
            <h4 class="friend-name">${friend.displayname || friend.username}</h4>
            <span class="friend-username">@${friend.username}</span>
            <button class="delete-btn-sm" onclick="window.removeFriend('${friend.username}')" style="margin-top:6px;">−</button>
          </div>
        `;
      }).join('');
    }

    if (pendingSent.length === 0 && pendingReceived.length === 0) {
      pendingList.innerHTML = `<p class="empty-text">No tienes solicitudes pendientes.</p>`;
    } else {
      let pendingHtml = '';

      pendingReceived.forEach((req: any) => {
        pendingHtml += `
          <div class="pending-item">
            <div class="pending-info">
              <span class="name">${req.displayname || req.username}</span>
              <span class="username">@${req.username} (Recibida)</span>
            </div>
            <div class="actions">
              <button class="edit-btn" onclick="window.respondFriendRequest('${req.username}', 'accepted')">Aceptar</button>
              <button class="delete-btn" onclick="window.respondFriendRequest('${req.username}', 'rejected')">Rechazar</button>
            </div>
          </div>
        `;
      });

      pendingSent.forEach((req: any) => {
        pendingHtml += `
          <div class="pending-item">
            <div class="pending-info">
              <span class="name">${req.displayname || req.username}</span>
              <span class="username">@${req.username} (Enviada)</span>
            </div>
            <button class="delete-btn" onclick="window.respondFriendRequest('${req.username}', 'rejected')">Cancelar</button>
          </div>
        `;
      });

      pendingList.innerHTML = pendingHtml;
    }
  } catch (error) {
    console.error('Friends load failed:', error);
    friendsList.innerHTML = `<p class="error-text">Error de conexión</p>`;
  }
}

// Reusable modal controllers
const trackerModal = document.getElementById('tracker-modal') as HTMLElement;
const modalTitle = document.getElementById('modal-title') as HTMLElement;
let modalFormFields = document.getElementById('modal-form-fields') as HTMLElement;
let trackerModalForm = document.getElementById('tracker-modal-form') as HTMLFormElement;

function openTrackerModal(title: string, fieldsHtml: string, onSubmit: (e: Event) => void) {
  if (trackerModal && modalTitle && modalFormFields) {
    modalTitle.textContent = title;
    modalFormFields.innerHTML = fieldsHtml;
    trackerModal.style.display = 'flex';
    
    // Bind cancel action
    const cancelBtn = document.getElementById('modal-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        trackerModal.style.display = 'none';
      });
    }

    // Rebind submit action
    const newForm = trackerModalForm.cloneNode(true) as HTMLFormElement;
    trackerModalForm.parentNode?.replaceChild(newForm, trackerModalForm);
    trackerModalForm = newForm;
    modalFormFields = newForm.querySelector('#modal-form-fields') as HTMLElement;
    
    const reBoundCancelBtn = newForm.querySelector('#modal-cancel-btn');
    if (reBoundCancelBtn) {
      reBoundCancelBtn.addEventListener('click', () => {
        trackerModal.style.display = 'none';
      });
    }

    newForm.addEventListener('submit', (e) => {
      e.preventDefault();
      onSubmit(e);
      trackerModal.style.display = 'none';
    });
  }
}

const createGroupBtn = document.getElementById('create-group-btn');
if (createGroupBtn) {
  createGroupBtn.addEventListener('click', () => {
    openTrackerModal(
      'Crear Nuevo Grupo',
      `
        <div class="form-group">
          <label for="new-group-name">Nombre del Grupo</label>
          <input id="new-group-name" name="displayname" required>
        </div>
        <div class="form-group">
          <label for="new-group-desc">Descripción</label>
          <textarea id="new-group-desc" name="description"></textarea>
        </div>
      `,
      async (e) => {
        const formData = new FormData(e.target as HTMLFormElement);
        const displayname = formData.get('displayname');
        const description = formData.get('description') || null;

        try {
          const response = await apiFetch('/tracker/groups', {
            method: 'POST',
            body: JSON.stringify({ displayname, description })
          });

          if (!response.ok) {
            const err = await response.json();
            showErrorMessage(err.error || 'Error al crear grupo');
            return;
          }

          showSuccessMessage('Grupo creado con éxito');
          loadTrackerGroups();
        } catch (error) {
          console.error('Group creation failed:', error);
          showErrorMessage('Error de conexión al crear grupo');
        }
      }
    );
  });
}

const backToGroupsBtn = document.getElementById('back-to-groups-btn');
if (backToGroupsBtn) {
  backToGroupsBtn.addEventListener('click', () => {
    const groupsList = document.getElementById('groups-list');
    const groupDetailsView = document.getElementById('group-details-view');
    if (groupsList) groupsList.style.display = 'grid';
    if (groupDetailsView) groupDetailsView.style.display = 'none';
    currentGroupId = null;
    currentGroupRole = null;
    window.history.pushState({ tab: 'groups' }, '', '/groups');
  });
}

document.getElementById('delete-group-btn')?.addEventListener('click', () => {
  if (!currentGroupId) return;
  (window as any).deleteGroup(currentGroupId);
});

const addFriendTriggerBtn = document.getElementById('add-friend-trigger-btn');
if (addFriendTriggerBtn) {
  addFriendTriggerBtn.addEventListener('click', () => {
    openTrackerModal(
      'Agregar Amigo',
      `
        <div class="form-group">
          <label for="friend-username-input">Usuario (@)</label>
          <input id="friend-username-input" name="username" required>
        </div>
      `,
      async (e) => {
        const formData = new FormData(e.target as HTMLFormElement);
        const username = formData.get('username');

        try {
          const response = await apiFetch('/tracker/friends/request', {
            method: 'POST',
            body: JSON.stringify({ username })
          });

          if (!response.ok) {
            const err = await response.json();
            showErrorMessage(err.error || 'Error al enviar solicitud de amistad');
            return;
          }

          showSuccessMessage('Solicitud de amistad enviada');
          loadTrackerFriends();
        } catch (error) {
          console.error('Friend request failed:', error);
          showErrorMessage('Error de conexión al enviar solicitud');
        }
      }
    );
  });
}

const inviteMemberBtn = document.getElementById('invite-member-btn');
if (inviteMemberBtn) {
  inviteMemberBtn.addEventListener('click', async () => {
    if (!currentGroupId) return;

    try {
      const [friendsRes, membersRes] = await Promise.all([
        apiFetch('/tracker/friends'),
        apiFetch(`/tracker/groups/${currentGroupId}/members`)
      ]);

      if (!friendsRes.ok || !membersRes.ok) {
        showErrorMessage('Error al cargar datos');
        return;
      }

      const friendsData = await friendsRes.json();
      const membersData = await membersRes.json();
      const friends = friendsData.data?.friends || [];
      const members = membersData.data || [];
      const memberUsernames = new Set(members.map((m: any) => m.user_id));
      const available = friends.filter((f: any) => !memberUsernames.has(f.username));

      const noFriends = available.length === 0;
      const fieldsHtml = noFriends ? `
        <div class="form-group">
          <label for="invite-username-input">Amigos disponibles</label>
          <select id="invite-username-input" name="username" required disabled style="opacity:0.5;">
            <option value="">Ninguno Disponible</option>
          </select>
        </div>
      ` : `
        <div class="form-group">
          <label for="invite-username-input">Seleccionar amigo</label>
          <select id="invite-username-input" name="username" required>
            <option value="">— Seleccionar —</option>
            ${available.map((f: any) => `<option value="${f.username}">${f.displayname} (@${f.username})</option>`).join('')}
          </select>
        </div>
      `;

      openTrackerModal('Invitar Miembro', fieldsHtml, async (e) => {
        if (!currentGroupId) return;
        const formData = new FormData(e.target as HTMLFormElement);
        const username = formData.get('username') as string;
        if (!username) return;

        try {
          const response = await apiFetch(`/tracker/groups/${currentGroupId}/invite`, {
            method: 'POST',
            body: JSON.stringify({ username })
          });

          if (!response.ok) {
            const err = await response.json();
            showErrorMessage(err.error || 'Error al invitar miembro');
            return;
          }

          showSuccessMessage('Invitación enviada con éxito');
          loadGroupMembers(currentGroupId);
        } catch (error) {
          console.error('Member invite failed:', error);
          showErrorMessage('Error de conexión al invitar miembro');
        }
      });
    } catch (error) {
      console.error('Failed to load friends/members:', error);
      showErrorMessage('Error al cargar datos');
    }
  });
}

const addActivityBtn = document.getElementById('add-activity-btn');
if (addActivityBtn) {
  addActivityBtn.addEventListener('click', () => {
    openTrackerModal(
      'Nueva Actividad',
      `
        <div class="form-group">
          <label for="act-title">Título</label>
          <input id="act-title" name="title" required>
        </div>
        <div class="form-group">
          <label for="act-body">Descripción</label>
          <textarea id="act-body" name="body"></textarea>
        </div>
      `,
      async (e) => {
        if (!currentGroupId) return;
        const formData = new FormData(e.target as HTMLFormElement);
        const title = formData.get('title');
        const body = formData.get('body') || null;

        try {
          const response = await apiFetch(`/tracker/groups/${currentGroupId}/activities`, {
            method: 'POST',
            body: JSON.stringify({ title, body, status: 'active' })
          });

          if (!response.ok) {
            const err = await response.json();
            showErrorMessage(err.error || 'Error al crear actividad');
            return;
          }

          showSuccessMessage('Actividad creada con éxito');
          loadGroupActivities(currentGroupId);
        } catch (error) {
          console.error('Activity creation failed:', error);
          showErrorMessage('Error de conexión al crear actividad');
        }
      }
    );
  });
}

// Window globally exposed inline callbacks
(window as any).openLogActivityModal = (activityId: string, activityTitle: string) => {
  openTrackerModal(
    `Registrar Progreso: ${activityTitle}`,
    `
      <div class="form-group">
        <label for="log-value">Valor / Progreso (numérico)</label>
        <input type="number" id="log-value" name="value" required min="0">
      </div>
      <div class="form-group">
        <label for="log-fecha">Fecha</label>
        <input type="date" id="log-fecha" name="fecha" value="${new Date().toISOString().slice(0,10)}" required>
      </div>
      <div class="form-group">
        <label for="log-comment">Comentario</label>
        <textarea id="log-comment" name="commentar"></textarea>
      </div>
    `,
    async (e) => {
      const formData = new FormData(e.target as HTMLFormElement);
      const value = Number(formData.get('value'));
      const fecha = new Date(formData.get('fecha') as string).toISOString();
      const commentar = formData.get('commentar') || null;

      try {
        const response = await apiFetch(`/tracker/activities/${activityId}/records`, {
          method: 'POST',
          body: JSON.stringify({ value, fecha, commentar })
        });

        if (!response.ok) {
          const err = await response.json();
          showErrorMessage(err.error || 'Error al guardar registro');
          return;
        }

        showSuccessMessage('Registro guardado con éxito');
        loadTrackerDashboard();
      } catch (error) {
        console.error('Record logging failed:', error);
        showErrorMessage('Error de conexión al guardar registro');
      }
    }
  );
};

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

let currentStatsActivityId: string | null = null;
let currentStatsData: any = null;
let currentStatsUseSum = true;

function renderStats(useSum: boolean) {
  const data = currentStatsData;
  if (!data) return;
  const container = document.getElementById('stats-content');
  if (!container) return;

  const field = useSum ? 'sum' : 'count';
  const totalField = useSum ? 'total_sum' : 'total_count';

  // Assign stable colors per user
  const userColorMap: Record<string, string> = {};
  data.per_user.forEach((u: any, i: number) => {
    userColorMap[u.user_id] = CHART_COLORS[i % CHART_COLORS.length];
  });

  container.innerHTML = `
    <!-- Summary cards -->
    <div class="stats-summary">
      <div class="stat-summary-card">
        <div class="stat-value">${data.summary[totalField]}</div>
        <div class="stat-label">${useSum ? 'Suma Total' : 'Total Registros'}</div>
      </div>
      <div class="stat-summary-card">
        <div class="stat-value">${data.summary.average}</div>
        <div class="stat-label">Promedio</div>
      </div>
      <div class="stat-summary-card">
        <div class="stat-value">${data.summary.max}</div>
        <div class="stat-label">Máximo</div>
      </div>
      <div class="stat-summary-card">
        <div class="stat-value">${data.summary.min}</div>
        <div class="stat-label">Mínimo</div>
      </div>
      <div class="stat-summary-card">
        <div class="stat-value">${data.records.length}</div>
        <div class="stat-label">Entradas</div>
      </div>
    </div>

    <!-- Pie + Heatmap row -->
    <div class="stats-charts-row section">
      <div class="stats-chart-col">
        <h4 style="margin:0 0 16px 0;">Distribución por Usuario</h4>
        <div class="stats-pie-section">
          <div class="pie-chart-wrapper">
            <div class="pie-chart" style="background: ${buildPieGradient(data.per_user, field, userColorMap)};"></div>
          </div>
          <div class="pie-legend">
            ${data.per_user.map((u: any) => `
              <div class="pie-legend-item">
                <div class="pie-legend-color" style="background:${userColorMap[u.user_id]}"></div>
                <span class="pie-legend-label">${u.displayname || u.user_id}</span>
                <span class="pie-legend-value">${u[field]}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="stats-chart-col">
        <h4 style="margin:0 0 16px 0;">Mapa de Calor — ${new Date().toLocaleString('es', { month: 'long' })}</h4>
        ${buildHeatmap(data.daily)}
      </div>
    </div>

    <!-- 100% stacked area chart -->
    <div class="stats-svg-section section">
      <h4>${useSum ? 'Distribución por Suma' : 'Distribución por Cantidad de Registros'} — 100% Apilado por Mes</h4>
      ${buildStackedAreaChart(data.per_user_per_month, field, userColorMap)}
      <div class="svg-legend">
        ${data.per_user.map((u: any) => `
          <div class="svg-legend-item">
            <div class="svg-legend-swatch" style="background:${userColorMap[u.user_id]}"></div>
            <span>${u.displayname || u.user_id}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Cumulative chart -->
    <div class="stats-svg-section section">
      <h4>Progreso Acumulado</h4>
      ${buildCumulativeChart(data.records, field, userColorMap)}
      <div class="svg-legend">
        ${data.per_user.map((u: any) => `
          <div class="svg-legend-item">
            <div class="svg-legend-swatch" style="background:${userColorMap[u.user_id]}"></div>
            <span>${u.displayname || u.user_id}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Records table -->
    <div class="stats-records-section section">
      <h4>Registros Individuales</h4>
      <table class="records-table" id="stats-records-table">
        <thead>
          <tr>
            <th data-sort="displayname">Usuario</th>
            <th data-sort="value">Valor</th>
            <th data-sort="fecha">Fecha</th>
            <th data-sort="commentar">Comentario</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${data.records.map((r: any) => {
            const canDelete = r.user_id === currentUser?.username || currentGroupRole === 'admin';
            return `
            <tr>
              <td>${r.displayname || r.user_id}</td>
              <td>${r.value}</td>
              <td>${new Date(r.fecha).toLocaleDateString()}</td>
              <td>${r.commentar || ''}</td>
              <td>${canDelete ? `<button class="delete-btn-sm" onclick="window.deleteLogRecord('${currentStatsActivityId}', '${r.id}')">−</button>` : ''}</td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Bind table sort
  document.querySelectorAll('#stats-records-table th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = (th as HTMLElement).dataset.sort!;
      const tbody = document.querySelector('#stats-records-table tbody')!;
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const dir = (th as any)._sortDir === 'asc' ? -1 : 1;
      (th as any)._sortDir = dir === 1 ? 'asc' : 'desc';
      rows.sort((a, b) => {
        const va = (a.children as any)[Array.from(th.parentNode!.children).indexOf(th)].textContent;
        const vb = (b.children as any)[Array.from(th.parentNode!.children).indexOf(th)].textContent;
        return dir * (key === 'value' ? (Number(va) - Number(vb)) : va.localeCompare(vb));
      });
      rows.forEach(r => tbody.appendChild(r));
    });
  });
}

function buildPieGradient(perUser: any[], field: string, colors: Record<string, string>): string {
  const total = perUser.reduce((s: number, u: any) => s + u[field], 0);
  if (total === 0) return '#e5e7eb';
  let current = 0;
  const stops = perUser.map((u: any) => {
    const pct = (u[field] / total) * 100;
    const start = current;
    current += pct;
    return `${colors[u.user_id]} ${start}% ${current}%`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

function buildStackedAreaChart(perMonth: any[], field: string, colors: Record<string, string>): string {
  const months = [...new Set(perMonth.map((r: any) => `${r.year}-${String(r.month).padStart(2, '0')}`))].sort();
  if (months.length === 0) return '<p class="empty-text">Sin datos por mes</p>';

  // Single month: render horizontal stacked bar instead of empty polygon
  if (months.length === 1) {
    const rows = perMonth.filter((r: any) => `${r.year}-${String(r.month).padStart(2, '0')}` === months[0]);
    const total = rows.reduce((s: number, r: any) => s + r[field], 0) || 1;
    const bars = rows.map((r: any) => {
      const pct = (r[field] / total) * 100;
      return `<div style="height:24px;width:${pct}%;background:${colors[r.user_id] || '#ccc'};display:inline-block;min-width:2px;border-radius:${pct === 100 ? '6px' : '6px 0 0 6px'}"></div>`;
    }).join('');
    return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;">
      <span style="font-size:0.85rem;font-weight:600;min-width:60px;">${months[0]}</span>
      <div style="flex:1;height:24px;border-radius:6px;overflow:hidden;background:var(--surface-2);">${bars}</div>
      <span style="font-size:0.85rem;color:var(--text-muted);min-width:50px;text-align:right;">${total}</span>
    </div>`;
  }

  const svgW = 700, svgH = 280, padL = 50, padR = 20, padT = 10, padB = 35;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  // Build per-month data with percentages
  const monthData = months.map((m) => {
    const [y, mo] = m.split('-').map(Number);
    const rows = perMonth.filter((r: any) => r.year === y && r.month === mo);
    const total = rows.reduce((s: number, r: any) => s + r[field], 0);
    return { label: `${mo}/${y}`, total, rows: rows.map((r: any) => ({ userId: r.user_id, val: r[field], pct: total > 0 ? (r[field] / total) * 100 : 0 })) };
  });

  const allUserIds = [...new Set(perMonth.map((r: any) => r.user_id))];

  // Helper: for a user, get their adjusted value at each month index (interpolated)
  function getUserValues(userId: string): number[] {
    const known: { idx: number; val: number }[] = [];
    monthData.forEach((md, i) => {
      const entry = md.rows.find((r: any) => r.userId === userId);
      if (entry) known.push({ idx: i, val: entry.pct });
    });
    if (known.length === 0) return months.map(() => 0);
    return months.map((_, i) => {
      if (known.length === 1) return known[0].val;
      // Before first known
      if (i < known[0].idx) return 0;
      // After last known: flat at last value
      if (i > known[known.length - 1].idx) return known[known.length - 1].val;
      // Between known points: linear interpolation
      const after = known.find((k) => k.idx >= i)!;
      if (after.idx === i) return after.val;
      const before = known.filter((k) => k.idx < i).pop()!;
      const ratio = (i - before.idx) / (after.idx - before.idx);
      return before.val + (after.val - before.val) * ratio;
    });
  }

  // Build polygons: each band goes from cumulative of previous users to cumulative up to this user
  const polys = allUserIds.map((uid, uIdx) => {
    const vals = getUserValues(uid);
    const topEdge: string[] = [];
    const bottomEdge: string[] = [];
    months.forEach((_, i) => {
      // Cumulative up to this user
      let cumUpToHere = 0;
      for (let j = 0; j <= uIdx; j++) {
        const uv = getUserValues(allUserIds[j]);
        cumUpToHere += uv[i];
      }
      // Cumulative before this user
      let cumBefore = cumUpToHere - vals[i];
      const x = padL + (i / (months.length - 1 || 1)) * chartW;
      topEdge.push(`${x},${padT + chartH * (1 - cumUpToHere / 100)}`);
      bottomEdge.push(`${x},${padT + chartH * (1 - cumBefore / 100)}`);
    });
    if (topEdge.length < 2) return '';
    const points = [...topEdge, ...bottomEdge.reverse()].join(' ');
    return `<polygon points="${points}" fill="${colors[uid] || '#ccc'}" opacity="0.85"/>`;
  }).filter(Boolean).join('\n');

  // X-axis labels
  const xLabels = months.map((m, i) => {
    const x = padL + (i / (months.length - 1 || 1)) * chartW;
    return `<text x="${x}" y="${svgH - 5}" text-anchor="middle" font-size="11" fill="var(--text-muted)">${m}</text>`;
  }).join('');

  // Y-axis labels (0%, 25%, 50%, 75%, 100%)
  const yLabels = [0, 25, 50, 75, 100].map((pct) => {
    const y = padT + chartH * (1 - pct / 100);
    return `<text x="${padL - 5}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--text-muted)">${pct}%</text>`;
  }).join('');

  // Y-axis grid lines
  const yGrid = [25, 50, 75].map((pct) => {
    const y = padT + chartH * (1 - pct / 100);
    return `<line x1="${padL}" y1="${y}" x2="${padL + chartW}" y2="${y}" stroke="var(--border)" stroke-dasharray="4" stroke-width="1"/>`;
  }).join('');

  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
    ${yGrid}
    ${polys}
    ${xLabels}
    ${yLabels}
    <line x1="${padL}" y1="${padT + chartH}" x2="${padL + chartW}" y2="${padT + chartH}" stroke="var(--border)" stroke-width="1"/>
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="var(--border)" stroke-width="1"/>
  </svg>`;
}

function buildCumulativeChart(records: any[], field: string, colors: Record<string, string>): string {
  // Group records by user, sort by fecha, compute running total
  const userGroups: Record<string, { fecha: string; running: number }[]> = {};
  const allDates = [...new Set(records.map((r: any) => r.fecha.slice(0, 10)))].sort();
  if (allDates.length === 0) return '<p class="empty-text">Sin datos</p>';

  // Single date: render horizontal bars per user instead of empty lines
  if (allDates.length === 1) {
    const grouped: Record<string, number> = {};
    records.forEach((r: any) => {
      const key = r.user_id;
      grouped[key] = (grouped[key] || 0) + (field === 'count' ? 1 : r.value);
    });
    const max = Math.max(...Object.values(grouped), 1);
    const userColorMap = colors;
    // We don't have displaynames here, use user_id
    const bars = Object.entries(grouped).map(([uid, val]) => {
      const pct = (val / max) * 100;
      return `<div class="comparison-row">
        <div class="comparison-label">
          <span>${uid}</span>
          <span>${val}</span>
        </div>
        <div class="comparison-bar-bg">
          <div class="comparison-bar-fill" style="width:${pct}%;background:${userColorMap[uid] || '#3b82f6'}"></div>
        </div>
      </div>`;
    }).join('');
    return `<div style="display:flex;flex-direction:column;gap:12px;">${bars}</div>`;
  }

  const allUserIds = [...new Set(records.map((r: any) => r.user_id))];

  allUserIds.forEach((uid) => {
    const userRecords = records.filter((r: any) => r.user_id === uid).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
    let running = 0;
    userGroups[uid] = userRecords.map((r: any) => {
      running += field === 'count' ? 1 : r.value;
      return { fecha: r.fecha.slice(0, 10), running };
    });
  });

  const svgW = 700, svgH = 280, padL = 50, padR = 20, padT = 10, padB = 35;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  const maxVal = Math.max(...Object.values(userGroups).flat().map((g: any) => g.running), 1);

  const polys = allUserIds.map((uid) => {
    const userPts = userGroups[uid];
    if (!userPts || userPts.length === 0) return '';
    const pts = userPts.map((g) => {
      const i = allDates.indexOf(g.fecha);
      const x = padL + (i / (allDates.length - 1 || 1)) * chartW;
      const y = padT + chartH * (1 - g.running / maxVal);
      return `${x},${y}`;
    });
    // Start line from 0 at the date BEFORE the first data point (if it's not the first date)
    const firstIdx = allDates.indexOf(userPts[0].fecha);
    const zeroY = padT + chartH;
    const startSegment = firstIdx > 0 ? `${padL + ((firstIdx - 1) / (allDates.length - 1 || 1)) * chartW},${zeroY} ` : '';
    // Extend flat to the last date
    const lastX = padL + chartW;
    const lastY = padT + chartH * (1 - userPts[userPts.length - 1].running / maxVal);
    return `<polyline points="${startSegment}${pts.join(' ')} ${lastX},${lastY}" fill="none" stroke="${colors[uid] || '#ccc'}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).filter(Boolean).join('\n');

  const xLabels = allDates.filter((_, i) => i % Math.max(1, Math.floor(allDates.length / 6)) === 0 || i === allDates.length - 1).map((d, _i, arr) => {
    const i = allDates.indexOf(d);
    const x = padL + (i / (allDates.length - 1 || 1)) * chartW;
    const short = d.slice(5);
    return `<text x="${x}" y="${svgH - 5}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${short}</text>`;
  }).join('');

  const yLabels = [0, Math.round(maxVal / 4), Math.round(maxVal / 2), Math.round(maxVal * 3 / 4), maxVal].map((v) => {
    const y = padT + chartH * (1 - v / maxVal);
    return `<text x="${padL - 5}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--text-muted)">${v}</text>`;
  }).join('');

  const yGrid = [Math.round(maxVal / 4), Math.round(maxVal / 2), Math.round(maxVal * 3 / 4)].map((v) => {
    const y = padT + chartH * (1 - v / maxVal);
    return `<line x1="${padL}" y1="${y}" x2="${padL + chartW}" y2="${y}" stroke="var(--border)" stroke-dasharray="4" stroke-width="1"/>`;
  }).join('');

  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
    ${yGrid}
    ${polys}
    ${xLabels}
    ${yLabels}
    <line x1="${padL}" y1="${padT + chartH}" x2="${padL + chartW}" y2="${padT + chartH}" stroke="var(--border)" stroke-width="1"/>
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="var(--border)" stroke-width="1"/>
  </svg>`;
}

function buildHeatmap(daily: any[]): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dayMap: Record<string, number> = {};
  daily.forEach((d: any) => {
    const dateStr = d.date.slice(0, 10);
    if (dateStr.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) {
      dayMap[parseInt(dateStr.slice(-2), 10)] = d.sum;
    }
  });

  const maxDayVal = Math.max(...Object.values(dayMap), 1);

  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
  const cells: string[] = [];
  // pad empty cells before month starts
  for (let d = 0; d < firstDayOfWeek; d++) {
    cells.push('<div></div>');
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const val = dayMap[d] || 0;
    const intensity = val > 0 ? Math.min(1, val / maxDayVal) : 0;
    const r = Math.round(235 - intensity * 200);
    const g = Math.round(235 - intensity * 200);
    const b = Math.round(245 - intensity * 200);
    const bg = intensity > 0 ? `rgb(${r},${g},${b})` : 'var(--surface-2)';
    cells.push(`<div class="heatmap-cell" style="background:${bg};display:flex;align-items:center;justify-content:center;font-size:0.65rem;color:${intensity > 0.5 ? 'white' : 'var(--text-muted)'}" title="Día ${d}: ${val}">${d}</div>`);
  }

  return `<div class="heatmap-grid">
    <div class="heatmap-day-label">Dom</div><div class="heatmap-day-label">Lun</div><div class="heatmap-day-label">Mar</div>
    <div class="heatmap-day-label">Mié</div><div class="heatmap-day-label">Jue</div><div class="heatmap-day-label">Vie</div>
    <div class="heatmap-day-label">Sáb</div>
    ${cells.join('')}
  </div>
  <div class="heatmap-legend">
    <span>Menos</span>
    <div class="heatmap-legend-cell" style="background:var(--surface-2)"></div>
    <div class="heatmap-legend-cell" style="background:rgb(188, 198, 214)"></div>
    <div class="heatmap-legend-cell" style="background:rgb(118, 138, 184)"></div>
    <div class="heatmap-legend-cell" style="background:rgb(48, 78, 154)"></div>
    <div class="heatmap-legend-cell" style="background:rgb(28, 38, 84)"></div>
    <span>Más</span>
  </div>`;
}

(window as any).openActivityStats = async (activityId: string, activityTitle: string) => {
  const columns = document.getElementById('group-columns');
  const container = document.getElementById('group-stats-container');
  const titleEl = document.getElementById('stats-activity-title');
  if (!columns || !container || !titleEl) return;

  columns.style.display = 'none';
  container.style.display = 'block';
  titleEl.textContent = activityTitle;
  currentStatsActivityId = activityId;

  const contentEl = document.getElementById('stats-content');
  if (!contentEl) return;
  contentEl.innerHTML = '<p class="empty-text">Cargando estadísticas...</p>';

  try {
    const response = await apiFetch(`/tracker/activities/${activityId}/stats`);
    if (!response.ok) {
      contentEl.innerHTML = '<p class="error-text">Error al cargar estadísticas</p>';
      return;
    }
    const resAnswer = await response.json();
    currentStatsData = resAnswer.data;
    currentStatsUseSum = true;
    renderStats(true);
  } catch (error) {
    console.error('Stats load failed:', error);
    contentEl.innerHTML = '<p class="error-text">Error de conexión</p>';
  }
};


// Toggle sum/count
document.getElementById('stats-sum-btn')?.addEventListener('click', () => {
  const btn = document.getElementById('stats-sum-btn');
  const other = document.getElementById('stats-count-btn');
  if (!btn || !other || btn.classList.contains('active')) return;
  btn.classList.add('active');
  other.classList.remove('active');
  currentStatsUseSum = true;
  renderStats(true);
});

document.getElementById('stats-count-btn')?.addEventListener('click', () => {
  const btn = document.getElementById('stats-count-btn');
  const other = document.getElementById('stats-sum-btn');
  if (!btn || !other || btn.classList.contains('active')) return;
  btn.classList.add('active');
  other.classList.remove('active');
  currentStatsUseSum = false;
  renderStats(false);
});

// Close stats
document.getElementById('stats-close-btn')?.addEventListener('click', () => {
  const columns = document.getElementById('group-columns');
  const container = document.getElementById('group-stats-container');
  if (columns) columns.style.display = '';
  if (container) container.style.display = 'none';
  // Reset toggle
  document.getElementById('stats-sum-btn')?.classList.add('active');
  document.getElementById('stats-count-btn')?.classList.remove('active');
  currentStatsUseSum = true;
});

async function apiDelete(path: string, options: {
  confirmMsg?: string;
  successMsg: string;
  refresh?: () => void;
}) {
  if (options.confirmMsg && !confirm(options.confirmMsg)) return;
  try {
    const response = await apiFetch(path, { method: 'DELETE' });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      showErrorMessage(err.error || 'Error');
      return;
    }
    showSuccessMessage(options.successMsg);
    options.refresh?.();
  } catch {
    showErrorMessage('Error de conexión');
  }
}

(window as any).kickMember = (groupId: string, userId: string) =>
  apiDelete(`/tracker/groups/${groupId}/members/${userId}`, {
    confirmMsg: '¿Expulsar a este miembro del grupo?',
    successMsg: 'Miembro expulsado',
    refresh: () => loadGroupMembers(groupId),
  });

(window as any).leaveGroup = (groupId: string) => {
  const username = currentUser?.username;
  if (!username) return;
  apiDelete(`/tracker/groups/${groupId}/members/${username}`, {
    confirmMsg: '¿Salir del grupo? Esta acción no se puede deshacer.',
    successMsg: 'Has salido del grupo',
    refresh: () => {
      currentGroupId = null;
      currentGroupRole = null;
      loadTrackerGroups();
    },
  });
};

(window as any).deleteActivity = (groupId: string, activityId: string) =>
  apiDelete(`/tracker/groups/${groupId}/activities/${activityId}`, {
    confirmMsg: '¿Eliminar esta actividad? También se eliminarán todos los registros asociados.',
    successMsg: 'Actividad eliminada',
    refresh: () => loadGroupActivities(groupId),
  });

(window as any).deleteLogRecord = (activityId: string, recordId: string) =>
  apiDelete(`/tracker/activities/${activityId}/records/${recordId}`, {
    confirmMsg: '¿Eliminar este registro?',
    successMsg: 'Registro eliminado',
    refresh: () => {
      const title = (document.getElementById('stats-activity-title') as HTMLElement)?.textContent;
      if (currentStatsActivityId && title) (window as any).openActivityStats(currentStatsActivityId, title);
    },
  });

(window as any).removeFriend = (username: string) =>
  apiDelete(`/tracker/friends/${username}`, {
    confirmMsg: '¿Eliminar amigo?',
    successMsg: 'Amigo eliminado',
    refresh: () => loadTrackerFriends(),
  });

(window as any).deleteGroup = (groupId: string) =>
  apiDelete(`/tracker/groups/${groupId}`, {
    confirmMsg: '¿Eliminar el grupo por completo? Se eliminarán todas las actividades, registros y miembros.',
    successMsg: 'Grupo eliminado',
    refresh: () => {
      const groupsList = document.getElementById('groups-list');
      const groupDetailsView = document.getElementById('group-details-view');
      if (groupsList) groupsList.style.display = 'grid';
      if (groupDetailsView) groupDetailsView.style.display = 'none';
      currentGroupId = null;
      currentGroupRole = null;
      window.history.pushState({ tab: 'groups' }, '', '/groups');
      loadTrackerGroups();
    },
  });

(window as any).respondFriendRequest = async (username: string, action: string) => {
  try {
    const response = await apiFetch('/tracker/friends/respond', {
      method: 'POST',
      body: JSON.stringify({ username, action })
    });

    if (!response.ok) {
      const err = await response.json();
      showErrorMessage(err.error || 'Error al responder solicitud');
      return;
    }

    showSuccessMessage(`Solicitud ${action === 'accepted' ? 'aceptada' : 'rechazada'}`);
    loadTrackerFriends();
  } catch (error) {
    console.error('Respond friend request failed:', error);
    showErrorMessage('Error de conexión al responder solicitud');
  }
};

async function initialize(): Promise<void> {
  createTableNavButtons();
  syncUrlToState();
  applyLanguageToUI();

  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'same-origin',
    });

    if (!response.ok) {
      showLogin();
      return;
    }

    const data = (await response.json()) as { user: AuthUser };

    showApp(data.user);
  } catch (error) {
    showLogin();
    console.error('Session check failed:', error);
  }
}

initialize();

export {};