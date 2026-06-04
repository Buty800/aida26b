// Main application file
// Code and comments in English
import {structure} from '@shared/ssot/structure';
import {TypeMap, MyTypeNames, ColumnDef, TableStructure, InferType, TableKey, TableRecordMap} from '@shared/types/types';
import {getPkFields} from '@shared/utils/utils';
import '../styles/style.css';

const API_BASE = '/api';





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
  btn.textContent = cfg.title ?? cfg.uiName;
  navContainer.appendChild(btn);
  tableNavButtons[key] = btn;
  btn.addEventListener('click', () => showSection(key));
}

let activeTableKey: TableKey = tableKeys[0] as TableKey;

// --- State Management ---
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
  filters: {}
};

function serializeFilterValue(fieldName: string, entry: FilterEntry): string | null {
  const col = (structure.tables[activeTableKey] as TableStructure)?.columns[fieldName];
  let val: string;
  if (col?.type === 'number') {
    val = `${entry.min ?? ''},${entry.max ?? ''}`;
    if (val === ',') return null;
  } else {
    val = entry.value ?? '';
    if (!val) return null;
  }
  if (entry.negated) val = '!' + val;
  return val;
}

function syncStateToUrl() {
  const params = new URLSearchParams();
  params.set('table', activeTableKey);
  params.set('page', String(currentState.page));
  if (currentState.sort) {
    params.set('sort', currentState.sort);
    params.set('dir', currentState.dir || 'asc');
  }
  for (const [fieldName, entries] of Object.entries(currentState.filters)) {
    for (const entry of entries) {
      const val = serializeFilterValue(fieldName, entry);
      if (val !== null) params.append(`filter_${fieldName}`, val);
    }
  }
  window.history.pushState({}, '', `?${params.toString()}`);
}

function syncUrlToState() {
  const params = new URLSearchParams(window.location.search);
  const table = params.get('table') as TableKey;
  if (table && structure.tables[table]) {
    activeTableKey = table;
  }
  currentState.page = parseInt(params.get('page') || '1');
  currentState.sort = params.get('sort') || undefined;
  currentState.dir = (params.get('dir') as 'asc' | 'desc') || undefined;

  currentState.filters = {};
  params.forEach((v, k) => {
    if (!k.startsWith('filter_')) return;
    const fieldName = k.slice(7);
    const col = (structure.tables[activeTableKey] as TableStructure)?.columns[fieldName];
    if (!col) return;

    const strVal = String(v);
    if (!strVal) return;

    const negated = strVal.startsWith('!');
    const actualVal = negated ? strVal.slice(1) : strVal;

    const entry: FilterEntry = { negated };

    if (col.type === 'number') {
      const commaIdx = actualVal.indexOf(',');
      if (commaIdx >= 0) {
        entry.min = actualVal.slice(0, commaIdx);
        entry.max = actualVal.slice(commaIdx + 1);
      } else {
        entry.min = actualVal;
      }
    } else {
      entry.value = actualVal;
    }

    if (!currentState.filters[fieldName]) {
      currentState.filters[fieldName] = [];
    }
    currentState.filters[fieldName].push(entry);
  });
}

window.addEventListener('popstate', () => {
  syncUrlToState();
  showSection(activeTableKey, true);
});

const filterContainer = document.createElement('div');
filterContainer.className = 'filter-container';
filterContainer.style.display = 'flex';
filterContainer.style.gap = '10px';
filterContainer.style.flexWrap = 'wrap';
filterContainer.style.marginBottom = '15px';
sharedTable.parentNode?.insertBefore(filterContainer, sharedTable);

const paginationContainer = document.createElement('div');
paginationContainer.className = 'pagination-container';
paginationContainer.style.marginTop = '15px';
paginationContainer.style.display = 'flex';
paginationContainer.style.gap = '10px';
paginationContainer.style.alignItems = 'center';
sharedTable.parentNode?.insertBefore(paginationContainer, sharedTable.nextSibling);

function getFilterType(column: ColumnDef): 'string' | 'number' | 'enum' {
  if (column.type === 'number') return 'number';
  if (column.input === 'select' && column.options) return 'enum';
  return 'string';
}

function createFilterControl(entry: FilterEntry, column: ColumnDef, onChange: () => void): HTMLElement {
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
    container.appendChild(minInput);

    const sep = document.createElement('span');
    sep.textContent = '—';
    container.appendChild(sep);

    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.placeholder = 'Max';
    maxInput.value = entry.max ?? '';
    maxInput.style.width = '80px';
    maxInput.addEventListener('change', () => {
      entry.max = maxInput.value;
      onChange();
    });
    container.appendChild(maxInput);
    return container;
  }

  if (column.input === 'select' && column.options) {
    const sel = document.createElement('select');
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '--';
    sel.appendChild(blank);
    for (const opt of column.options) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (entry.value === opt.value) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      entry.value = sel.value || undefined;
      onChange();
    });
    return sel;
  }

  const inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = 'Filter...';
  inp.value = entry.value ?? '';
  inp.style.width = '150px';
  inp.addEventListener('change', () => {
    entry.value = inp.value || undefined;
    onChange();
  });


  inp.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    entry.value = inp.value || undefined;
    onChange();
  });

  return inp;
}


