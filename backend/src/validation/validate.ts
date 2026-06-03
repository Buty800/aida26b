import type { Response } from 'express';
import { structure } from '../../../shared/src/ssot/structure';
import { getPkFields } from '../../../shared/src/utils/utils';
import type { ColumnDef, TableKey, TableRecordMap } from '../../../shared/src/types/types';

export type ParseResult<T extends TableKey> = { data: TableRecordMap[T] } | { errors: string[] };

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Argentina (America/Argentina/Buenos_Aires) is UTC-3 all year — no daylight saving.
const ARGENTINA_OFFSET_MS = -3 * 60 * 60 * 1000;

// Patterns come from the static SSOT, so compile each once and reuse.
const regexCache = new Map<string, RegExp>();
function getRegex(source: string): RegExp {
  let re = regexCache.get(source);
  if (!re) { re = new RegExp(source); regexCache.set(source, re); }
  return re;
}

function offsetText(days: number): string {
  if (days === 0) return 'today';
  return days > 0 ? `${days} day(s) in the future` : `${-days} day(s) in the past`;
}

// Calendar-day key for a bare date value, taken literally (parsed as UTC midnight).
function literalDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Calendar-day key for the day an instant falls on in Argentina's timezone.
function argentinaDay(ms: number): number {
  const local = new Date(ms + ARGENTINA_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
}

function checkDate(key: string, col: ColumnDef, value: unknown): string | undefined {
  const parsed = new Date(value as string);
  if (isNaN(parsed.getTime())) return `${key} must be a valid date`;

  const day = literalDay(parsed);

  // Relative bounds: min/max are signed offsets in whole calendar days from today (in Argentina's timezone)
  const diffDays = Math.round((day - argentinaDay(Date.now())) / MS_PER_DAY);
  if (typeof col.max === 'number' && diffDays > col.max) {
    return col.max === 0 ? `${key} must not be in the future` : `${key} must be on or before ${offsetText(col.max)}`;
  }
  if (typeof col.min === 'number' && diffDays < col.min) {
    return col.min === 0 ? `${key} must not be in the past` : `${key} must be on or after ${offsetText(col.min)}`;
  }

  return undefined;
}

function checkValue(key: string, col: ColumnDef, value: unknown): string | undefined {
  switch (col.type) {
    case 'string':
      if (typeof value !== 'string') return `${key} must be a string`;
      break;
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) return `${key} must be a number`;
      if (col.integer && !Number.isInteger(value)) return `${key} must be an integer`;
      break;
    case 'boolean':
      if (typeof value !== 'boolean') return `${key} must be a boolean`;
      break;
  }

  const isDate = col.type === 'date' || col.input === 'date';
  if (isDate) {
    const dateError = checkDate(key, col, value);
    if (dateError) return dateError;
  }

  if (col.options && !col.options.some((o) => o.value === value)) {
    return `${key} must be one of: ${col.options.map((o) => o.value).join(', ')}`;
  }

  if (col.pattern && (typeof value !== 'string' || !getRegex(col.pattern).test(value))) {
    return col.patternMessage ? `${key} ${col.patternMessage}` : `${key} has an invalid format`;
  }

  // min / max — length for strings, value for numbers (dates consume min/max as day-offsets in checkDate)
  if (!isDate && typeof col.min === 'number') {
    if (typeof value === 'string' && value.length < col.min) return `${key} must be at least ${col.min} characters`;
    if (typeof value === 'number' && value < col.min) return `${key} must be >= ${col.min}`;
  }
  if (!isDate && typeof col.max === 'number') {
    if (typeof value === 'string' && value.length > col.max) return `${key} must be at most ${col.max} characters`;
    if (typeof value === 'number' && value > col.max) return `${key} must be <= ${col.max}`;
  }

  return undefined;
}

function normalizeValue(col: ColumnDef, value: unknown): unknown {
  return col.normalize && typeof value === 'string'
    ? value.replace(getRegex(col.normalize.pattern), col.normalize.replacement)
    : value;
}

// A table's columns minus the display-only (joined) ones.
function editableColumns(table: TableKey): string[] {
  return Object.entries(structure.tables[table].columns as Record<string, ColumnDef>)
    .filter(([, col]) => col.editable !== false)
    .map(([key]) => key);
}

// Core: validate a data object against `fields` — it must hold exactly those columns (nothing
// unexpected, nothing missing) and every value must be valid. Values are normalized; an empty
// optional field becomes null.
function validate<T extends TableKey>(table: T, data: unknown, fields: string[]): ParseResult<T> {
  const columns = structure.tables[table].columns as Record<string, ColumnDef>;
  const obj = (data != null && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const allowed = new Set(fields);
  const errors: string[] = [];
  const out: Record<string, unknown> = {};

  // Too many: reject anything outside the expected set.
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) errors.push(`${key} is not an allowed field`);
  }

  for (const key of fields) {
    const col = columns[key];
    if (!col) { errors.push(`${key} is not a valid field`); continue; }
    if (!(key in obj)) { errors.push(`${key} is required`); continue; } // too few

    const raw = obj[key];
    const empty = raw === null || (col.type === 'string' && raw === '');
    if (empty) {
      if (col.required) errors.push(`${key} is required`);
      else out[key] = null; // optional columns are nullable in the schema
      continue;
    }

    const error = checkValue(key, col, raw);
    if (error) { errors.push(error); continue; }
    out[key] = normalizeValue(col, raw);
  }

  return errors.length > 0 ? { errors } : { data: out as TableRecordMap[T] };
}

// Validate a full record (a POST/PUT body): every editable column, nothing missing or extra.
export const validateFullObject = <T extends TableKey>(table: T, data: unknown): ParseResult<T> =>
  validate(table, data, editableColumns(table));

// Validate only the primary-key columns (e.g. PK params from the query string on a lookup or delete).
export const validateOnlyPk = <T extends TableKey>(table: T, data: unknown): ParseResult<T> =>
  validate(table, data, getPkFields(table));

// Responds 400 and returns true when the result holds errors; the predicate narrows it to `{ data }` otherwise.
export function sendErrorsIfInvalid<T>(
  res: Response,
  result: { data: T } | { errors: string[] },
): result is { errors: string[] } {
  if ('errors' in result) {
    res.status(400).json({ error: result.errors.join('; ') });
    return true;
  }
  return false;
}
