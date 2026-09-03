import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { ClinicalRecordAttachment } from '../types/record';
import {
  fitRecordAttachmentDimensions,
  getRecordAttachmentAltText,
  getRecordAttachmentGroups,
  getRecordExportAttachments,
  RequiredAttachmentResolutionError,
  resolveRequiredAttachmentData,
} from './record-attachments-presentation';

function makeAttachment(
  id: string,
  sectionKey: string | null,
  overrides: Partial<ClinicalRecordAttachment> = {},
): ClinicalRecordAttachment {
  return {
    id,
    assetId: `asset-${id}`,
    sectionKey,
    caption: null,
    altText: null,
    sortOrder: 0,
    createdBy: 'user-1',
    createdAt: '2026-09-03T10:00:00.000Z',
    asset: {
      id: `asset-${id}`,
      patientId: 'patient-1',
      originalName: `${id}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
      width: 1200,
      height: 900,
      sha256: id.padEnd(64, '0').slice(0, 64),
      status: 'ATTACHED',
      expiresAt: null,
      version: 1,
      createdAt: '2026-09-03T10:00:00.000Z',
      updatedAt: '2026-09-03T10:00:00.000Z',
      contentUrl: `/patients/patient-1/record-media/asset-${id}/content`,
    },
    ...overrides,
  };
}

test('agrupa por la sección definida y conserva adjuntos generales o desconocidos', () => {
  const groups = getRecordAttachmentGroups('CONSULTATION', [
    makeAttachment('unknown', 'legacy-section', { sortOrder: 2 }),
    makeAttachment('diagnosis', 'consultation-diagnoses', { sortOrder: 1 }),
    makeAttachment('vitals', 'vitalSigns.systolicBloodPressure', { sortOrder: 0 }),
    makeAttachment('general', null, { sortOrder: 0 }),
  ]);

  assert.deepEqual(
    groups.map((group) => ({
      sectionId: group.sectionId,
      title: group.title,
      ids: group.attachments.map((attachment) => attachment.id),
    })),
    [
      {
        sectionId: 'consultation-vitals',
        title: 'Signos vitales',
        ids: ['vitals'],
      },
      {
        sectionId: 'consultation-diagnoses',
        title: 'Diagnósticos',
        ids: ['diagnosis'],
      },
      {
        sectionId: null,
        title: 'Imágenes adjuntas',
        ids: ['general', 'unknown'],
      },
    ],
  );
});

test('ordena de forma estable por orden, creación e id sin mutar el arreglo', () => {
  const source = [
    makeAttachment('c', null, { sortOrder: 1 }),
    makeAttachment('b', null, { createdAt: '2026-09-03T10:01:00.000Z' }),
    makeAttachment('a', null),
  ];

  const groups = getRecordAttachmentGroups('OTHER', source);
  assert.deepEqual(groups[0].attachments.map((attachment) => attachment.id), [
    'a',
    'b',
    'c',
  ]);
  assert.deepEqual(source.map((attachment) => attachment.id), ['c', 'b', 'a']);
});

test('prioriza el alt clínico escrito y usa un fallback neutral por archivo', () => {
  assert.equal(
    getRecordAttachmentAltText(
      makeAttachment('authored', null, { altText: '  Eritema en antebrazo derecho  ' }),
    ),
    'Eritema en antebrazo derecho',
  );
  assert.equal(
    getRecordAttachmentAltText(makeAttachment('fallback', null)),
    'Imagen clínica adjunta: fallback.jpg',
  );
});

test('mapea metadatos seguros para exportación y conserva la proporción al ajustar', () => {
  const attachment = makeAttachment('export', 'consultation-diagnoses', {
    caption: '  Lesión índice  ',
    altText: 'Descripción clínica',
  });
  const exported = getRecordExportAttachments('CONSULTATION', [attachment]);

  assert.deepEqual(exported, [
    {
      id: 'export',
      sectionId: 'consultation-diagnoses',
      sectionTitle: 'Diagnósticos',
      caption: 'Lesión índice',
      description: 'Descripción clínica',
      originalName: 'export.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
      width: 1200,
      height: 900,
      contentUrl: '/patients/patient-1/record-media/asset-export/content',
    },
  ]);
  assert.deepEqual(fitRecordAttachmentDimensions(1200, 900, 400, 280), {
    width: 1120 / 3,
    height: 280,
  });
});

test('resuelve blobs en orden sin persistirlos y aborta con un error clínico claro', async () => {
  const descriptors = [
    { id: 'a', originalName: 'a.jpg', contentUrl: '/asset-a' },
    { id: 'b', originalName: 'b.png', contentUrl: '/asset-b' },
  ];
  const calls: string[] = [];
  const resolved = await resolveRequiredAttachmentData(
    descriptors,
    async (url) => {
      calls.push(url);
      return new Blob([url], { type: 'image/jpeg' });
    },
    async (blob) => `data:${blob.type};base64,TEST`,
  );

  assert.deepEqual(calls, ['/asset-a', '/asset-b']);
  assert.deepEqual(resolved.map(({ id, dataUrl }) => ({ id, dataUrl })), [
    { id: 'a', dataUrl: 'data:image/jpeg;base64,TEST' },
    { id: 'b', dataUrl: 'data:image/jpeg;base64,TEST' },
  ]);

  await assert.rejects(
    () =>
      resolveRequiredAttachmentData(
        descriptors,
        async (url) => {
          if (url === '/asset-b') throw new Error('401 with sensitive URL');
          return new Blob(['ok'], { type: 'image/jpeg' });
        },
        async (blob) => `data:${blob.type};base64,OK`,
      ),
    (error: unknown) => {
      assert.ok(error instanceof RequiredAttachmentResolutionError);
      assert.equal(error.attachmentId, 'b');
      assert.match(error.message, /PDF incompleto/);
      assert.doesNotMatch(error.message, /sensitive URL/);
      return true;
    },
  );
});
