import {
  RECORD_SCHEMA_VERSION,
  type DeepPartial,
  type RecordDetails,
  type RecordDetailsByType,
  type RecordDraftPayload,
  type RecordPriority,
  type RecordType,
  type TypedCreateRecordData,
} from '../../../../../../features/clinical-records/types/record';
import {
  RECORD_TYPE_DEFINITIONS,
  createEmptyRecordDetails,
  type RecordFieldDefinition,
} from '../../../../../../features/clinical-records/lib/record-type-definitions';
import {
  currentDateTimeLocal,
  dateTimeLocalToIso,
  isoToDateTimeLocal,
  isFutureDateTimeLocal,
  isValidDateOnly,
} from '../../../../../../shared/lib/date-time';

export interface CommonRecordFormState {
  recordType: RecordType | '';
  attendedAt: string;
  professionalId: string;
  doctorName: string;
  professionalLicense: string;
  service: string;
  summary: string;
  notes: string;
  preliminaryDiagnosis: string;
  plan: string;
  priority: RecordPriority;
}

export type RecordDetailsFormState = {
  [Type in RecordType]: RecordDetailsByType[Type];
};

/** Reserva tipada para referencias de adjuntos cuando exista el contrato media. */
export interface RecordAttachmentFormReference {
  assetId: string;
  sectionKey?: string;
  caption?: string;
  altText?: string;
  sortOrder?: number;
}

export interface RecordEditorState extends CommonRecordFormState {
  detailsByType: RecordDetailsFormState;
  attachments: RecordAttachmentFormReference[];
}

export interface RecordFormError {
  id: string;
  label: string;
  message: string;
}

export const COMMON_FIELD_IDS = {
  recordType: 'record-recordType',
  attendedAt: 'record-attendedAt',
  doctorName: 'record-doctorName',
  professionalLicense: 'record-professionalLicense',
  service: 'record-service',
  summary: 'record-summary',
  notes: 'record-notes',
  preliminaryDiagnosis: 'record-preliminaryDiagnosis',
  plan: 'record-plan',
  priority: 'record-priority',
} as const;

const COMMON_LABELS: Record<keyof typeof COMMON_FIELD_IDS, string> = {
  recordType: 'Tipo de registro',
  attendedAt: 'Fecha y hora de atención',
  doctorName: 'Médico o profesional',
  professionalLicense: 'Colegiatura o registro profesional',
  service: 'Servicio o especialidad',
  summary: 'Resumen clínico',
  notes: 'Notas adicionales',
  preliminaryDiagnosis: 'Diagnóstico preliminar',
  plan: 'Indicaciones o plan',
  priority: 'Prioridad',
};

export function detailFieldId(type: RecordType, path: string): string {
  return `record-details-${type.toLowerCase()}-${path.replaceAll('.', '-')}`;
}

export function repeatedFieldId(
  type: RecordType,
  fieldKey: string,
  index: number,
  columnKey: string,
): string {
  return detailFieldId(type, `${fieldKey}-${index}-${columnKey}`);
}

export function createEmptyEditorState(): RecordEditorState {
  return {
    recordType: '',
    attendedAt: currentDateTimeLocal(),
    professionalId: '',
    doctorName: '',
    professionalLicense: '',
    service: '',
    summary: '',
    notes: '',
    preliminaryDiagnosis: '',
    plan: '',
    priority: 'NORMAL',
    detailsByType: {
      CONSULTATION: createEmptyRecordDetails('CONSULTATION'),
      EVOLUTION: createEmptyRecordDetails('EVOLUTION'),
      LAB_RESULT: createEmptyRecordDetails('LAB_RESULT'),
      PRESCRIPTION: createEmptyRecordDetails('PRESCRIPTION'),
      PROCEDURE: createEmptyRecordDetails('PROCEDURE'),
      THERAPY_NOTE: createEmptyRecordDetails('THERAPY_NOTE'),
      OTHER: createEmptyRecordDetails('OTHER'),
    },
    attachments: [],
  };
}

export function getValueAtPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

export function setValueAtPath<T>(source: T, path: string, value: unknown): T {
  const keys = path.split('.');
  const root = { ...(source as Record<string, unknown>) };
  let cursor = root;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
      return;
    }
    const previous = cursor[key];
    const next = previous && typeof previous === 'object' && !Array.isArray(previous)
      ? { ...(previous as Record<string, unknown>) }
      : {};
    cursor[key] = next;
    cursor = next;
  });
  return root as T;
}