function renderFilters<K extends TableKey>(tableKey: K) {
  filterContainer.innerHTML = '';
  const tableStructure = structure.tables[tableKey];
  const allColumns = Object.entries(tableStructure.columns);

  const addBar = document.createElement('div');
  addBar.style.marginBottom = '10px';
  addBar.style.display = 'flex';
  addBar.style.gap = '8px';
  addBar.style.alignItems = 'center';

  const addBtn = document.createElement('button');
  addBtn.textContent = '+ Agregar Filtro / Add Filter';
  addBtn.className = 'add-btn';
  addBtn.style.marginBottom = '0';
  addBar.appendChild(addBtn);

  const addDropdown = document.createElement('select');
  addDropdown.style.display = 'none';
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = '-- Seleccionar columna / Select column --';
  addDropdown.appendChild(ph);
  allColumns.forEach(([fieldName, column]) => {
    const opt = document.createElement('option');
    opt.value = fieldName;
    opt.textContent = column.label || fieldName;
    addDropdown.appendChild(opt);
  });
  addBar.appendChild(addDropdown);

  addBtn.addEventListener('click', () => {
    addDropdown.style.display = addDropdown.style.display === 'none' ? 'inline-block' : 'none';
  });

  addDropdown.addEventListener('change', () => {
    const fieldName = addDropdown.value;
    addDropdown.value = '';
    addDropdown.style.display = 'none';
    if (!fieldName) return;
    const col = (tableStructure.columns as Record<string, ColumnDef>)[fieldName];
    if (!col) return;
    const entry: FilterEntry = { negated: false };
    if (col.type === 'number') { entry.min = ''; entry.max = ''; }
    else { entry.value = ''; }
    if (!currentState.filters[fieldName]) currentState.filters[fieldName] = [];
    currentState.filters[fieldName].push(entry);
    currentState.page = 1;
    syncStateToUrl();
    renderFilters(tableKey);
    loadTableData(tableKey);
  });

  filterContainer.appendChild(addBar);

  for (const [fieldName, entries] of Object.entries(currentState.filters)) {
    for (let idx = 0; idx < entries.length; idx++) {
      const entry = entries[idx];
      const column = (tableStructure.columns as Record<string, ColumnDef>)[fieldName];
      if (!column) continue;

      const row = document.createElement('div');
      row.className = 'filter-row';
      if (entry.negated) row.classList.add('negated');

      const colDropdown = document.createElement('select');
      colDropdown.className = 'filter-col-select';
      allColumns.forEach(([fn, col]) => {
        const opt = document.createElement('option');
        opt.value = fn;
        opt.textContent = col.label || fn;
        if (fn === fieldName) opt.selected = true;
        colDropdown.appendChild(opt);
      });
      colDropdown.addEventListener('change', () => {
        const newField = colDropdown.value;
        if (newField === fieldName) return;
        const newCol = (tableStructure.columns as Record<string, ColumnDef>)[newField];
        if (!newCol) return;
        const oldType = getFilterType(column);
        const newType = getFilterType(newCol);
        if (oldType !== newType) {
          entry.value = undefined;
          entry.min = undefined;
          entry.max = undefined;
        }
        if (newCol.type === 'number') {
          if (entry.value) { entry.min = entry.value; entry.value = undefined; }
        } else {
          if (entry.min !== undefined) { entry.value = entry.min; entry.min = undefined; entry.max = undefined; }
        }
        if (!currentState.filters[newField]) currentState.filters[newField] = [];
        currentState.filters[newField].push(entry);
        currentState.filters[fieldName].splice(idx, 1);
        if (currentState.filters[fieldName].length === 0) delete currentState.filters[fieldName];
        currentState.page = 1;
        syncStateToUrl();
        renderFilters(tableKey);
        loadTableData(tableKey);
      });
      row.appendChild(colDropdown);

      const onChange = () => {
        currentState.page = 1;
        syncStateToUrl();
        loadTableData(tableKey);
      };

      row.appendChild(createFilterControl(entry, column, onChange));

      const negBtn = document.createElement('button');
      negBtn.textContent = 'NOT';
      negBtn.className = 'negate-btn';
      if (entry.negated) negBtn.classList.add('active');
      negBtn.title = 'Toggle negation';
      negBtn.addEventListener('click', () => {
        entry.negated = !entry.negated;
        currentState.page = 1;
        syncStateToUrl();
        renderFilters(tableKey);
        loadTableData(tableKey);
      });
      row.appendChild(negBtn);

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '✕';
      removeBtn.className = 'remove-filter-btn';
      removeBtn.title = 'Remove filter';
      removeBtn.addEventListener('click', () => {
        currentState.filters[fieldName].splice(idx, 1);
        if (currentState.filters[fieldName].length === 0) delete currentState.filters[fieldName];
        currentState.page = 1;
        syncStateToUrl();
        renderFilters(tableKey);
        loadTableData(tableKey);
      });
      row.appendChild(removeBtn);

      filterContainer.appendChild(row);
    }
  }
}

