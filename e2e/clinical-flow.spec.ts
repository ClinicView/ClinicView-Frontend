import { expect, test, type Response } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { validateClinicalPdf } from './pdf-verification';

interface TestManifest {
  schemaVersion: number;
  ready: boolean;
  synthetic: boolean;
  backendUrl: string;
  frontendUrl: string;
  admin: { id: string; email: string; password: string; username: string; fullName: string };
  doctor: { id: string; fullName: string };
  patient: { id: string; firstName: string; lastName: string; documentNumber: string };
}

interface TestDocument {
  id: string;
  status: string;
  version: number;
  ocrText: string | null;
  correctedText: string | null;
  assignedReviewerId: string | null;
  validationAttested: boolean;
  clinicalMetadata?: { documentKind?: string; pageCount?: number; clinicalDate?: string };
  processing: { jobId: string; attempt: number; status: string } | null;
}

interface TestRecord {
  id: string;
  origin: string;
  attendedAt: string;
  attendancePrecision: string;
  summary: string;
  source?: { documentId: string; pageFrom: number; pageTo: number } | null;
  attachments: Array<{ assetId: string; caption: string | null; asset: { id: string; contentUrl: string } }>;
  confirmation: { actorId?: string; actorName: string; actorUsername: string; contentHash: string } | null;
}

interface TestLayout {
  available: boolean;
  runId: string;
  pages: Array<{ page: number; imageAvailable: boolean; lines: Array<{ lineId: string; text: string }> }>;
  review: { revision: number; lines: Array<{ reviewed: boolean }> } | null;
}

const runDirectory = process.env.BROWSER_E2E_RUN_DIR;
if (!runDirectory) throw new Error('BROWSER_E2E_RUN_DIR is required. Use the isolated browser E2E runner.');
const runDir: string = path.resolve(runDirectory);
const correctedSource = [
  'QA_ORIGINAL_VALIDADO',
  'Registro de demostracion para prueba automatizada',
  'Contenido sintetico sin valor asistencial',
  'Segunda pagina del documento de prueba',
  'Revision humana requerida antes de publicacion',
  'Fin del original de demostracion',
].join('\n');
const noteParagraphs = Array.from({ length: 28 }, (_, index) =>
  `Parrafo ${String(index + 1).padStart(2, '0')}: contenido sintetico de seguimiento, conservado integramente para comprobar los saltos de pagina.`,
);

function matches(response: Response, method: string, suffix: string): boolean {
  return response.request().method() === method && new URL(response.url()).pathname.endsWith(suffix);
}

async function responseJson<T>(response: Response): Promise<T> {
  expect(response.ok(), `${response.request().method()} ${new URL(response.url()).pathname}: ${response.status()}`).toBe(true);
  return response.json() as Promise<T>;
}

