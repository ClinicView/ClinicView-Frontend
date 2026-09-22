// Synthetic renderer smoke test; no server, session, patient DB or network access.
// Uses TypeScript tooling already installed in the sibling backend.
const { resolve } = require('node:path');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const assert = require('node:assert/strict');
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
const { createPatientPdf } = require('../src/features/medical-documents/lib/pdf-export');
const { PDF_FONT_FILES } = require('../src/features/medical-documents/lib/pdf-fonts');
const { clinicalHistoryPdfOptions } = require('../src/features/patients/lib/history-pdf');
const { normalizePdfText, validateClinicalPdf } = require('../e2e/pdf-verification');

async function main() {
  const now = '2026-09-07T15:00:00Z';
  const longInstructions = Array.from({ length: 48 }, (_, index) => `ORIENTACIÓN_SINTÉTICA_${String(index + 1).padStart(2, '0')}: texto sintético sin uso asistencial.`);
  const laboratoryRows = Array.from({ length: 72 }, (_, index) => ({
    analyte: `ANALITO_SINTÉTICO_${String(index + 1).padStart(2, '0')}`,
    value: `VALOR_FILA_${String(index + 1).padStart(2, '0')}`,
    unit: 'u',
    referenceRange: 'Referencia demostrativa con texto conservado en una celda.',
    flag: 'NORMAL',
  }));
  const episode = {
    id: 'episode-synthetic',
    title: 'Seguimiento de demostración',
    startedOn: '2023-01-01',
    endedOn: null,
    status: 'OPEN',
    version: 0,
    events: [
      {
        id: 'event',
        action: 'CREATE',
        actorName: 'Revisor sintético · @demo',
        reason: 'Agrupación documentada para probar el PDF',
        createdAt: now,
        payload: { after: { status: 'OPEN', startedOn: '2023-01-01' } },
      },
    ],
  };
  const templates = {
    CONSULTATION: {
      chiefComplaint: 'Motivo sintético de prueba. '.repeat(30),
      presentIllness: longInstructions.join('\n'),
      careInstructions: 'Orientaciones documentadas de demostración.',
    },
    EVOLUTION: {
      evolution: 'Evolución sintética para prueba de formato.',
      disposition: 'Seguimiento registrado de demostración.',
    },
    LAB_RESULT: {
      studyName: 'Estudio sintético\nSEGUNDA LÍNEA DEL CAMPO BREVE',
      methodology: 'Método de demostración',
      sampleCondition: 'Condición documentada de prueba',
      criticalResultCommunication: 'Comunicación registrada para probar el campo.',
      results: laboratoryRows,
    },
    PRESCRIPTION: {
      indication: 'Texto de demostración, no es una prescripción real.',
      safetyReview: 'Verificación escrita de prueba',
      medications: [
        {
          name: 'Producto sintético, no administrable',
          concentration: 'De prueba',
          dose: 'No administrar',
          route: 'No aplica',
          frequency: 'No aplica',
          duration: 'No aplica',
        },
      ],
    },
    PROCEDURE: {
      procedureName: 'Procedimiento sintético',
      technique: 'Descripción de prueba',
      materials: 'Materiales documentados de demostración',
      specimenDestination: 'Destino sintético',
    },
    THERAPY_NOTE: {
      discipline: 'Disciplina de demostración',
      interventions: 'Intervención de prueba',
      tolerance: 'Tolerancia documentada de prueba',
      sessionDurationMinutes: 30,
    },
    OTHER: {
      title: 'Documento de demostración',
      content: 'Contenido sintético para probar el formato.',
      recipient: 'Destinatario sintético',
      purpose: 'Prueba de exportación',
    },
  };
  const records = Object.entries(templates).map(([recordType, details], index) => ({
    id: `record-synthetic-${index}`,
    recordType,
    details,
    schemaVersion: 1,
    episode,
    status: index === 6 ? 'VOIDED' : index === 1 ? 'CORRECTED' : 'ACTIVE',
    ...(index === 6 && { voidReason: 'ANULACIÓN_SINTÉTICA_VISIBLE_SIN_BORRAR_CONTENIDO' }),
    attendedAt: `2023-01-0${index + 1}T05:00:00Z`,
    attendancePrecision: 'DAY',
    createdAt: now,
    updatedAt: now,
    origin: 'MANUAL',
    priority: 'NORMAL',
    version: 0,
    summary: `RESUMEN_ÚNICO_${recordType}: DATOS TOTALMENTE SINTÉTICOS · NO USAR PARA ATENCIÓN.`,
    doctorName: 'Profesional original de demostración',
    createdByNameSnapshot: 'Transcriptor sintético · @transcriptor',
    service: 'Servicio de demostración',
    specialty: 'Especialidad sintética',
    attachments: [],
    ...(index === 0 && { source: { documentName: 'Original sintético vinculado.pdf', documentId: 'document-source-synthetic', documentVersion: 2, pageFrom: 1, pageTo: 2, sourceNote: 'VÍNCULO_ORIGINAL_CONSERVADO', publishedByName: 'Transcriptor sintético del original', publishedAt: now } }),
    confirmation:
      index === 0
        ? {
            actorName: 'Revisor de demostración',
            actorUsername: 'revisor_demo',
            capacity: 'REVIEWER',
            confirmedAt: now,
            recordVersion: 0,
            contentHash: 'a'.repeat(64),
            note: 'NOTA_CONFIRMADA_TÉCNICA_CONSERVADA',
          }
        : null,
  }));
  const history = {
    patient: {
      id: 'patient-synthetic',
      firstName: 'Paciente',
      lastName: 'SINTÉTICO',
      documentType: 'OTHER',
      documentNumber: 'DEMO-NO-REAL',
      dateOfBirth: '1990-01-01',
      sex: 'OTHER',
    },
    scope: {
      kind: 'FILTERED',
      description:
        'Selección sintética para comprobar índice, tablas e imágenes. No representa una historia real.',
    },
    episodes: [episode],
    records,
    documents: [],
    clinicalSummaryRevisions: [],
    generatedAt: now,
  };
  const options = clinicalHistoryPdfOptions(history, 'EPISODE');
  assert.ok(options.scopeSummary?.trim(), 'The clinical front page needs a brief visible scope.');
  assert.ok(options.orderDescription.includes(history.scope.description), 'Keep the full scope/ordering rationale for the appendix.');
  assert.equal(options.items.length, 8, 'Seven record types plus their episode must all remain exportable.');
  for (const record of records) {
    const item = options.items.find(candidate => candidate.sections.some(section => section.content === record.summary));
    assert.ok(item, `Missing record type: ${record.recordType}`);
    assert.ok(item.reviewSummary?.trim(), `${record.recordType}: review state remains visible outside the appendix.`);
    const technical = item.sections.find(section => section.title === 'TRAZABILIDAD');
    assert.equal(technical.placement, 'appendix');
    assert.ok(technical.content.includes(record.id), 'Moving provenance must not omit its identifier.');
    for (const section of item.sections.filter(section => /CONFIRMACIÓN CLÍNICA DE ESTA VERSIÓN/.test(section.title))) {
      assert.equal(section.placement, 'appendix', 'Full version confirmation/hash belongs in the technical appendix.');
    }
    const fieldBlocks = item.sections.flatMap(section => section.blocks ?? []).filter(block => block.kind === 'fields');
    assert.ok(fieldBlocks.length, `${record.recordType}: short and wide details retain the structured fields contract.`);
    for (const field of fieldBlocks.flatMap(block => block.fields)) {
      assert.equal(typeof field.label, 'string');
      assert.equal(typeof field.value, 'string');
      assert.equal(typeof field.wide, 'boolean');
    }
    if (record.recordType === 'CONSULTATION') {
      const longField = fieldBlocks.flatMap(block => block.fields).find(field => field.value === longInstructions.join('\n'));
      assert.equal(longField?.wide, true, 'A long narrative remains intact in a full-width field.');
    }
    if (record.recordType === 'LAB_RESULT') {
      assert.ok(fieldBlocks.flatMap(block => block.fields).some(field => field.value === templates.LAB_RESULT.studyName), 'Multiline scalar values must survive the transformation verbatim.');
    }
  }
  options.fontSources = Object.fromEntries(Object.entries(PDF_FONT_FILES).map(([key, path]) => [key, resolve(root, `public${path}`)]));
  const png = readFileSync(resolve(root, 'public/brand/clinicview-mark.png'));
  options.brandLogoSource = `data:image/png;base64,${readFileSync(resolve(root, 'public/brand/clinicview-logo-horizontal.png')).toString('base64')}`;
  options.items[1].attachments.push({
    id: 'synthetic-image',
    contentUrl: '/synthetic-only',
    originalName: 'imagen-de-prueba.png',
    sectionId: null,
    sectionTitle: 'Adjuntos',
    caption: 'Imagen de prueba de formato; no es una imagen clínica.',
    description: 'Isotipo institucional usado únicamente como imagen sintética de prueba.',
    mimeType: 'image/png',
    sizeBytes: png.length,
    width: 288,
    height: 288,
  });
  const blob = await createPatientPdf(options, {
    loadBlob: async () => new Blob([png], { type: 'image/png' }),
    encodeDataUrl: async () => `data:image/png;base64,${png.toString('base64')}`,
  });
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(bytes.length > 10000);
  const report = await validateClinicalPdf(bytes, {
    requiredTexts: [
      ...records.map(record => record.summary),
      ...longInstructions,
      ...laboratoryRows.flatMap(row => [row.analyte, row.value]),
      'SEGUNDA LÍNEA DEL CAMPO BREVE', 'Método de demostración', 'Condición documentada de prueba',
      'Evolución sintética para prueba de formato.', 'Producto sintético, no administrable',
      'Procedimiento sintético', 'Destino sintético', 'Disciplina de demostración',
      'Contenido sintético para probar el formato.', 'ANULACIÓN_SINTÉTICA_VISIBLE_SIN_BORRAR_CONTENIDO',
      'Profesional original de demostración', 'Servicio de demostración', 'Especialidad sintética',
      'Anulado', 'Corregido', 'Anexo de trazabilidad', ...records.map(record => record.id),
      'a'.repeat(64), 'NOTA_CONFIRMADA_TÉCNICA_CONSERVADA', 'Original sintético vinculado.pdf', 'document-source-synthetic', 'VÍNCULO_ORIGINAL_CONSERVADO', 'Transcriptor sintético', 'Agrupación documentada para probar el PDF',
      'Isotipo institucional usado únicamente como imagen sintética de prueba.',
      options.orderDescription,
    ],
    orderedMarkers: records.map(record => record.summary),
    expectedSectionStarts: [
      { heading: 'DATOS DEL ESTUDIO', bodyStart: 'Nombre del estudio' },
      { heading: 'RESULTADOS', bodyStart: laboratoryRows[0].analyte },
    ],
    requirePageNumbers: true,
    requireEntryBodyOnSamePage: true,
    minPageCount: 3,
    // An upper safety cap, not a contract with the previous layout's pagination.
    maxPageCount: 48,
    expectedImages: [{ width: 288, height: 288, belowHeader: true, caption: 'Imagen de prueba de formato; no es una imagen clínica.' }],
  });
  const output = resolve(root, '.next/pdf-smoke');
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, 'clinical-workflow-synthetic.pdf'), bytes);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify(report, null, 2));
  assert.deepEqual(report.issues, []);
  const lastClinicalMarker = report.text.indexOf(normalizePdfText(records.at(-1).summary));
  for (const technicalMarker of [...records.map(record => record.id), episode.id, 'document-source-synthetic', 'NOTA_CONFIRMADA_TÉCNICA_CONSERVADA', 'a'.repeat(64), options.orderDescription]) {
    assert.ok(report.text.indexOf(normalizePdfText(technicalMarker)) > lastClinicalMarker, `Technical appendix must follow all clinical entries: ${technicalMarker}`);
  }
  const tablePages = report.pages.filter(page => laboratoryRows.some(row => page.text.includes(normalizePdfText(row.analyte))));
  assert.ok(tablePages.length >= 2, 'The synthetic laboratory table must exercise page continuation.');
  const labItem = options.items.find(candidate => candidate.sections.some(section => section.content === records[2].summary));
  const table = labItem.sections.flatMap(section => section.blocks ?? []).find(block => block.kind === 'table');
  assert.ok(table, 'Laboratory results remain structured as a table.');
  for (const page of tablePages) {
    for (const column of table.columns) assert.ok(page.text.includes(normalizePdfText(column)), `Table column ${column} must repeat on page ${page.number}.`);
  }
  console.log(
    `PASS: seven record types, multiline/long fields, ${laboratoryRows.length} table rows across ${tablePages.length} pages, attachments, status and final appendix (${report.pageCount} pages).\nPDF sintético generado: ${bytes.length} bytes · ${options.items.length} secciones · ${resolve(output, 'clinical-workflow-synthetic.pdf')}`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