function renderPagination(total: number) {
  paginationContainer.innerHTML = '';
  const totalPages = Math.ceil(total / 20) || 1;

  const info = document.createElement('span');
  info.textContent = `Página ${currentState.page} de ${totalPages} (Total: ${total})`;
  paginationContainer.appendChild(info);

  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Anterior';
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
  nextBtn.textContent = 'Siguiente';
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

function showSection(section: TableKey, pushState = true) {
  if (activeTableKey !== section && pushState) {
    currentState = { page: 1, filters: {} };
    const cfg = structure.tables[section];
    const pkField = Array.isArray(cfg.pk) ? cfg.pk[0] : cfg.pk;
    const pkCol = (cfg.columns as Record<string, ColumnDef>)[pkField];
    if (pkCol) {
      const entry: FilterEntry = { negated: false };
      if (pkCol.type === 'number') { entry.min = ''; entry.max = ''; }
      else { entry.value = ''; }
      currentState.filters[pkField] = [entry];
    }
  }
  activeTableKey = section;

  if (pushState) syncStateToUrl();

  Object.entries(tableNavButtons).forEach(([key, button]) => {
    button.classList.toggle('active', key === section);
  });

  const tableConfig = structure.tables[section];
  viewTitle.textContent = tableConfig.title ?? '';
  addRecordBtn.textContent = tableConfig.addButtonLabel || `Agregar ${tableConfig.uiName} / Add ${tableConfig.uiName}`;
  hideAnyForm();
  renderFilters(section);
  loadTableData(section);
}

//Load 
async function loadTableData<K extends TableKey>(tableKey: K) {
  try {
    const params = new URLSearchParams();
    params.set('page', String(currentState.page));
    if (currentState.sort) {
      params.set('sort', currentState.sort);
      params.set('dir', currentState.dir || 'asc');
    }
    for (const [fieldName, entries] of Object.entries(currentState.filters)) {
      for (const entry of entries) {
        const val = serializeFilterValue(fieldName, entry);
        if (val !== null) params.append(`filter_${fieldName}`, val);
      }
    }

    const response = await fetch(`${API_BASE}/${tableKey}?${params.toString()}`);
    const result = await response.json();
    const data = result.data as TableRecordMap[K][];
    const total = result.total as number;

    renderAnyTable(tableKey, data);
    renderPagination(total);
  } catch (error) {
    console.error(`Error loading ${tableKey}:`, error);
    alert('Error al cargar datos / Error loading data');
  }
}

function renderAnyTable<K extends TableKey>(tableKey: K, records: TableRecordMap[K][]) {
  const thead = sharedTable.querySelector('thead')!;
  const tbody = sharedTable.querySelector('tbody')!;
  const tableStructure = structure.tables[tableKey];
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const headerRow = document.createElement('tr');
  Object.entries(tableStructure.columns).forEach(([fieldName, column]) => {
    const th = document.createElement('th');
    th.textContent = column.label || fieldName;
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

  const actionsHeader = document.createElement('th');
  actionsHeader.textContent = 'Acciones / Actions';
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

    const pkAndTheirValues = getPkFields(tableKey).map((pkFieldName) => [pkFieldName, String((payload as Record<string, unknown>)[pkFieldName])?? String((record as Record<string, unknown> | undefined)?.[pkFieldName]) ?? '']);
    const queryParams = new URLSearchParams(pkAndTheirValues).toString();

    try {
      await fetch(`${API_BASE}/${tableKey}?` + queryParams, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      hideAnyForm();
      loadTableData(tableKey);
    } catch (error) {
      console.error(`Error saving ${tableConfig.uiName.toLowerCase()}:`, error);
      alert('Error al guardar / Error saving');
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
    const response = await fetch(`${API_BASE}/${tableKey}?` + queryParams);
    const record = (await response.json()) as TableRecordMap[K];
    showAnyForm(tableKey, record);
  } catch (error) {
    console.error(`Error loading ${tableKey} for edit:`, error);
    alert('Error al cargar registro / Error loading record');
  }
};
window.deleteRecord = async <K extends TableKey>(tableKey: K, ...pkValues: string[]) => {
  const tableConfig = structure.tables[tableKey];
  if (confirm(`¿Está seguro de que desea eliminar este ${tableConfig.uiName.toLowerCase()}? / Are you sure you want to delete this ${tableConfig.uiName.toLowerCase()}?`)) {
    try {
      const queryParams = new URLSearchParams(getPkFields(tableKey).map((pkFieldName, index) => [pkFieldName, pkValues[index]])).toString();
      await fetch(`${API_BASE}/${tableKey}?` + queryParams, { method: 'DELETE' });
      loadTableData(tableKey);
    } catch (error) {
      console.error(`Error deleting ${tableKey}:`, error);
      alert('Error al eliminar / Error deleting');
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

// Initialize
syncUrlToState();
showSection(activeTableKey, true);
showMenu();

export { };
