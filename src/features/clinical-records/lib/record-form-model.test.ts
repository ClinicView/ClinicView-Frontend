import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { RecordType } from '../types/record';
import {
  createEmptyEditorState,
  restoreEditorState,
  toDraftPayload,
  validateEditorState,
} from '../../../app/(private)/patients/[id]/records/new/record-form-model';

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