test('complete synthetic clinical flow preserves reviewed content, dates, images and full PDF export', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const manifest = JSON.parse(await readFile(path.join(runDir, 'backend-manifest.json'), 'utf8')) as TestManifest;
  expect(manifest.schemaVersion).toBe(1);
  expect(manifest.ready).toBe(true);
  expect(manifest.synthetic).toBe(true);
  // Never use this suite against an existing clinical deployment or an arbitrary public host.
  expect(['localhost', '127.0.0.1']).toContain(new URL(manifest.backendUrl).hostname);
  expect(['localhost', '127.0.0.1']).toContain(new URL(manifest.frontendUrl).hostname);

  const patientId = manifest.patient.id;
  const documentsPath = `/patients/${patientId}/documents`;
  const recordsPath = `/patients/${patientId}/records`;
  const processRequests = new Map<string, number>();
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (request.method() === 'POST' && pathname.startsWith(`/api${documentsPath}/`) && pathname.endsWith('/process')) {
      const documentId = pathname.split('/').at(-2)!;
      processRequests.set(documentId, (processRequests.get(documentId) ?? 0) + 1);
    }
  });

  let accessToken = '';
  const get = async <T,>(suffix: string): Promise<T> => {
    const response = await page.request.get(`${manifest.backendUrl}/api${suffix}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(response.ok(), `Read-only assertion GET ${suffix}: ${response.status()}`).toBe(true);
    return response.json() as Promise<T>;
  };

  await test.step('log in through the real user interface', async () => {
    await page.goto(`${manifest.frontendUrl}/login`);
    await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(manifest.admin.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(manifest.admin.password);
    const login = page.waitForResponse((response) => matches(response, 'POST', '/auth/login'));
    await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
    const body = await responseJson<{ access_token: string }>(await login);
    accessToken = body.access_token;
    expect(accessToken).toBeTruthy();
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  });

  async function uploadAndProcess(name: string): Promise<TestDocument> {
    await page.goto(`${manifest.frontendUrl}${documentsPath}`);
    await page.locator('input[type="file"]').setInputFiles({
      name,
      mimeType: 'application/pdf',
      buffer: await readFile(path.join(runDir, 'source.pdf')),
    });
    const dialog = page.getByRole('dialog', { name: 'Confirmar documento del paciente' });
    await expect(dialog).toContainText(manifest.patient.documentNumber);
    // Role/name follows the accessibility tree; getByLabel exact also reads
    // option text when a native select is nested inside its wrapping label.
    await dialog.getByRole('combobox', { name: 'Tipo de documento', exact: true }).selectOption('CONSULTATION');
    await dialog.getByLabel('Páginas declaradas').fill('2');
    await dialog.getByLabel('Fecha clínica / inicio del período').fill('2024-01-05');
    await dialog.getByLabel('Institución de origen').fill('Centro de prueba automatizada');
    await dialog.getByLabel('Profesional que figura en el original').fill(manifest.doctor.fullName);
    const uploaded = page.waitForResponse((response) => matches(response, 'POST', documentsPath));
    await dialog.getByRole('button', { name: 'Confirmar y subir documento' }).click();
    const document = await responseJson<TestDocument>(await uploaded);
    expect(document.status).toBe('PENDING');
    expect(document.clinicalMetadata).toMatchObject({ documentKind: 'CONSULTATION', pageCount: 2, clinicalDate: '2024-01-05' });
    await expect(dialog).not.toBeVisible();
    await page.getByRole('link', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
    await expect(page).toHaveURL(new RegExp(`/documents/${document.id}$`));
    const accepted = page.waitForResponse((response) => matches(response, 'POST', `${documentsPath}/${document.id}/process`));
    await page.getByRole('button', { name: 'Procesar digitalización', exact: true }).click();
    const processing = await responseJson<TestDocument>(await accepted);
    expect(processing.status).toBe('PROCESSING');
    expect(processing.processing?.attempt).toBe(1);
    await expect(page.getByRole('button', { name: 'Tomar revisión', exact: true })).toBeVisible({ timeout: 60_000 });
    const complete = await get<TestDocument>(`${documentsPath}/${document.id}`);
    expect(complete.status).toBe('PROCESSED');
    expect(complete.processing?.status).toBe('SUCCEEDED');
    expect(complete.processing?.jobId).toBe(processing.processing?.jobId);
    return complete;
  }

  let document!: TestDocument;
  await test.step('upload, process and claim the two-page original without duplicate OCR', async () => {
    document = await uploadAndProcess('source.pdf');
    await page.getByRole('button', { name: 'Tomar revisión', exact: true }).click();
    await expect(page.getByText('Asignado a ti', { exact: true })).toBeVisible();
    const claimed = await get<TestDocument>(`${documentsPath}/${document.id}`);
    expect(claimed.assignedReviewerId).toBe(manifest.admin.id);
    expect(processRequests.get(document.id)).toBe(1);
  });

  await test.step('review every fragment on both protected source pages and save the human revision', async () => {
    const layout = await get<TestLayout>(`${documentsPath}/${document.id}/ocr-layout`);
    expect(layout.available).toBe(true);
    expect(layout.pages).toHaveLength(2);
    expect(layout.pages.map((item) => item.page)).toEqual([1, 2]);
    expect(layout.pages.map((item) => item.lines.length)).toEqual([3, 3]);
    expect(layout.pages.flatMap((item) => item.lines)).toHaveLength(6);
    expect(layout.pages.every((item) => item.imageAvailable)).toBe(true);
    const spatial = page.getByRole('region', { name: 'Cada fragmento, en su contexto' });
    await expect(spatial).toHaveAttribute('aria-busy', 'false');
    await expect(spatial.getByRole('button', { name: 'Exportar para evaluación', exact: true })).toBeDisabled();
    await expect(page.getByText('Sin CER/WER medidos contra una referencia.', { exact: true })).toBeVisible();
    for (const sourcePage of layout.pages) {
      await spatial.getByRole('combobox', { name: 'Página', exact: true }).selectOption(String(sourcePage.page));
      const lines = spatial.getByRole('list', { name: `Fragmentos de la página ${sourcePage.page}` }).getByRole('button');
      await expect(lines).toHaveCount(sourcePage.lines.length);
      for (let index = 0; index < sourcePage.lines.length; index += 1) {
        await lines.nth(index).click();
        await expect(spatial.getByRole('textbox', { name: 'Transcripción del fragmento', exact: true })).toHaveValue(sourcePage.lines[index].text);
        await expect(spatial.getByRole('img', { name: new RegExp(`^Recorte del fragmento .+, página ${sourcePage.page}$`) })).toBeVisible();
        if (sourcePage.page === 1 && index === 0) {
          // The fixture image has the correct token; the deterministic OCR deliberately misreads it.
          expect(sourcePage.lines[index].text).toBe('QA_NO_VALIDADO');
          await spatial.getByRole('textbox', { name: 'Transcripción del fragmento', exact: true }).fill('QA_ORIGINAL_VALIDADO');
        }
        await spatial.getByRole('checkbox', { name: 'He contrastado este fragmento con la imagen', exact: true }).check();
      }
    }
    const saved = page.waitForResponse((response) => matches(response, 'PATCH', `${documentsPath}/${document.id}/ocr-layout/review`));
    await spatial.getByRole('button', { name: 'Guardar revisión y actualizar transcripción' }).click();
    const reviewed = await responseJson<TestLayout>(await saved);
    expect(reviewed.runId).toBe(layout.runId);
    expect(reviewed.review?.revision).toBe(1);
    expect(reviewed.review?.lines).toHaveLength(6);
    expect(reviewed.review?.lines.every((line) => line.reviewed)).toBe(true);
    await expect(page.getByText('Revisión guardada y editor clínico actualizado. La validación sigue siendo una acción separada.')).toBeVisible();
    await page.screenshot({ path: path.join(runDir, '01-spatial-review.png'), fullPage: true });
  });

  await test.step('download an exact private evaluation draft without changing clinical status or calculating accuracy', async () => {
    const before = await get<TestDocument>(`${documentsPath}/${document.id}`);
    const layout = await get<TestLayout>(`${documentsPath}/${document.id}/ocr-layout`);
    const spatial = page.getByRole('region', { name: 'Cada fragmento, en su contexto' });
    const exportButton = spatial.getByRole('button', { name: 'Exportar para evaluación', exact: true });
    await expect(exportButton).toBeEnabled();
    const downloadStarted = page.waitForEvent('download');
    await exportButton.click();
    const download = await downloadStarted;
    expect(download.suggestedFilename()).toBe(`ocr-evaluation-${layout.runId}-r1.json`);
    const snapshotPath = path.join(runDir, 'evaluation-snapshot.json');
    await download.saveAs(snapshotPath);
    const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
    expect(snapshot).toMatchObject({
      schemaVersion: 1, kind: 'clinicview-ocr-evaluation-snapshot', documentId: document.id,
      runId: layout.runId, revision: 1,
      sourceSha256: createHash('sha256').update(await readFile(path.join(runDir, 'source.pdf'))).digest('hex'),
      provenance: {
        referenceKind: 'ocr_postedited', referenceDraft: true, pageCoverage: 'unassessed',
        clinicalValidationIsReference: false, isCurrentRun: true, isLatestReview: true,
        staleAgainstCurrentCorrection: false, currentDocumentStatus: 'PROCESSED',
        currentDocumentVersion: before.version,
      },
    });
    expect(snapshot.prediction.pages).toHaveLength(2);
    expect(snapshot.review.pages).toHaveLength(2);
    expect(snapshot.prediction.pages[0].lines[0].text).toBe('QA_NO_VALIDADO');
    expect(snapshot.review.pages[0].lines[0].text).toBe('QA_ORIGINAL_VALIDADO');
    for (let index = 0; index < 2; index += 1) {
      expect(snapshot.review.pages[index].imageSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(snapshot.prediction.pages[index].imageSha256).toBe(snapshot.review.pages[index].imageSha256);
      expect(snapshot.review.pages[index].lines).toHaveLength(3);
      expect(snapshot.review.pages[index].lines.every((line: { reviewed: boolean; sourceLineIds: string[] }) => line.reviewed && line.sourceLineIds.length === 1)).toBe(true);
    }
    expect(snapshot).not.toHaveProperty('metrics');
    expect(snapshot).not.toHaveProperty('patientId');
    expect(snapshot).not.toHaveProperty('recordedBy');
    const after = await get<TestDocument>(`${documentsPath}/${document.id}`);
    expect(after).toMatchObject({ version: before.version, status: before.status, correctedText: before.correctedText, validationAttested: before.validationAttested });
    await expect(page.getByText('Sin CER/WER medidos contra una referencia.', { exact: true })).toBeVisible();
    await expect(page.getByText(/las métricas reales se calculan al validar/)).toHaveCount(0);
    await expect(page.getByText(/Guardar o validar en la web no recalcula CER\/WER/)).toBeVisible();
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await exportButton.scrollIntoViewIfNeeded();
      await page.keyboard.press('Tab');
      await exportButton.focus();
      await expect(exportButton).toBeFocused();
      expect(await exportButton.evaluate((button) => getComputedStyle(button).outlineStyle)).toBe('solid');
      expect(await page.evaluate(() => window.document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await exportButton.locator('..').screenshot({ path: path.join(runDir, `ocr-evaluation-export-${width}.png`) });
    }
  });

  await test.step('correct and atomically validate the exact professional text and checklist', async () => {
    await page.getByRole('tab', { name: 'Texto corregido', exact: true }).click();
    // Preserve the exact ordered spatial review instead of making it stale with a second rewrite.
    await expect(page.getByRole('textbox', { name: 'Texto corregido por profesional', exact: true })).toHaveValue(correctedSource);
    await page.getByRole('tab', { name: 'Validación', exact: true }).click();
    const validateButton = page.getByRole('button', { name: 'Guardar y validar versión final' });
    await expect(validateButton).toBeDisabled();
    for (const title of ['Texto corregido y revisado', 'Entidades clínicas verificadas', 'Secciones completas', 'Datos del paciente correctos']) {
      await page.getByRole('checkbox', { name: new RegExp(`^${title}`) }).check();
    }
    const validated = page.waitForResponse((response) => matches(response, 'PATCH', `${documentsPath}/${document.id}/validate`));
    await validateButton.click();
    const body = await responseJson<TestDocument>(await validated);
    expect(body.status).toBe('VALIDATED');
    expect(body.correctedText).toBe(correctedSource);
    expect(body.validationAttested).toBe(true);
    await expect(page.getByRole('link', { name: 'Registrar atención desde este documento' })).toBeVisible();
  });

  async function fillConsultation(summary: string, date: string, dayOnly: boolean): Promise<void> {
    await page.getByRole('combobox', { name: /^Tipo de registro(?:\s*\*)?$/ }).selectOption('CONSULTATION');
    await page.getByLabel(dayOnly ? /^Fecha de atención \(sin hora\)(?:\s*\*)?$/ : /^Fecha y hora de atención(?:\s*\*)?$/).fill(date);
    await page.getByRole('combobox', { name: /^Médico o profesional(?:\s*\*)?$/ }).fill(manifest.doctor.fullName);
    await page.getByRole('option', { name: new RegExp(manifest.doctor.fullName) }).click();
    await page.getByLabel('Servicio de atención', { exact: true }).fill('Medicina general E2E');
    await page.getByRole('textbox', { name: /^Resumen clínico(?:\s*\*)?$/ }).fill(summary);
    await page.getByRole('textbox', { name: /^Motivo de consulta(?:\s*\*)?$/ }).fill('Evaluacion sintetica documentada para verificar el flujo completo.');
    await page.getByLabel('Examen físico', { exact: true }).fill('Contenido de prueba sin interpretacion medica real.');
  }

  async function confirmRecord(record: TestRecord): Promise<TestRecord> {
    await expect(page).toHaveURL(new RegExp(`/records/${record.id}$`));
    const confirmation = page.getByRole('region', { name: 'Confirmación clínica' });
    await confirmation.getByLabel('Observación de revisión (opcional)').fill('Cierre de la version sintetica contrastada en la prueba automatizada.');
    await expect(confirmation.getByRole('button', { name: 'Confirmar versión revisada' })).toBeDisabled();
    await confirmation.getByRole('checkbox', { name: /^He revisado el profesional original, la fecha, el contenido y los adjuntos/ }).check();
    const confirmed = page.waitForResponse((response) => matches(response, 'POST', `${recordsPath}/${record.id}/confirm`));
    await confirmation.getByRole('button', { name: 'Confirmar versión revisada' }).click();
    await responseJson<unknown>(await confirmed);
    await expect(confirmation.getByText('Versión confirmada', { exact: true })).toBeVisible();
    const current = await get<TestRecord>(`${recordsPath}/${record.id}`);
    expect(current.confirmation?.actorUsername).toBe(manifest.admin.username);
    expect(current.confirmation?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    return current;
  }

  let linked!: TestRecord;
  await test.step('publish and explicitly confirm a dated consultation citing both original pages', async () => {
    await page.getByRole('link', { name: 'Registrar atención desde este documento' }).click();
    await fillConsultation('QA_ATENCION_ORIGINAL', '2024-01-10', true);
    await page.getByLabel('Página inicial', { exact: true }).fill('1');
    await page.getByLabel('Página final', { exact: true }).fill('2');
    await page.getByLabel('Referencia dentro del original').fill('Consulta sintetica de ejemplo, paginas uno y dos.');
    // Cotejo is invalidated by every content edit; check only after completing the form.
    await page.getByRole('checkbox', { name: /^He cotejado esta atención y sus páginas con el original/ }).check();
    const published = page.waitForResponse((response) => matches(response, 'POST', `${recordsPath}/from-document`));
    await page.getByRole('button', { name: 'Registrar atención', exact: true }).click();
    linked = await responseJson<TestRecord>(await published);
    expect(linked.origin).toBe('DIGITIZED');
    expect(linked.attendancePrecision).toBe('DAY');
    expect(linked.source).toMatchObject({ documentId: document.id, pageFrom: 1, pageTo: 2 });
    linked = await confirmRecord(linked);
  });

  let manual!: TestRecord;
  await test.step('create and confirm a later consultation with long content and a real image attachment', async () => {
    await page.goto(`${manifest.frontendUrl}${recordsPath}/new`);
    await fillConsultation('QA_CONSULTA_POSTERIOR', '2024-02-20T00:15', false);
    const notes = noteParagraphs.join('\n\n') + '\n\nQA_FIN_CONTENIDO';
    expect(notes.length).toBeLessThanOrEqual(4000);
    await page.getByLabel('Notas adicionales', { exact: true }).fill(notes);
    const uploaded = page.waitForResponse((response) => matches(response, 'POST', `/patients/${patientId}/record-media`));
    await page.getByLabel('Seleccionar imágenes', { exact: true }).setInputFiles(path.join(runDir, 'attachment.png'));
    await responseJson<unknown>(await uploaded);
    await page.getByRole('combobox', { name: 'Sección clínica', exact: true }).selectOption('consultation-clinical');
    await page.getByLabel('Título o contexto breve', { exact: true }).fill('QA_IMAGEN_DEMOSTRACION');
    await page.getByLabel('Descripción accesible', { exact: true }).fill('Ilustracion geometrica sintetica de prueba; no representa a un paciente.');
    await expect(page.getByRole('img', { name: 'Ilustracion geometrica sintetica de prueba; no representa a un paciente.' })).toBeVisible();
    const created = page.waitForResponse((response) => matches(response, 'POST', recordsPath));
    await page.getByRole('button', { name: 'Registrar atención', exact: true }).click();
    manual = await responseJson<TestRecord>(await created);
    expect(manual.origin).toBe('MANUAL');
    expect(manual.attendedAt).toBe('2024-02-20T05:15:00.000Z');
    expect(manual.attendancePrecision).toBe('INSTANT');
    expect(manual.attachments).toHaveLength(1);
    manual = await confirmRecord(manual);
    await page.screenshot({ path: path.join(runDir, '02-confirmed-consultation.png'), fullPage: true });
  });

  let unvalidated!: TestDocument;
  await test.step('keep a second processed source unvalidated as an export safety control', async () => {
    unvalidated = await uploadAndProcess('pendiente-control.pdf');
    expect(unvalidated.ocrText).toContain('QA_NO_VALIDADO');
    expect(unvalidated.correctedText).toBeNull();
    expect(unvalidated.status).toBe('PROCESSED');
    expect(processRequests.get(unvalidated.id)).toBe(1);
  });

  await test.step('fail closed without any download when a required clinical image is unavailable', async () => {
    await page.goto(`${manifest.frontendUrl}/patients/${patientId}`);
    await page.getByRole('tab', { name: 'Documentos', exact: true }).click();
    // Enter keyboard modality before focusing the real tab panel: its local CSS
    // module must retain a visible focus ring in the production build.
    await page.keyboard.press('Tab');
    const documentsPanel = page.getByRole('tabpanel', { name: 'Documentos', exact: true });
    await documentsPanel.focus();
    await expect(documentsPanel).toBeFocused();
    const outline = await documentsPanel.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(outline).toEqual({ style: 'solid', width: '3px' });
    const assetId = manual.attachments[0].asset.id;
    const assetUrl = `${manifest.backendUrl}/api/patients/${patientId}/record-media/${assetId}/content`;
    let blockedReads = 0;
    const unexpectedDownloads: string[] = [];
    const onDownload = (download: { suggestedFilename(): string }) => unexpectedDownloads.push(download.suggestedFilename());
    page.on('download', onDownload);
    await page.route(assetUrl, async (route) => {
      blockedReads += 1;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic image unavailable for fail-closed test.' }) });
    });
    try {
      await page.getByRole('button', { name: 'Exportar historia completa', exact: true }).click();
      await expect(page.getByText(/La exportación se canceló para evitar un PDF incompleto/)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole('button', { name: 'Exportar historia completa', exact: true })).toBeEnabled();
      expect(blockedReads).toBeGreaterThanOrEqual(1);
      expect(unexpectedDownloads).toEqual([]);
    } finally {
      await page.unroute(assetUrl);
      page.off('download', onDownload);
    }
  });

  await test.step('download and independently inspect the complete PDF, not merely a successful HTTP response', async () => {
    const downloaded = page.waitForEvent('download');
    const exported = page.waitForResponse((response) => matches(response, 'GET', `/patients/${patientId}/clinical-history/export`));
    await page.getByRole('button', { name: 'Exportar historia completa', exact: true }).click();
    // Keep the exact synthetic snapshot consumed by the browser renderer for
    // private reproduction; no credentials or request headers are serialized.
    const history = await responseJson<unknown>(await exported);
    await writeFile(path.join(runDir, 'history-export.json'), JSON.stringify(history, null, 2));
    const download = await downloaded;
    expect(download.suggestedFilename()).toMatch(/historia_completa.*\.pdf$/);
    const pdfPath = path.join(runDir, 'history-complete.pdf');
    await download.saveAs(pdfPath);
    const report = await validateClinicalPdf(await readFile(pdfPath), {
      requiredTexts: [manifest.patient.documentNumber, 'QA_FIN_CONTENIDO', 'QA_IMAGEN_DEMOSTRACION', manifest.doctor.fullName, 'Versión confirmada', ...correctedSource.split('\n'), ...noteParagraphs],
      forbiddenTexts: ['QA_NO_VALIDADO'],
      orderedMarkers: ['QA_ORIGINAL_VALIDADO', 'QA_ATENCION_ORIGINAL', 'QA_CONSULTA_POSTERIOR'],
      expectedDates: ['05 de enero de 2024', '10 de enero de 2024', '20 de febrero de 2024'],
      expectedImages: [{ width: 320, height: 180, belowHeader: true, caption: 'QA_IMAGEN_DEMOSTRACION' }],
      minPageCount: 3,
      maxPageCount: 20,
      requirePageNumbers: true,
      requireEntryBodyOnSamePage: true,
    });
    await writeFile(path.join(runDir, 'pdf-verification.json'), JSON.stringify(report, null, 2));
    await testInfo.attach('complete-synthetic-history', { path: pdfPath, contentType: 'application/pdf' });
    expect(report.issues).toEqual([]);
    expect(report.valid).toBe(true);
  });

  expect(processRequests.get(document.id)).toBe(1);
  expect(processRequests.get(unvalidated.id)).toBe(1);
  expect(browserErrors).toEqual([]);
  await writeFile(path.join(runDir, 'clinical-flow-evidence.json'), JSON.stringify({
    synthetic: true,
    sourceDocumentId: document.id,
    linkedRecordId: linked.id,
    manualRecordId: manual.id,
    unvalidatedDocumentId: unvalidated.id,
    processingRequestsPerDocument: Object.fromEntries(processRequests),
    checkedFragments: 6,
    sourcePages: 2,
    confirmedRecords: 2,
    imageFailureBlockedExport: true,
    completePdfVerified: true,
  }, null, 2));
});
