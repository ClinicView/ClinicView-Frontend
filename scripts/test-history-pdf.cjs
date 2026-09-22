'use strict';

// Metadata-only regression: imports the real transformers without rendering a
// PDF or accessing the browser, backend, fonts, database or clinical fixtures.
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const root = resolve(__dirname, '..');
require(resolve(root, '../ClinicView-Backend/node_modules/ts-node')).register({
  project: resolve(root, 'tsconfig.json'),
  transpileOnly: true,
  compilerOptions: { module: 'Node16', moduleResolution: 'Node16', jsx: 'react-jsx' },
});
require(resolve(root, '../ClinicView-Backend/node_modules/tsconfig-paths')).register({
  baseUrl: root,
  paths: { '@/*': ['./src/*'] },
});
const { clinicalHistoryPdfOptions } = require('../src/features/patients/lib/history-pdf');

const outsidePeriodNotice =
  'Se incluyen originales citados fuera del período o sin fecha clínica para conservar la procedencia.';

function fixture() {
  const episode = {
    id: 'episode-demo', patientId: 'patient-demo', title: 'Seguimiento de demostración',
    description: 'Contexto clínico conservado.', startedOn: '2024-03-01', endedOn: '2024-03-07',
    status: 'CLOSED', version: 4,
    events: [
      { id: 'event-open', action: 'CREATE', actorName: 'Persona de demostración', reason: 'Apertura justificada.', recordId: null, payload: { after: { title: 'Título inicial', startedOn: '2024-03-01', version: 0 } }, createdAt: '2024-03-01T15:00:00Z' },
      { id: 'event-close', action: 'CLOSE', actorName: 'Otra persona de demostración', reason: 'Cierre justificado.', recordId: 'record-first', payload: { before: { status: 'OPEN' }, after: { status: 'CLOSED', endedOn: '2024-03-07', version: 4 } }, createdAt: '2024-03-07T15:00:00Z' },
    ],
  };
  const record = (id, attendedAt, status) => ({
    id, patientId: 'patient-demo', recordType: 'CONSULTATION', origin: 'MANUAL', status,
    attendedAt, attendancePrecision: 'INSTANT', summary: `Resumen de ${id}.`, details: {},
    schemaVersion: 1, priority: 'NORMAL', attachments: [], version: 1,
    createdAt: attendedAt, updatedAt: attendedAt, episode,
  });
  return {
    generatedAt: '2026-09-22T15:00:00Z',
    patient: { id: 'patient-demo', firstName: 'Paciente', lastName: 'DE PRUEBA', documentType: 'OTHER', documentNumber: 'DEMO', sex: 'OTHER', dateOfBirth: '1990-01-01' },
    clinicalSummaryRevisions: [], episodes: [episode],
    records: [record('record-last', '2024-03-06T15:00:00Z', 'ACTIVE'), record('record-first', '2024-03-04T15:00:00Z', 'CORRECTED')],
    documents: [{
      id: 'document-demo', originalName: 'Documento de demostración.pdf', mimeType: 'application/pdf',
      sizeBytes: 1000, status: 'VALIDATED', clinicalText: 'Texto clínico conservado.', textSource: 'CORRECTED',
      clinicalMetadata: { clinicalDate: '2024-03-05' }, metadataRevisions: [],
      createdAt: '2024-03-08T15:00:00Z',
    }],
    scope: { kind: 'COMPLETE', description: 'Descripción íntegra del alcance completo.', includesSourceDocumentsOutsidePeriod: false },
  };
}

test('complete scope is concise but explicitly includes previous/noncurrent versions', () => {
  const history = fixture();
  const options = clinicalHistoryPdfOptions(history);
  assert.match(options.scopeSummary, /^Expediente completo · 2 atenciones · 1 documento\./);
  assert.match(options.scopeSummary, /previas o no vigentes/);
  assert.match(options.scopeSummary, /cada versión se cuenta como una entrada/);
  assert.equal(options.scopeDetails, undefined);
  assert.ok(options.orderDescription.startsWith(history.scope.description));
  assert.match(options.orderDescription, /2 versiones de atenciones; 1 documentos/);
  assert.match(options.orderDescription, /Entradas por fecha clínica/);
  assert.match(options.orderDescription, /trazabilidad detallada en el anexo/);
  assert.equal(options.subtitle, 'Historia clínica completa');
});

test('legacy complete history and singular counts remain complete, not silently filtered', () => {
  const history = fixture();
  delete history.scope;
  history.records = [history.records[0]];
  const options = clinicalHistoryPdfOptions(history);
  assert.match(options.scopeSummary, /^Expediente completo · 1 atención · 1 documento\./);
  assert.match(options.scopeSummary, /previas o no vigentes/);
  assert.ok(options.orderDescription.startsWith('Historia completa.'));
  assert.ok(options.fileName.endsWith('_historia_completa'));
});

