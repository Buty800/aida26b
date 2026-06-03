import type { Response } from 'express';
import { structure } from '../../../shared/src/ssot/structure';
import { getPkFields } from '../../../shared/src/utils/utils';
import type { ColumnDef, ColumnValidator, TableKey, TableRecordMap } from '../../../shared/src/types/types';

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

function checkDate(key: string, v: ColumnValidator, value: unknown): string | undefined {
  const parsed = new Date(value as string);
  if (isNaN(parsed.getTime())) return `${key} must be a valid date`;

  const day = literalDay(parsed);

  // Day-offsets are signed whole calendar days from today (in Argentina's timezone).
  const diffDays = Math.round((day - argentinaDay(Date.now())) / MS_PER_DAY);
  if (typeof v.maxDayOffset === 'number' && diffDays > v.maxDayOffset) {
    return v.maxDayOffset === 0 ? `${key} must not be in the future` : `${key} must be on or before ${offsetText(v.maxDayOffset)}`;
  }
  if (typeof v.minDayOffset === 'number' && diffDays < v.minDayOffset) {
    return v.minDayOffset === 0 ? `${key} must not be in the past` : `${key} must be on or after ${offsetText(v.minDayOffset)}`;
  }

  return undefined;
}

function checkValue(key: string, col: ColumnDef, value: unknown): string | undefined {
  const v = col.validator ?? {};

  switch (col.type) {
    case 'string':
      if (typeof value !== 'string') return `${key} must be a string`;
      break;
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) return `${key} must be a number`;
      if (v.integer && !Number.isInteger(value)) return `${key} must be an integer`;
      break;
    case 'boolean':
      if (typeof value !== 'boolean') return `${key} must be a boolean`;
      break;
  }

  if (col.type === 'date' || col.input === 'date') {
    const dateError = checkDate(key, v, value);
    if (dateError) return dateError;
  }

  if (col.options && !col.options.some((o) => o.value === value)) {
    return `${key} must be one of: ${col.options.map((o) => o.value).join(', ')}`;
  }

  if (v.pattern && (typeof value !== 'string' || !getRegex(v.pattern).test(value))) {
    return v.patternMessage ? `${key} ${v.patternMessage}` : `${key} has an invalid format`;
  }

  if (typeof value === 'string') {
    if (typeof v.minLength === 'number' && value.length < v.minLength) return `${key} must be at least ${v.minLength} characters`;
    if (typeof v.maxLength === 'number' && value.length > v.maxLength) return `${key} must be at most ${v.maxLength} characters`;
  }
  if (typeof value === 'number') {
    if (typeof v.minValue === 'number' && value < v.minValue) return `${key} must be >= ${v.minValue}`;
    if (typeof v.maxValue === 'number' && value > v.maxValue) return `${key} must be <= ${v.maxValue}`;
  }

  return undefined;
}

function normalizeValue(col: ColumnDef, value: unknown): unknown {
  const norm = col.validator?.normalize;
  return norm && typeof value === 'string'
    ? value.replace(getRegex(norm.pattern), norm.replacement)
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
      if (col.validator?.required) errors.push(`${key} is required`);
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
