import { formatDateOnly, formatInstant } from '../../../shared/lib/date-time';
import type { RecordType } from '../types/record';
import {
  getRecordTypeDefinition,
  type RecordColumnDefinition,
  type RecordFieldDefinition,
  type RecordFieldKind,
  type RecordFieldOption,
} from './record-type-definitions';

export interface RecordDetailsTextField {
  key: string;
  label: string;
  value: string;
  wide: boolean;
}

export interface RecordDetailsFieldsBlock {
  kind: 'fields';
  key: string;
  fields: RecordDetailsTextField[];
}

export interface RecordDetailsListBlock {
  kind: 'list';
  key: string;
  label: string;
  items: string[];
}

export interface RecordDetailsTableColumn {
  key: string;
  label: string;
}

export interface RecordDetailsTableBlock {
  kind: 'table';
  key: string;
  label: string;
  columns: RecordDetailsTableColumn[];
  rows: string[][];
}

export type RecordDetailsBlock =
  | RecordDetailsFieldsBlock
  | RecordDetailsListBlock
  | RecordDetailsTableBlock;

export interface RecordDetailsSection {
  id: string;
  title: string;
  blocks: RecordDetailsBlock[];
}

type UnknownObject = Record<string, unknown>;

function isObject(value: unknown): value is UnknownObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function valueAtPath(source: UnknownObject, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!isObject(current)) return undefined;
    return current[segment];
  }, source);
}

function optionLabel(
  value: string,
  options: readonly RecordFieldOption[] | undefined,
): string {
  return options?.find((option) => option.value === value)?.label ?? value;
}

function displayValue(
  value: unknown,
  kind: Exclude<RecordFieldKind, 'repeatable'> | undefined,
  options?: readonly RecordFieldOption[],
): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (kind === 'select') return optionLabel(trimmed, options);
    if (kind === 'date') {
      return formatDateOnly(
        trimmed,
        { day: '2-digit', month: 'long', year: 'numeric' },
        trimmed,
      );
    }
    if (kind === 'datetime-local') {
      return formatInstant(
        trimmed,
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        },
        trimmed,
      );
    }

    return trimmed;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 20 }).format(value);
  }
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';

  return null;
}

function scalarList(
  value: unknown,
  field: RecordFieldDefinition,
): RecordDetailsListBlock | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .map((item) => displayValue(item, field.kind === 'repeatable' ? undefined : field.kind, field.options))
    .filter((item): item is string => Boolean(item));

  return items.length > 0
    ? { kind: 'list', key: field.key, label: field.label, items }
    : null;
}

function columnValue(row: UnknownObject, column: RecordColumnDefinition): string | null {
  return displayValue(row[column.key], column.kind, column.options);
}

function repeatableTable(
  value: unknown,
  field: RecordFieldDefinition,
): RecordDetailsTableBlock | null {
  if (!Array.isArray(value) || !field.columns?.length) return null;
  const sourceRows = value.filter(isObject);
  if (sourceRows.length === 0) return null;

  const visibleColumns = field.columns.filter((column) =>
    sourceRows.some((row) => columnValue(row, column) !== null),
  );
  if (visibleColumns.length === 0) return null;

  const rows = sourceRows
    .map((row) => visibleColumns.map((column) => columnValue(row, column) ?? '—'))
    .filter((row) => row.some((cell) => cell !== '—'));
  if (rows.length === 0) return null;

  return {
    kind: 'table',
    key: field.key,
    label: field.label,
    columns: visibleColumns.map(({ key, label }) => ({ key, label })),
    rows,
  };
}

/**
 * Convierte el JSON clínico a una representación estable para pantalla,
 * búsqueda y PDF. Los objetos vacíos de registros legacy producen `[]`.
 */
export function getRecordDetailsPresentation(
  recordType: RecordType,
  details: unknown,
): RecordDetailsSection[] {
  if (!isObject(details)) return [];

  return getRecordTypeDefinition(recordType).sections.flatMap((section) => {
    const blocks: RecordDetailsBlock[] = [];
    let pendingFields: RecordDetailsTextField[] = [];

    const flushFields = () => {
      if (pendingFields.length === 0) return;
      blocks.push({
        kind: 'fields',
        key: `${section.id}-fields-${blocks.length}`,
        fields: pendingFields,
      });
      pendingFields = [];
    };

    for (const field of section.fields) {
      const value = valueAtPath(details, field.key);

      if (field.kind === 'repeatable') {
        flushFields();
        const table = repeatableTable(value, field);
        const list = table ? null : scalarList(value, field);
        if (table) blocks.push(table);
        else if (list) blocks.push(list);
        continue;
      }

      if (Array.isArray(value)) {
        flushFields();
        const list = scalarList(value, field);
        if (list) blocks.push(list);
        continue;
      }

      const formatted = displayValue(value, field.kind, field.options);
      if (formatted) {
        pendingFields.push({
          key: field.key,
          label: field.label,
          value: formatted,
          wide: field.kind === 'textarea',
        });
      }
    }

    flushFields();
    return blocks.length > 0 ? [{ id: section.id, title: section.title, blocks }] : [];
  });
}

export function getRecordDetailsSearchText(sections: RecordDetailsSection[]): string {
  return sections
    .flatMap((section) => [
      section.title,
      ...section.blocks.flatMap((block) => {
        if (block.kind === 'fields') {
          return block.fields.flatMap((field) => [field.label, field.value]);
        }
        if (block.kind === 'list') return [block.label, ...block.items];
        return [
          block.label,
          ...block.columns.map((column) => column.label),
          ...block.rows.flat(),
        ];
      }),
    ])
    .join('\n')
    .toLocaleLowerCase('es-PE');
}

export function recordDetailsIncludeValue(
  sections: RecordDetailsSection[],
  value: string | null | undefined,
): boolean {
  const normalized = value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-PE');
  if (!normalized) return false;

  const values = sections.flatMap((section) =>
    section.blocks.flatMap((block) => {
      if (block.kind === 'fields') return block.fields.map((field) => field.value);
      if (block.kind === 'list') return block.items;
      return block.rows.flat();
    }),
  );

  return values.some(
    (candidate) => candidate.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-PE') === normalized,
  );
}
