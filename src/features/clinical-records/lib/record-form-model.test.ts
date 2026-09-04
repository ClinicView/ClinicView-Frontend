import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type {
  ClinicalMediaAsset,
  ClinicalRecord,
  RecordDetails,
  RecordType,
} from '../types/record';
import {
  MAX_RECORD_ATTACHMENTS,
  MAX_RECORD_MEDIA_FILE_BYTES,
  MAX_RECORD_MEDIA_TOTAL_BYTES,
  createCorrectionEditorState,
  createEmptyEditorState,
  moveAttachmentReference,
  normalizeAttachmentReferences,
  recordEditorFingerprint,
  restoreEditorState,
  serializeAttachmentReferences,
  toCreateRecordData,
  toCorrectRecordData,
  toDraftPayload,
  validateRecordMediaCandidate,
  validateEditorState,
} from '../../../app/(private)/patients/[id]/records/new/record-form-model';

function assetFixture(id: string, status: ClinicalMediaAsset['status']): ClinicalMediaAsset {
  return {
    id,
    patientId: 'patient-1',
    originalName: `${id}.png`,
    mimeType: 'image/png',
    sizeBytes: 1024,
    width: 640,
    height: 480,
    sha256: 'a'.repeat(64),
    status,
    expiresAt: status === 'TEMPORARY' ? '2020-01-22T15:30:00.000Z' : null,
    version: 1,
    createdAt: '2020-01-15T15:30:00.000Z',
    updatedAt: '2020-01-15T15:30:00.000Z',
    contentUrl: `/patients/patient-1/record-media/${id}/content`,
  };
}

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
    attachments: patch.attachments ?? [],
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

test('restaura, ordena y serializa referencias de adjuntos del borrador', () => {
  const state = restoreEditorState({
    attachments: [
      { assetId: 'asset-b', caption: '  Vista lateral  ', sortOrder: 2 },
      { assetId: 'asset-a', sectionKey: '  exam  ', altText: '  Lesión visible  ', sortOrder: 0 },
      { assetId: 'asset-a', caption: 'duplicado', sortOrder: 1 },
    ],
  });

  assert.deepEqual(state.attachments, [
    {
      assetId: 'asset-a',
      sectionKey: 'exam',
      caption: '',
      altText: 'Lesión visible',
      sortOrder: 0,
    },
    {
      assetId: 'asset-b',
      sectionKey: '',
      caption: 'Vista lateral',
      altText: '',
      sortOrder: 1,
    },
  ]);
  assert.deepEqual(toDraftPayload(state).attachments, [
    { assetId: 'asset-a', sectionKey: 'exam', altText: 'Lesión visible', sortOrder: 0 },
    { assetId: 'asset-b', caption: 'Vista lateral', sortOrder: 1 },
  ]);

  const oversizedDraft = restoreEditorState({
    attachments: Array.from({ length: MAX_RECORD_ATTACHMENTS + 2 }, (_, index) => ({
      assetId: `asset-${index}`,
      sortOrder: index,
    })),
  });
  assert.equal(oversizedDraft.attachments.length, MAX_RECORD_ATTACHMENTS);
});

test('reordena adjuntos con índices consecutivos y limita la selección de archivos', () => {
  const references = normalizeAttachmentReferences([
    { assetId: 'asset-a', sortOrder: 0 },
    { assetId: 'asset-b', sortOrder: 1 },
    { assetId: 'asset-c', sortOrder: 2 },
  ]);
  assert.deepEqual(
    serializeAttachmentReferences(moveAttachmentReference(references, 2, 0)),
    [
      { assetId: 'asset-c', sortOrder: 0 },
      { assetId: 'asset-a', sortOrder: 1 },
      { assetId: 'asset-b', sortOrder: 2 },
    ],
  );

  const valid = { name: 'radiografía.png', type: 'image/png', size: 1024 };
  assert.equal(validateRecordMediaCandidate(valid, { count: 0, totalBytes: 0 }), null);
  assert.match(validateRecordMediaCandidate(
    { ...valid, type: 'image/gif' },
    { count: 0, totalBytes: 0 },
  ) ?? '', /JPEG o PNG/);
  assert.match(validateRecordMediaCandidate(
    { ...valid, size: MAX_RECORD_MEDIA_FILE_BYTES + 1 },
    { count: 0, totalBytes: 0 },
  ) ?? '', /10 MiB/);
  assert.match(validateRecordMediaCandidate(
    valid,
    { count: MAX_RECORD_ATTACHMENTS, totalBytes: 0 },
  ) ?? '', /10 imágenes/);
  assert.match(validateRecordMediaCandidate(
    valid,
    { count: 1, totalBytes: MAX_RECORD_MEDIA_TOTAL_BYTES },
  ) ?? '', /30 MiB/);
});

test('el alta envía referencias limpias y en el orden visible', () => {
  const state = validCommon('CONSULTATION');
  state.detailsByType.CONSULTATION.chiefComplaint = 'Control clínico';
  state.attachments = normalizeAttachmentReferences([
    { assetId: 'asset-b', caption: '  Segunda vista  ', sortOrder: 1 },
    { assetId: 'asset-a', altText: '  Vista frontal  ', sortOrder: 0 },
  ]);

  assert.deepEqual(toCreateRecordData(state)?.attachments, [
    { assetId: 'asset-a', altText: 'Vista frontal', sortOrder: 0 },
    { assetId: 'asset-b', caption: 'Segunda vista', sortOrder: 1 },
  ]);
});

test('el alta consume el borrador con su id y versión exactos', () => {
  const state = validCommon('CONSULTATION');
  state.detailsByType.CONSULTATION.chiefComplaint = 'Control clínico';

  const payload = toCreateRecordData(state, {
    id: 'draft-1',
    version: 7,
  });
  assert.equal(payload?.draftId, 'draft-1');
  assert.equal(payload?.expectedDraftVersion, 7);
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

test('la corrección hereda adjuntos y envía explícitamente el nuevo orden o su remoción', () => {
  const attachedAsset = assetFixture('asset-original', 'ATTACHED');
  const original = recordFixture({
    attachments: [{
      id: 'attachment-1',
      assetId: attachedAsset.id,
      sectionKey: 'consultation-main',
      caption: 'Vista original',
      altText: null,
      sortOrder: 0,
      createdBy: 'user-1',
      createdAt: '2020-01-15T15:35:00.000Z',
      asset: attachedAsset,
    }],
  });
  const state = createCorrectionEditorState(original);

  assert.deepEqual(serializeAttachmentReferences(state.attachments), [{
    assetId: 'asset-original',
    sectionKey: 'consultation-main',
    caption: 'Vista original',
    sortOrder: 0,
  }]);
  state.attachments = [];
  assert.deepEqual(toCorrectRecordData(state, original)?.attachments, []);
});
