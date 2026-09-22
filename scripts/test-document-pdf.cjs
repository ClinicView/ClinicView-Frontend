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
const { clinicalHistoryDocumentToExportItem, documentToExportItem, createPatientPdf } = require('../src/features/medical-documents/lib/pdf-export');
const { PDF_FONT_FILES } = require('../src/features/medical-documents/lib/pdf-fonts');
const { normalizePdfText, validateClinicalPdf } = require('../e2e/pdf-verification');

function assertAppendixAfterBody(report, bodyMarkers, technicalMarkers) {
  const appendix = normalizePdfText('Anexo de trazabilidad');
  // The title can also occur in the contents links. Technical markers themselves
  // are unique body text and must follow the final clinical content, never precede it.
  const lastBody = Math.max(...bodyMarkers.map(marker => {
    const position = report.text.indexOf(normalizePdfText(marker));
    assert.ok(position >= 0, `Missing clinical marker: ${marker}`);
    return position;
  }));
  assert.ok(report.text.indexOf(appendix, lastBody) > lastBody, 'The actual appendix must follow clinical content.');
  for (const marker of technicalMarkers) {
    const position = report.text.indexOf(normalizePdfText(marker));
    assert.ok(position > lastBody, `Technical data must remain in the final appendix: ${marker}`);
  }
}

function assertLabelValueRow(report, label, value) {
  const normalizedLabel = normalizePdfText(label).replace(/:$/, '');
  for (const page of report.pages) {
    const labelFragment = page.fragments.find(fragment => normalizePdfText(fragment.text).replace(/:$/, '') === normalizedLabel);
    const valueFragment = page.fragments.find(fragment => normalizePdfText(fragment.text) === normalizePdfText(value));
    if (!labelFragment || !valueFragment) continue;
    assert.ok(valueFragment.x > labelFragment.x + labelFragment.width, `${label}: its value must occupy a distinct right-hand column.`);
    assert.ok(Math.abs(valueFragment.y - labelFragment.y) < Math.max(labelFragment.height, valueFragment.height), `${label}: label and value must share a row, not stack as separate cards.`);
    return;
  }
  assert.fail(`Missing same-page label/value row: ${label} / ${value}`);
}