export function createEmptyRepeatableItem(fieldKey: string): Record<string, unknown> {
  switch (fieldKey) {
    case 'diagnoses':
      return { description: '', code: '', codeSystem: '', type: '' };
    case 'results':
      return { analyte: '', value: '', unit: '', referenceRange: '', flag: '' };
    case 'medications':
      return {
        name: '', presentation: '', concentration: '', dose: '', route: '',
        frequency: '', duration: '', quantity: '', instructions: '',
      };
    case 'measurements':
      return { name: '', value: '', unit: '' };
    default:
      return {};
  }
}

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && !value.trim());
}

function hasRowContent(row: unknown): boolean {
  return Boolean(row && typeof row === 'object' && Object.values(row).some((value) => !isEmptyValue(value)));
}

function cleanDetailsValue(value: unknown): unknown {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(value)) {
    const cleaned = value
      .filter(hasRowContent)
      .map(cleanDetailsValue)
      .filter((entry) => entry !== undefined);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, nested]) => [key, cleanDetailsValue(nested)] as const)
      .filter(([, nested]) => nested !== undefined);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }
  return value;
}

function convertDetailDateTimes(
  type: RecordType,
  details: Record<string, unknown>,
): Record<string, unknown> {
  let converted = details;
  for (const section of RECORD_TYPE_DEFINITIONS[type].sections) {
    for (const field of section.fields) {
      if (field.kind !== 'datetime-local') continue;
      const localValue = getValueAtPath(converted, field.key);
      if (typeof localValue !== 'string' || !localValue) continue;
      const iso = dateTimeLocalToIso(localValue);
      if (iso) converted = setValueAtPath(converted, field.key, iso);
    }
  }
  return converted;
}

function restoreDetailDateTimes(
  type: RecordType,
  details: Record<string, unknown>,
): Record<string, unknown> {
  let restored = details;
  for (const section of RECORD_TYPE_DEFINITIONS[type].sections) {
    for (const field of section.fields) {
      if (field.kind !== 'datetime-local') continue;
      const isoValue = getValueAtPath(restored, field.key);
      if (typeof isoValue !== 'string' || !isoValue) continue;
      restored = setValueAtPath(restored, field.key, isoToDateTimeLocal(isoValue));
    }
  }
  return restored;
}

function selectedDetails(state: RecordEditorState): RecordDetails | undefined {
  if (!state.recordType) return undefined;
  return state.detailsByType[state.recordType];
}

export function toDraftPayload(state: RecordEditorState): RecordDraftPayload {
  const attendedAt = state.attendedAt ? dateTimeLocalToIso(state.attendedAt) : null;
  const rawDetails = selectedDetails(state);
  const cleanedDetails = state.recordType && rawDetails
    ? cleanDetailsValue(convertDetailDateTimes(
      state.recordType,
      rawDetails as unknown as Record<string, unknown>,
    )) as DeepPartial<RecordDetails> | undefined
    : undefined;

  return {
    ...(state.recordType ? { recordType: state.recordType } : {}),
    ...(attendedAt ? { attendedAt } : {}),
    ...(state.summary.trim() ? { summary: state.summary.trim() } : {}),
    ...(state.notes.trim() ? { notes: state.notes.trim() } : {}),
    ...(state.professionalId ? { professionalId: state.professionalId } : {}),
    ...(state.doctorName.trim() ? { doctorName: state.doctorName.trim() } : {}),
    ...(state.professionalLicense.trim() ? { professionalLicense: state.professionalLicense.trim() } : {}),
    ...(state.service.trim() ? { service: state.service.trim() } : {}),
    ...(state.preliminaryDiagnosis.trim()
      ? { preliminaryDiagnosis: state.preliminaryDiagnosis.trim() }
      : {}),
    ...(state.plan.trim() ? { plan: state.plan.trim() } : {}),
    priority: state.priority,
    ...(state.recordType ? { schemaVersion: RECORD_SCHEMA_VERSION } : {}),
    ...(cleanedDetails ? { details: cleanedDetails } : {}),
  };
}

export function restoreEditorState(payload: RecordDraftPayload): RecordEditorState {
  const next = createEmptyEditorState();
  next.recordType = payload.recordType ?? '';
  next.attendedAt = payload.attendedAt ? isoToDateTimeLocal(payload.attendedAt) : next.attendedAt;
  next.professionalId = payload.professionalId ?? '';
  next.doctorName = payload.doctorName ?? '';
  next.professionalLicense = payload.professionalLicense ?? '';
  next.service = payload.service ?? '';
  next.summary = payload.summary ?? '';
  next.notes = payload.notes ?? '';
  next.preliminaryDiagnosis = payload.preliminaryDiagnosis ?? '';
  next.plan = payload.plan ?? '';
  next.priority = payload.priority ?? 'NORMAL';

  if (payload.recordType && payload.details) {
    const type = payload.recordType;
    const base = next.detailsByType[type] as unknown as Record<string, unknown>;
    const restored = restoreDetailDateTimes(type, payload.details as Record<string, unknown>);
    next.detailsByType = {
      ...next.detailsByType,
      [type]: {
        ...base,
        ...restored,
        ...(type === 'CONSULTATION' && restored.vitalSigns
          ? { vitalSigns: { ...(base.vitalSigns as object), ...(restored.vitalSigns as object) } }
          : {}),
      },
    } as RecordDetailsFormState;
  }
  return next;
}