test('filtered scope retains full date, episode, versions and exception descriptions without parsing', () => {
  const history = fixture();
  const description = [
    'Exportación seleccionada; no representa toda la historia.',
    'Período clínico: 2024-03-01 a 2024-03-07.',
    'Episodio: Seguimiento del Dr. A. (episode-demo).',
    'Solo atenciones vigentes y documentos validados, más originales citados.',
    'Incluye contexto longitudinal y trazabilidad de los episodios seleccionados; esos antecedentes no se recortan por fecha.',
    outsidePeriodNotice,
  ].join(' ');
  history.scope = { kind: 'FILTERED', description, includesSourceDocumentsOutsidePeriod: true };
  const options = clinicalHistoryPdfOptions(history);
  assert.equal(options.scopeSummary, 'Selección filtrada · 2 atenciones · 1 documento.');
  assert.equal(options.scopeDetails, description);
  assert.equal(options.scopeDetails.split(outsidePeriodNotice).length - 1, 1);
  assert.ok(options.orderDescription.startsWith(description));
  assert.equal(options.subtitle, 'Historia clínica · selección');
  assert.ok(options.fileName.endsWith('_seleccion'));
});

test('scope exception flag remains visible even when the supplied description omits it', () => {
  const history = fixture();
  history.scope = { kind: 'FILTERED', description: 'Período clínico: sin inicio a 2024-03-07. Episodio: Seguimiento.', includesSourceDocumentsOutsidePeriod: true };
  const options = clinicalHistoryPdfOptions(history);
  assert.equal(options.scopeDetails, `${history.scope.description}\n${outsidePeriodNotice}`);
});

test('an absent filtered description is disclosed, never inferred from record dates or episode membership', () => {
  const history = fixture();
  history.scope = { kind: 'FILTERED', description: '  ', includesSourceDocumentsOutsidePeriod: false };
  const options = clinicalHistoryPdfOptions(history);
  assert.match(options.scopeSummary, /^Selección filtrada/);
  assert.match(options.scopeDetails, /No se informó el detalle de los filtros/);
  assert.match(options.scopeDetails, /no representa todo el expediente/);
  assert.ok(!options.scopeDetails.includes('2024-03-04'));
  assert.ok(!options.scopeDetails.includes(history.episodes[0].title));
});

test('episode identifiers and every historical event move to appendix while clinical context stays in body', () => {
  const history = fixture();
  const options = clinicalHistoryPdfOptions(history);
  const item = options.items[0];
  assert.equal(item.title, `Episodio · ${history.episodes[0].title}`);
  assert.equal(item.date, '2024-03-01');
  assert.equal(item.dateLabel, 'Inicio clínico');
  assert.equal(item.status, 'Cerrado');
  const body = item.sections.filter(section => section.placement === 'body');
  const appendix = item.sections.filter(section => section.placement === 'appendix');
  assert.equal(body.length, 1);
  assert.match(body[0].content, /Contexto clínico conservado/);
  assert.match(body[0].content, /Cierre clínico:/);
  assert.ok(!body[0].content.includes('episode-demo'));
  assert.equal(appendix.length, 1 + history.episodes[0].events.length);
  assert.equal(appendix[0].content, 'Identificador: episode-demo\nVersión: 4');
  assert.match(appendix[1].title, /^Apertura ·/);
  assert.match(appendix[1].content, /Persona de demostración/);
  assert.match(appendix[1].content, /Apertura justificada/);
  assert.match(appendix[1].content, /Título inicial/);
  assert.match(appendix[2].title, /^Cierre ·/);
  assert.match(appendix[2].content, /Otra persona de demostración/);
  assert.match(appendix[2].content, /Cierre justificado/);
  assert.match(appendix[2].content, /Atención: record-first/);
  assert.match(appendix[2].content, /Antes:/);
  assert.match(appendix[2].content, /Después:/);
});

test('open episode preserves unknown description and close date without inventing information', () => {
  const history = fixture();
  history.episodes[0] = { ...history.episodes[0], description: null, endedOn: null, status: 'OPEN', events: [] };
  const item = clinicalHistoryPdfOptions(history).items[0];
  assert.equal(item.status, 'Abierto');
  assert.equal(item.sections[0].content, 'Descripción: No registrada\nCierre clínico: No cerrado');
  assert.equal(item.sections[1].placement, 'appendix');
});

test('presentation does not mutate scope, remove versions, duplicate originals or change chronological order', () => {
  const history = fixture();
  const original = structuredClone(history);
  const date = clinicalHistoryPdfOptions(history, 'DATE');
  assert.deepEqual(date.items.map(item => item.date), [
    '2024-03-01', '2024-03-04T15:00:00Z', '2024-03-05T12:00:00-05:00', '2024-03-06T15:00:00Z',
  ]);
  const episode = clinicalHistoryPdfOptions(history, 'EPISODE');
  assert.deepEqual(episode.items.map(item => item.date), [
    '2024-03-01', '2024-03-04T15:00:00Z', '2024-03-06T15:00:00Z', '2024-03-05T12:00:00-05:00',
  ]);
  assert.equal(episode.items.filter(item => item.sourceSummary?.includes('Documento de demostración.pdf')).length, 1);
  assert.match(episode.orderDescription, /cada original una sola vez/);
  assert.deepEqual(history, original);
});

test('empty selection remains rejected instead of silently exporting a different scope', () => {
  const history = fixture();
  history.records = [];
  history.documents = [];
  history.episodes = [];
  history.scope.kind = 'FILTERED';
  assert.throws(() => clinicalHistoryPdfOptions(history), /No hay contenido para el alcance elegido/);
});
