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
const { clinicalHistoryPdfOptions } = require('../src/features/patients/lib/history-pdf');

async function main() {
  const now = '2026-09-07T15:00:00Z';
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
      careInstructions: 'Orientaciones documentadas de demostración.',
    },
    EVOLUTION: {
      evolution: 'Evolución sintética para prueba de formato.',
      disposition: 'Seguimiento registrado de demostración.',
    },
    LAB_RESULT: {
      studyName: 'Estudio sintético',
      methodology: 'Método de demostración',
      sampleCondition: 'Condición documentada de prueba',
      criticalResultCommunication: 'Comunicación registrada para probar el campo.',
      results: Array.from({ length: 28 }, (_, i) => ({
        analyte: `Analito sintético ${i}`,
        value: 'Valor de prueba',
        unit: 'u',
        referenceRange: 'Referencia demostrativa',
        flag: 'NORMAL',
      })),
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
    status: index === 6 ? 'CORRECTED' : 'ACTIVE',
    attendedAt: `2023-01-0${index + 1}T05:00:00Z`,
    attendancePrecision: 'DAY',
    createdAt: now,
    updatedAt: now,
    origin: 'MANUAL',
    priority: 'NORMAL',
    version: 0,
    summary: 'DATOS TOTALMENTE SINTÉTICOS · NO USAR PARA ATENCIÓN.',
    doctorName: 'Profesional original de demostración',
    createdByNameSnapshot: 'Transcriptor sintético · @transcriptor',
    service: 'Servicio de demostración',
    specialty: 'Especialidad sintética',
    attachments: [],
    confirmation:
      index === 0
        ? {
            actorName: 'Revisor de demostración',
            actorUsername: 'revisor_demo',
            capacity: 'REVIEWER',
            confirmedAt: now,
            recordVersion: 0,
            contentHash: 'a'.repeat(64),
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
  const output = resolve(root, '.next/pdf-smoke');
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, 'clinical-workflow-synthetic.pdf'), bytes);
  console.log(
    `PDF sintético generado: ${bytes.length} bytes · ${options.items.length} secciones · ${resolve(output, 'clinical-workflow-synthetic.pdf')}`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