function validateCommon(state: RecordEditorState): RecordFormError[] {
  const errors: RecordFormError[] = [];
  const add = (key: keyof typeof COMMON_FIELD_IDS, message: string) => {
    errors.push({ id: COMMON_FIELD_IDS[key], label: COMMON_LABELS[key], message });
  };

  if (!state.recordType) add('recordType', 'Selecciona un tipo de registro.');
  if (!state.attendedAt) add('attendedAt', 'Ingresa la fecha y hora de atención.');
  else if (!dateTimeLocalToIso(state.attendedAt)) add('attendedAt', 'Ingresa una fecha y hora válida.');
  else if (isFutureDateTimeLocal(state.attendedAt)) add('attendedAt', 'No puede estar en el futuro.');
  if (!state.doctorName.trim()) add('doctorName', 'Ingresa el profesional responsable.');
  else if (state.doctorName.length > 120) add('doctorName', 'Usa 120 caracteres o menos.');
  if (state.professionalLicense.length > 80) add('professionalLicense', 'Usa 80 caracteres o menos.');
  if (state.service.length > 120) add('service', 'Usa 120 caracteres o menos.');
  if (!state.summary.trim()) add('summary', 'Ingresa un resumen clínico.');
  else if (state.summary.length > 2000) add('summary', 'Usa 2000 caracteres o menos.');
  if (state.notes.length > 4000) add('notes', 'Usa 4000 caracteres o menos.');
  if (state.preliminaryDiagnosis.length > 300) {
    add('preliminaryDiagnosis', 'Usa 300 caracteres o menos.');
  }
  if (state.plan.length > 2000) add('plan', 'Usa 2000 caracteres o menos.');
  return errors;
}

function validateScalar(
  type: RecordType,
  field: RecordFieldDefinition,
  value: unknown,
): RecordFormError[] {
  const errors: RecordFormError[] = [];
  const id = detailFieldId(type, field.key);
  if (field.required && isEmptyValue(value)) {
    errors.push({ id, label: field.label, message: 'Este campo es obligatorio.' });
    return errors;
  }
  if (isEmptyValue(value)) return errors;
  if (typeof value === 'string' && field.maxLength && value.length > field.maxLength) {
    errors.push({ id, label: field.label, message: `Usa ${field.maxLength} caracteres o menos.` });
  }
  if (field.kind === 'datetime-local' && typeof value === 'string' && !dateTimeLocalToIso(value)) {
    errors.push({ id, label: field.label, message: 'Ingresa una fecha y hora válida.' });
  } else if (
    field.kind === 'datetime-local'
    && field.pastOrPresent
    && typeof value === 'string'
    && isFutureDateTimeLocal(value)
  ) {
    errors.push({ id, label: field.label, message: 'No puede estar en el futuro.' });
  } else if (field.kind === 'date' && typeof value === 'string' && !isValidDateOnly(value)) {
    errors.push({ id, label: field.label, message: 'Ingresa una fecha válida.' });
  }
  if (field.kind === 'number' && typeof value === 'number') {
    const precision = field.step && field.step < 1
      ? (String(field.step).split('.')[1]?.length ?? 0)
      : 0;
    const scale = 10 ** precision;
    if (!Number.isFinite(value)) {
      errors.push({ id, label: field.label, message: 'Ingresa un número válido.' });
    } else if (field.step === 1 && !Number.isInteger(value)) {
      errors.push({ id, label: field.label, message: 'Ingresa un número entero.' });
    } else if (precision > 0 && Math.abs(value * scale - Math.round(value * scale)) > 1e-8) {
      errors.push({
        id,
        label: field.label,
        message: `Usa como máximo ${precision} ${precision === 1 ? 'decimal' : 'decimales'}.`,
      });
    } else if (field.min !== undefined && value < field.min) {
      errors.push({ id, label: field.label, message: `El valor mínimo es ${field.min}.` });
    } else if (field.max !== undefined && value > field.max) {
      errors.push({ id, label: field.label, message: `El valor máximo es ${field.max}.` });
    }
  }
  return errors;
}

