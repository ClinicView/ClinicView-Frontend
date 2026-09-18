'use strict';
// Renderer regression using synthetic data and local font files, without services.
const { resolve } = require('node:path');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const root = resolve(__dirname, '..');
require(resolve(root, '../ClinicView-Backend/node_modules/ts-node')).register({
  project: resolve(root, 'tsconfig.json'), transpileOnly: true,
  compilerOptions: { module: 'Node16', moduleResolution: 'Node16', jsx: 'react-jsx' },
});
require(resolve(root, '../ClinicView-Backend/node_modules/tsconfig-paths')).register({ baseUrl: root, paths: { '@/*': ['./src/*'] } });
const { clinicalHistoryDocumentToExportItem, createPatientPdf } = require('../src/features/medical-documents/lib/pdf-export');
const { PDF_FONT_FILES } = require('../src/features/medical-documents/lib/pdf-fonts');
const { validateClinicalPdf } = require('../e2e/pdf-verification');

async function main() {
  const timestamp = '2026-09-18T17:00:00Z';
  const text = [
    'PREÁMBULO INSTITUCIONAL CONSERVADO',
    '1. ANTECEDENTES PERSONALES',
    'Sin antecedentes consignados en esta prueba.',
    '2. ANTECEDENTES FAMILIARES',
    'Contenido de familia preservado.',
    '3. EXAMEN FÍSICO GENERAL',
    'SatO₂ 98 %; ± µg ≥ ≤ α β → ✓ m².',
    '4. EXAMEN FÍSICO REGIONAL',
    'Texto regional distinto al general.',
    '5. DIAGNÓSTICOS PRESUNTIVOS',
    'Hipótesis de demostración, no un diagnóstico confirmado.',
    '6. PLAN DE TRABAJO',
    'Observaciones del plan de demostración.',
    'Diagnóstico: Gastritis de demostración',
  ].join('\n');
  const document = {
    id: 'document-demo', originalName: 'Original de demostración.pdf', mimeType: 'application/pdf', sizeBytes: 4096,
    status: 'VALIDATED', clinicalText: text, textSource: 'CORRECTED',
    clinicalMetadata: { clinicalDate: '2024-04-15' }, metadataRevisions: [],
    createdAt: timestamp, correctedAt: timestamp, reviewedAt: timestamp,
    createdBy: 'legacy-creator', correctedById: 'demo-reviewer', reviewedBy: 'demo-reviewer', updatedBy: 'demo-reviewer',
    correctedByActor: { id: 'demo-reviewer', fullName: 'Revisión de demostración', username: 'revision.demo', isActive: false, displayName: 'Revisión de demostración', identitySource: 'CURRENT_DIRECTORY' },
  };
  const item = clinicalHistoryDocumentToExportItem(document);
  for (const heading of ['1. ANTECEDENTES PERSONALES', '2. ANTECEDENTES FAMILIARES', '3. EXAMEN FÍSICO GENERAL', '4. EXAMEN FÍSICO REGIONAL', '5. DIAGNÓSTICOS PRESUNTIVOS', '6. PLAN DE TRABAJO']) {
    assert.ok(item.sections.some(section => section.title === heading), `Source title missing: ${heading}`);
  }
  assert.ok(item.sections.some(section => section.content === 'Gastritis de demostración'));
  assert.equal(item.dateLabel, 'Fecha clínica registrada');
  const trace = item.sections.find(section => section.title === 'TRAZABILIDAD').content;
  assert.ok(trace.includes('Revisión de demostración · @revision.demo · Cuenta inactiva · ID: demo-reviewer'));
  assert.ok(trace.includes('Autor histórico no registrado · ID: legacy-creator'));
  assert.ok(!trace.includes('Corrección profesional'));
  const withheld = clinicalHistoryDocumentToExportItem({ ...document, status: 'PROCESSED', clinicalText: 'NO_EXPORTAR_OCR' });
  assert.ok(!JSON.stringify(withheld).includes('NO_EXPORTAR_OCR'));
  const options = {
    patient: { firstName: 'Paciente', lastName: 'DE PRUEBA', documentType: 'OTHER', documentNumber: 'DEMO', dateOfBirth: '1990-01-01', sex: 'OTHER' },
    items: [item], subtitle: 'Prueba de fidelidad documental', fileName: 'document-fidelity', generatedAt: timestamp,
    fontSources: Object.fromEntries(Object.entries(PDF_FONT_FILES).map(([key, path]) => [key, resolve(root, `public${path}`)])),
    brandLogoSource: `data:image/png;base64,${readFileSync(resolve(root, 'public/brand/clinicview-logo-horizontal.png')).toString('base64')}`,
  };
  await assert.rejects(createPatientPdf({ ...options, fontSources: { ...options.fontSources, regular: resolve(root, '.missing-font.ttf') } }), /No se pudieron cargar las fuentes/);
  await assert.rejects(createPatientPdf({ ...options, subtitle: 'Unsupported 漢' }), /U\+6F22/);
  const bytes = Buffer.from(await (await createPatientPdf(options)).arrayBuffer());
  const report = await validateClinicalPdf(bytes, {
    requiredTexts: [...text.split('\n').filter(line => !line.startsWith('Diagnóstico:')), 'Gastritis de demostración', 'Revisión de demostración', '@revision.demo', 'Cuenta inactiva'],
    requiredUnicodeTexts: ['SatO₂', '±', 'µg', '≥', '≤', 'α', 'β', '→', '✓', 'm²'],
    forbiddenTexts: ['Corrección profesional', 'sin hora registrada', 'NO_EXPORTAR_OCR'],
    orderedMarkers: ['PREÁMBULO INSTITUCIONAL CONSERVADO', 'Sin antecedentes consignados', 'Contenido de familia preservado', 'SatO2', 'Texto regional distinto', 'Hipótesis de demostración', 'Observaciones del plan'],
    requirePageNumbers: true, requireEntryBodyOnSamePage: true, maxPageCount: 8,
  });
  const output = resolve(root, '.next/pdf-regressions');
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, 'document-fidelity.pdf'), bytes);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify(report, null, 2));
  assert.deepEqual(report.issues, []);
  console.log(`PASS: preserved headings, inline values, exact Unicode, provenance, withheld text and PDF geometry (${report.pageCount} pages).`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