async function main() {
  const timestamp = '2026-09-18T17:00:00Z';
  const identificationFields = [
    ['Nombre', 'PERSONA SINTÉTICA SIN IDENTIDAD REAL'],
    ['Edad', '34 años'],
    ['Código sintético', 'CÓDIGO_LITERAL_SIN_INFERENCIA'],
    ['Etiqueta extensa para comprobar continuidad y alineación de campo', 'VALOR_ETIQUETA_EXTENSA_LITERAL'],
    ['Observación literal', `${'Contenido sintético largo conservado sin resumir ni modificar. '.repeat(10)}FIN_CAMPO_LARGO_LITERAL`],
  ];
  const fieldSource = identificationFields.map(([label, value]) => `${label}: ${value}`).join('\n');
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
    'Datos de filiación:',
    fieldSource,
    '## REGISTRO DESCONOCIDO CONSERVADO',
    'Rótulo no clasificable: primera línea literal',
    'continuación narrativa sin inferir una nueva etiqueta.',
    'FIN DE NARRATIVA DESCONOCIDA.',
  ].join('\n');
  const document = {
    id: 'document-demo', originalName: 'Original de demostración.pdf', mimeType: 'application/pdf', sizeBytes: 4096,
    status: 'VALIDATED', clinicalText: text, textSource: 'CORRECTED',
    clinicalMetadata: { documentKind: 'CLINICAL_HISTORY', clinicalDate: '2024-04-15', originalProfessional: 'Profesional sintético de origen', sourceInstitution: 'Institución sintética de origen', sourceNotes: 'PROCEDENCIA_CLÍNICA_VISIBLE\nFuente sintética con alcance no inferido.' },
    metadataRevisions: [{ version: 1, createdAt: timestamp, recordedByName: 'AUTOR_REVISIÓN_TÉCNICA', reason: 'MOTIVO_REVISIÓN_TÉCNICA', metadata: { sourceNotes: 'PROCEDENCIA_PREVIA_CONSERVADA' } }],
    validationChecklist: { schemaVersion: 1, items: [{ title: 'CHECKLIST_TÉCNICO_CONSERVADO', statement: 'ATESTACIÓN_TÉCNICA_CONSERVADA' }] },
    createdAt: timestamp, correctedAt: timestamp, reviewedAt: timestamp,
    createdBy: 'legacy-creator', correctedById: 'demo-reviewer', reviewedBy: 'demo-reviewer', updatedBy: 'demo-reviewer',
    correctedByActor: { id: 'demo-reviewer', fullName: 'Revisión de demostración', username: 'revision.demo', isActive: false, displayName: 'Revisión de demostración', identitySource: 'CURRENT_DIRECTORY' },
  };
  const item = clinicalHistoryDocumentToExportItem(document);
  for (const transform of [clinicalHistoryDocumentToExportItem, documentToExportItem]) {
    for (const [documentKind, title] of [['CLINICAL_HISTORY', 'Historia clínica / expediente'], ['LAB_RESULT', 'Resultado de laboratorio'], [undefined, 'Documento clínico digitalizado']]) {
      const titled = transform({ ...document, clinicalMetadata: { ...document.clinicalMetadata, documentKind } });
      assert.equal(titled.title, title, 'Use the human-readable clinical type, never the storage filename as the leading title.');
      assert.notEqual(titled.title, document.originalName);
      assert.ok(titled.sourceSummary.includes(document.originalName), 'The original filename remains visible as source context.');
      const archive = titled.sections.find(section => section.title === 'ARCHIVO');
      assert.equal(archive.placement, 'appendix');
      assert.ok(archive.content.includes(document.originalName), 'The complete original filename must survive in the appendix.');
    }
  }
  for (const heading of ['1. ANTECEDENTES PERSONALES', '2. ANTECEDENTES FAMILIARES', '3. EXAMEN FÍSICO GENERAL', '4. EXAMEN FÍSICO REGIONAL', '5. DIAGNÓSTICOS PRESUNTIVOS', '6. PLAN DE TRABAJO']) {
    assert.ok(item.sections.some(section => section.title === heading), `Source title missing: ${heading}`);
  }
  assert.ok(item.sections.some(section => section.content === 'Gastritis de demostración'));
  assert.equal(item.dateLabel, 'Fecha clínica registrada');
  const traceSection = item.sections.find(section => section.title === 'TRAZABILIDAD');
  const trace = traceSection.content;
  assert.equal(traceSection.placement, 'appendix');
  for (const section of item.sections.filter(section => /ARCHIVO|CONFIRMACIONES DE REVISIÓN|HISTORIAL DE PROCEDENCIA/.test(section.title))) {
    assert.equal(section.placement, 'appendix', `${section.title} must retain its data in the technical appendix.`);
  }
  assert.ok(trace.includes('Revisión de demostración · @revision.demo · Cuenta inactiva · ID: demo-reviewer'));
  assert.ok(trace.includes('Autor histórico no registrado · ID: legacy-creator'));
  assert.ok(!trace.includes('Corrección profesional'));
  const fields = item.sections.find(section => section.title === 'Datos de filiación:');
  assert.ok(fields, 'Keep the literal OCR heading.');
  assert.equal(fields.layout, 'fields', 'Only explicit, unambiguous OCR label/value lines become fields.');
  assert.equal(fields.content, fieldSource, 'A layout hint must not rewrite the literal OCR value.');
  const unknown = item.sections.find(section => section.title === '## REGISTRO DESCONOCIDO CONSERVADO');
  assert.equal(unknown.content, 'Rótulo no clasificable: primera línea literal\ncontinuación narrativa sin inferir una nueva etiqueta.\nFIN DE NARRATIVA DESCONOCIDA.');
  assert.equal(unknown.layout, 'narrative');
  assert.ok(!unknown.blocks?.some(block => block.kind === 'fields'), 'Narrative continuations cannot be reinterpreted as short fields.');
  const sourceNotes = item.sections.find(section => section.title === 'OBSERVACIONES DE PROCEDENCIA');
  assert.equal(sourceNotes?.content, document.clinicalMetadata.sourceNotes);
  assert.equal(sourceNotes?.placement, 'body', 'Clinical uncertainty/provenance notes must not be hidden among technical identifiers.');
  const withheldItems = [];
  for (const status of ['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'REJECTED']) {
    const marker = `NO_EXPORTAR_${status}`;
    for (const transform of [clinicalHistoryDocumentToExportItem, documentToExportItem]) {
      const withheld = transform({ ...document, id: `withheld-${status}`, originalName: `Documento sintético ${status}`, status, clinicalText: marker, correctedText: marker, ocrText: marker, rejectReason: status === 'REJECTED' ? 'RECHAZO_SINTÉTICO_CONSERVADO' : undefined });
      assert.ok(!JSON.stringify(withheld).includes(marker), `${status}: unvalidated source must never become exportable clinical text.`);
      if (transform === clinicalHistoryDocumentToExportItem && ['PENDING', 'REJECTED'].includes(status)) withheldItems.push(withheld);
    }
  }
  const options = {
    patient: { firstName: 'Paciente', lastName: 'DE PRUEBA', documentType: 'OTHER', documentNumber: 'DEMO', medicalRecordNumber: 'NHC-SINTÉTICO-001', dateOfBirth: '1990-01-01', sex: 'OTHER' },
    items: [item, ...withheldItems], subtitle: 'Prueba de fidelidad documental', fileName: 'document-fidelity', generatedAt: timestamp,
    scopeSummary: 'ALCANCE_BREVE_DE_PRUEBA', orderDescription: 'CRITERIO_TÉCNICO_DE_ORDEN_CONSERVADO',
    fontSources: Object.fromEntries(Object.entries(PDF_FONT_FILES).map(([key, path]) => [key, resolve(root, `public${path}`)])),
    brandLogoSource: `data:image/png;base64,${readFileSync(resolve(root, 'public/brand/clinicview-logo-horizontal.png')).toString('base64')}`,
  };
  await assert.rejects(createPatientPdf({ ...options, fontSources: { ...options.fontSources, regular: resolve(root, '.missing-font.ttf') } }), /No se pudieron cargar las fuentes/);
  await assert.rejects(createPatientPdf({ ...options, subtitle: 'Unsupported 漢' }), /U\+6F22/);
  const bytes = Buffer.from(await (await createPatientPdf(options)).arrayBuffer());
  const report = await validateClinicalPdf(bytes, {
    requiredTexts: [...text.split('\n').filter(line => !line.startsWith('Diagnóstico:') && !identificationFields.some(([label]) => line.startsWith(`${label}:`))), ...identificationFields.flat(), 'Gastritis de demostración', 'Revisión de demostración', '@revision.demo', 'Cuenta inactiva', 'RECHAZO_SINTÉTICO_CONSERVADO', 'ALCANCE_BREVE_DE_PRUEBA', 'Anexo de trazabilidad', 'AUTOR_REVISIÓN_TÉCNICA', 'MOTIVO_REVISIÓN_TÉCNICA', 'PROCEDENCIA_PREVIA_CONSERVADA', 'CHECKLIST_TÉCNICO_CONSERVADO', 'ATESTACIÓN_TÉCNICA_CONSERVADA', 'Profesional sintético de origen', document.clinicalMetadata.sourceNotes, 'NHC-SINTÉTICO-001', item.title, document.originalName],
    requiredUnicodeTexts: ['SatO₂', '±', 'µg', '≥', '≤', 'α', 'β', '→', '✓', 'm²'],
    forbiddenTexts: ['Corrección profesional', 'sin hora registrada', ...['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'REJECTED'].map(status => `NO_EXPORTAR_${status}`)],
    orderedMarkers: ['PREÁMBULO INSTITUCIONAL CONSERVADO', 'Sin antecedentes consignados', 'Contenido de familia preservado', 'SatO2', 'Texto regional distinto', 'Hipótesis de demostración', 'Observaciones del plan'],
    requirePageNumbers: true, requireEntryBodyOnSamePage: true, maxPageCount: 12,
  });
  const output = resolve(root, '.next/pdf-regressions');
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, 'document-fidelity.pdf'), bytes);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify(report, null, 2));
  assert.deepEqual(report.issues, []);
  assertLabelValueRow(report, 'Nombre', identificationFields[0][1]);
  assertLabelValueRow(report, 'Edad', identificationFields[1][1]);
  assertLabelValueRow(report, 'Código sintético', identificationFields[2][1]);
  for (const page of report.pages) {
    const headerText = normalizePdfText(page.fragments.filter(fragment => fragment.y < 96).map(fragment => fragment.text).join(' '));
    assert.ok(headerText.includes('HC: NHC-SINTÉTICO-001'), `Page ${page.number}: the repeated patient legend must identify the clinical record number.`);
  }
  assertAppendixAfterBody(report, ['FIN DE NARRATIVA DESCONOCIDA.', 'RECHAZO_SINTÉTICO_CONSERVADO'], ['ID del documento: document-demo', 'CHECKLIST_TÉCNICO_CONSERVADO', 'MOTIVO_REVISIÓN_TÉCNICA', 'CRITERIO_TÉCNICO_DE_ORDEN_CONSERVADO']);
  const paginationReports = [];
  // Cover first-page and continuation-page boundaries, retaining the original
  // seven offsets. A short three-line body is indivisible under 2/2 widows and
  // orphans; a long framed title plus 14 body lines also exercises title wrapping.
  // The observed keep/move transitions below prevent a layout change from making
  // every offset a harmless mid-page case without this regression noticing it.
  const offsets = [...Array.from({ length: 11 }, (_, index) => index + 10), 34, 35, 36, 37, 38, 39, 40, ...Array.from({ length: 11 }, (_, index) => index + 54)];
  const scenarios = [
    {
      name: 'short',
      heading: 'SECCIÓN QUE CONSERVA SU PRIMER PÁRRAFO',
      lines: ['PRIMER TEXTO CLÍNICO CONSERVADO.', '', 'SEGUNDO TEXTO TRAS EL RENGLÓN EN BLANCO.'],
    },
    {
      name: 'long-frame',
      heading: 'ENCABEZADO LARGO ENMARCADO QUE DEBE CONSERVARSE ÍNTEGRO AL LÍMITE DE LA PÁGINA, SIN DIVIDIR SU TEXTO NI SEPARARSE DEL PRIMER PÁRRAFO NARRATIVO; INFORMACIÓN SINTÉTICA PARA COMPROBAR EL BORDE SUPERIOR Y EL MARCO COMPLETO DE LA SECCIÓN',
      lines: Array.from({ length: 14 }, (_, index) => `NARRATIVA_ENMARCADA_${String(index + 1).padStart(2, '0')}: línea sintética conservada íntegramente.`),
    },
  ];
  for (const scenario of scenarios) for (const precedingLines of offsets) {
    const { heading, lines } = scenario;
    const firstLine = lines[0];
    const lastContext = `Línea sintética previa ${precedingLines}.`;
    const fixtureItem = {
      title: 'Regresión sintética de paginación', date: '2024-04-15',
      dateLabel: 'Fecha clínica registrada', status: 'Validado', origin: 'Prueba sintética', attachments: [],
      sections: [
        { title: 'CONTEXTO PREVIO', content: Array.from({ length: precedingLines }, (_, index) => `Línea sintética previa ${index + 1}.`).join('\n') },
        { title: heading, content: lines.join('\n'), layout: 'narrative' },
        { title: 'CIERRE DE PRUEBA', content: 'FIN ÍNTEGRO DE LA PRUEBA.' },
      ],
    };
    const fixtureBytes = Buffer.from(await (await createPatientPdf({ ...options, items: [fixtureItem] })).arrayBuffer());
    const checked = await validateClinicalPdf(fixtureBytes, {
      requiredTexts: [...fixtureItem.sections[0].content.split('\n'), heading, ...lines.filter(Boolean), 'FIN ÍNTEGRO DE LA PRUEBA.'],
      expectedSectionStarts: [{ heading, bodyStart: firstLine }],
      requirePageNumbers: true, requireEntryBodyOnSamePage: true, maxPageCount: 5,
    });
    const file = scenario.name === 'short' ? `heading-${precedingLines}.pdf` : `heading-${scenario.name}-${precedingLines}.pdf`;
    writeFileSync(resolve(output, file), fixtureBytes);
    const headingPage = checked.pages.find(page => page.text.includes(normalizePdfText(heading)));
    const previousPage = checked.pages.find(page => page.text.includes(lastContext));
    const previousLastLine = previousPage?.fragments.find(fragment => fragment.text === lastContext);
    paginationReports.push({ scenario: scenario.name, precedingLines, file, pageCount: checked.pageCount, headingPage: headingPage?.number, previousPage: previousPage?.number, previousLastLineY: previousLastLine?.y, movedToNextPage: Boolean(headingPage && previousPage && headingPage.number > previousPage.number), issues: checked.issues });
  }
  writeFileSync(resolve(output, 'heading-pagination-verification.json'), JSON.stringify(paginationReports, null, 2));
  assert.deepEqual(paginationReports.filter(result => result.issues.length), [], 'Clinical headings must retain their first body text at every boundary offset.');
  for (const { name } of scenarios) {
    const samples = paginationReports.filter(result => result.scenario === name);
    assert.ok(samples.some(result => result.movedToNextPage), `${name}: sweep must exercise a heading moving to the next page.`);
    assert.ok(samples.some(result => !result.movedToNextPage), `${name}: sweep must also exercise a heading that fits on the preceding page.`);
    assert.ok(samples.some(result => result.movedToNextPage && result.previousLastLineY > 650), `${name}: at least one heading must hit the physical lower-page boundary.`);
  }
  console.log(`PASS: preserved headings, inline values, exact Unicode, provenance, withheld text and PDF geometry (${report.pageCount} pages).`);
  console.log(`PASS: ${paginationReports.length} section-boundary cases across ${offsets.length} offsets: three-line body with blank paragraph, plus a long framed title and 14-line narrative.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