function validateRepeatable(
  type: RecordType,
  field: RecordFieldDefinition,
  value: unknown,
): RecordFormError[] {
  const rows = Array.isArray(value) ? value : [];
  const meaningfulRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => hasRowContent(row));
  const errors: RecordFormError[] = [];
  if (field.required && meaningfulRows.length === 0) {
    errors.push({
      id: detailFieldId(type, field.key),
      label: field.label,
      message: 'Agrega al menos un elemento completo.',
    });
  }
  if (field.maxItems && meaningfulRows.length > field.maxItems) {
    errors.push({
      id: detailFieldId(type, field.key),
      label: field.label,
      message: `Admite como máximo ${field.maxItems} elementos.`,
    });
  }
  for (const { row, index } of meaningfulRows) {
    if (!row || typeof row !== 'object') continue;
    for (const column of field.columns ?? []) {
      const columnValue = (row as Record<string, unknown>)[column.key];
      if (column.required && isEmptyValue(columnValue)) {
        errors.push({
          id: repeatedFieldId(type, field.key, index, column.key),
          label: `${column.label} (${field.itemLabel ?? 'Elemento'} ${index + 1})`,
          message: 'Este campo es obligatorio.',
        });
      } else if (
        typeof columnValue === 'string'
        && column.maxLength
        && columnValue.length > column.maxLength
      ) {
        errors.push({
          id: repeatedFieldId(type, field.key, index, column.key),
          label: `${column.label} (${field.itemLabel ?? 'Elemento'} ${index + 1})`,
          message: `Usa ${column.maxLength} caracteres o menos.`,
        });
      }
    }
  }
  return errors;
}

export function validateEditorState(state: RecordEditorState): RecordFormError[] {
  const errors = validateCommon(state);
  if (!state.recordType) return errors;
  const type = state.recordType;
  const details = state.detailsByType[type];
  for (const section of RECORD_TYPE_DEFINITIONS[type].sections) {
    for (const field of section.fields) {
      const value = getValueAtPath(details, field.key);
      errors.push(...(field.kind === 'repeatable'
        ? validateRepeatable(type, field, value)
        : validateScalar(type, field, value)));
    }
  }

  if (type === 'PRESCRIPTION') {
    const prescription = state.detailsByType.PRESCRIPTION;
    if (prescription.validFrom && prescription.validUntil
      && prescription.validUntil < prescription.validFrom) {
      errors.push({
        id: detailFieldId(type, 'validUntil'),
        label: 'Válida hasta',
        message: 'Debe ser igual o posterior a la fecha inicial.',
      });
    }
  }
  if (type === 'LAB_RESULT') {
    const lab = state.detailsByType.LAB_RESULT;
    if (lab.collectedAt && lab.issuedAt) {
      const collected = dateTimeLocalToIso(lab.collectedAt);
      const issued = dateTimeLocalToIso(lab.issuedAt);
      if (collected && issued && new Date(issued) < new Date(collected)) {
        errors.push({
          id: detailFieldId(type, 'issuedAt'),
          label: 'Fecha y hora de emisión',
          message: 'No puede ser anterior a la toma de la muestra.',
        });
      }
    }
  }
  return errors;
}

export function toCreateRecordData(
  state: RecordEditorState,
  draftId?: string,
): TypedCreateRecordData | null {
  if (!state.recordType) return null;
  const attendedAt = dateTimeLocalToIso(state.attendedAt);
  if (!attendedAt) return null;
  const type = state.recordType;
  const cleaned = cleanDetailsValue(convertDetailDateTimes(
    type,
    state.detailsByType[type] as unknown as Record<string, unknown>,
  )) as RecordDetailsByType[typeof type];

  return {
    recordType: type,
    schemaVersion: RECORD_SCHEMA_VERSION,
    details: cleaned,
    attendedAt,
    summary: state.summary.trim(),
    ...(state.notes.trim() ? { notes: state.notes.trim() } : {}),
    ...(state.professionalId ? { professionalId: state.professionalId } : {}),
    ...(state.doctorName.trim() ? { doctorName: state.doctorName.trim() } : {}),
    ...(state.professionalLicense.trim()
      ? { professionalLicense: state.professionalLicense.trim() }
      : {}),
    ...(state.service.trim() ? { service: state.service.trim() } : {}),
    ...(state.preliminaryDiagnosis.trim()
      ? { preliminaryDiagnosis: state.preliminaryDiagnosis.trim() }
      : {}),
    ...(state.plan.trim() ? { plan: state.plan.trim() } : {}),
    priority: state.priority,
    ...(draftId ? { draftId } : {}),
  } as TypedCreateRecordData;
}

export function hasMeaningfulEditorData(state: RecordEditorState): boolean {
  if (state.recordType || state.doctorName.trim() || state.professionalLicense.trim()
    || state.service || state.summary.trim() || state.notes.trim()
    || state.preliminaryDiagnosis.trim() || state.plan.trim()) return true;
  return false;
}
