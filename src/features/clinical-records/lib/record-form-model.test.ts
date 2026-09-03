import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { ClinicalRecord, RecordDetails, RecordType } from '../types/record';
import {
  createCorrectionEditorState,
  createEmptyEditorState,
  recordEditorFingerprint,
  restoreEditorState,
  toCorrectRecordData,
  toDraftPayload,
  validateEditorState,
} from '../../../app/(private)/patients/[id]/records/new/record-form-model';

function recordFixture(patch: Partial<ClinicalRecord> = {}): ClinicalRecord {
  return {
    id: 'record-1',
    patientId: 'patient-1',
    recordType: 'CONSULTATION',
    origin: 'MANUAL',
    status: 'ACTIVE',
    attendedAt: '2020-01-15T15:30:42.123Z',
    summary: 'Resumen original',
    notes: 'Nota original',
    doctorName: 'Nombre histórico',
    professionalId: null,
    professionalNameSnapshot: 'Dra. Ana Pérez',
    professionalLicenseSnapshot: 'CMP 12345',
    service: 'Medicina General',
    preliminaryDiagnosis: 'Diagnóstico original',
    plan: 'Plan original',
    priority: 'NORMAL',
    schemaVersion: 1,
    details: { chiefComplaint: 'Cefalea' },
    version: 7,
    parentRecordId: null,
    voidReason: null,
    correctionsCount: 0,
    createdAt: '2020-01-15T15:35:00.000Z',
    createdBy: 'user-1',
    updatedAt: '2020-01-15T15:35:00.000Z',
    ...patch,
  };
}

function validCommon(recordType: RecordType) {
  const state = createEmptyEditorState();
  state.recordType = recordType;
  state.attendedAt = '2020-01-15T10:30';
  state.doctorName = 'Dra. Ana Pérez';
  state.summary = 'Resumen clínico verificable.';
  return state;
}

test('valida los mínimos de consulta y acepta la plantilla completa', () => {
  const state = validCommon('CONSULTATION');
  const initial = validateEditorState(state);
  assert.equal(initial.some((error) => error.label === 'Motivo de consulta'), true);

  state.detailsByType.CONSULTATION.chiefComplaint = 'Cefalea de dos días de evolución.';
  assert.deepEqual(validateEditorState(state), []);
});

test('limpia filas vacías y convierte fechas del laboratorio al contrato ISO', () => {
  const state = validCommon('LAB_RESULT');
  state.detailsByType.LAB_RESULT.studyName = 'Hemograma completo';
  state.detailsByType.LAB_RESULT.collectedAt = '2020-01-15T08:00';
  state.detailsByType.LAB_RESULT.results = [
    { analyte: 'Hemoglobina', value: '13.5', unit: 'g/dL' },
    { analyte: '', value: '', unit: '' },
  ];

  assert.deepEqual(validateEditorState(state), []);
  const payload = toDraftPayload(state);
  const details = payload.details as { collectedAt?: string; results?: unknown[] };
  assert.match(details.collectedAt ?? '', /^2020-01-15T13:00:00\.000Z$/);
  assert.equal(details.results?.length, 1);
});

test('prescripción exige una pauta explícita y nunca inicializa la dosis', () => {
  const state = validCommon('PRESCRIPTION');
  const medication = state.detailsByType.PRESCRIPTION.medications[0];
  assert.equal(medication?.dose, '');
  assert.equal(validateEditorState(state).some((error) => error.label === 'Medicamentos prescritos'), true);
  if (medication) medication.name = 'Paracetamol';
  assert.equal(validateEditorState(state).some((error) => error.label.startsWith('Dosis')), true);

  state.detailsByType.PRESCRIPTION.medications = [{
    name: 'Paracetamol',
    dose: '500 mg',
    route: 'Oral',
    frequency: 'Cada 8 horas',
    duration: '3 días',
  }];
  assert.deepEqual(validateEditorState(state), []);
});

test('restaura datetime ISO a controles locales y reserva adjuntos tipados', () => {
  const state = restoreEditorState({
    recordType: 'LAB_RESULT',
    attendedAt: '2020-01-15T15:30:00.000Z',
    schemaVersion: 1,
    details: {
      studyName: 'Perfil lipídico',
      collectedAt: '2020-01-15T13:00:00.000Z',
      results: [{ analyte: 'HDL', value: '50', unit: 'mg/dL' }],
    },
  });

  assert.equal(state.attendedAt, '2020-01-15T10:30');
  assert.equal(state.detailsByType.LAB_RESULT.collectedAt, '2020-01-15T08:00');
  assert.deepEqual(state.attachments, []);
});

test('inicializa registros legacy sin details ni profesional sin bloquear la corrección', () => {
  const original = recordFixture({
    recordType: 'PROCEDURE',
    details: {} as RecordDetails,
    doctorName: null,
    professionalNameSnapshot: null,
    professionalLicenseSnapshot: 'CMP 9988',
  });
  const state = createCorrectionEditorState(original);

  assert.equal(state.recordType, 'PROCEDURE');
  assert.equal(state.doctorName, '');
  assert.equal(state.professionalLicense, 'CMP 9988');
  assert.deepEqual(state.detailsByType.PROCEDURE, {
    procedureName: '',
    technique: '',
    complications: '',
  });
  const errors = validateEditorState(state, { mode: 'correct' });
  assert.equal(errors.some((error) => error.label === 'Médico o profesional'), false);
  assert.equal(errors.some((error) => error.label === 'Técnica'), true);
});

test('corrección envía el contrato completo y preserva precisión subminuto', () => {
  const original = recordFixture({
    recordType: 'LAB_RESULT',
    details: {
      studyName: 'Hemograma',
      collectedAt: '2020-01-15T13:00:17.456Z',
      issuedAt: '2020-01-15T14:00:29.987Z',
      results: [{ analyte: 'Hemoglobina', value: '13.5', unit: 'g/dL' }],
    },
  });
  const state = createCorrectionEditorState(original);
  const initialFingerprint = recordEditorFingerprint(state);
  state.attendedAt = '2020-01-15T11:45';
  state.detailsByType.LAB_RESULT.collectedAt = '2020-01-15T08:10';
  state.notes = '';
  state.plan = '';

  assert.notEqual(recordEditorFingerprint(state), initialFingerprint);
  assert.deepEqual(validateEditorState(state), []);
  const payload = toCorrectRecordData(state, original);
  assert.ok(payload);
  assert.equal(payload.expectedVersion, 7);
  assert.equal(payload.recordType, 'LAB_RESULT');
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.attendedAt, '2020-01-15T16:45:42.123Z');
  assert.equal(payload.notes, null);
  assert.equal(payload.plan, null);
  assert.equal(
    (payload.details as { collectedAt?: string }).collectedAt,
    '2020-01-15T13:10:17.456Z',
  );
  assert.equal(
    (payload.details as { issuedAt?: string }).issuedAt,
    '2020-01-15T14:00:29.987Z',
  );
});

test('impide convertir una corrección en otro tipo clínico', () => {
  const original = recordFixture();
  const state = createCorrectionEditorState(original);
  state.recordType = 'OTHER';
  assert.equal(toCorrectRecordData(state, original), null);
});
