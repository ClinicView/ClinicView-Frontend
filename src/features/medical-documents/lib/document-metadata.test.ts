import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  cleanDocumentMetadata,
  documentSortDate,
  documentDateLabel,
  documentMetadataError,
  documentMetadataSections,
} from './document-metadata';

test('ordena por el día clínico sin desplazarlo y mantiene fallback explícito', () => {
  const createdAt = '2026-09-07T14:00:00Z';
  assert.equal(
    documentSortDate({
      createdAt,
      clinicalMetadata: { clinicalDate: '2023-09-27' },
    }),
    '2023-09-27T12:00:00-05:00',
  );
  assert.equal(documentSortDate({ createdAt }), createdAt);
  assert.equal(documentDateLabel({}), 'Fecha clínica no registrada');
  assert.match(documentDateLabel({ clinicalDate: '2023-09-27' }), /27/);
});
test('rechaza fechas falsas, rangos incompletos y cantidades fraccionarias', () => {
  assert.ok(documentMetadataError({ clinicalDate: '2023-02-30' }));
  assert.ok(documentMetadataError({ clinicalDate: '2999-01-01' }));
  assert.ok(documentMetadataError({ clinicalEndDate: '2023-01-01' }));
  assert.ok(
    documentMetadataError({
      clinicalDate: '2023-02-01',
      clinicalEndDate: '2023-01-01',
    }),
  );
  assert.ok(documentMetadataError({ pageCount: 1.5 }));
  assert.equal(
    documentMetadataError({ clinicalDate: '2023-01-01', pageCount: 2 }),
    null,
  );
});
test('normaliza vacíos y conserva procedencia y fechas en el PDF', () => {
  assert.deepEqual(
    cleanDocumentMetadata({
      sourceService: '',
      sourceInstitution: ' Institución demo ',
    }),
    { sourceInstitution: 'Institución demo' },
  );
  const content = documentMetadataSections({
    documentKind: 'CLINICAL_HISTORY',
    originalProfessional: 'Profesional demo',
    pageCount: 2,
    sourceNotes: 'Fuente demo',
  })[0].content;
  assert.match(content, /Profesional demo/);
  assert.match(content, /Páginas declaradas: 2/);
  assert.match(content, /Fecha clínica no registrada/);
  assert.match(content, /Fuente demo/);
});
