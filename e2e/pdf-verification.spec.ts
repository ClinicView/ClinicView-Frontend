import { expect, test } from '@playwright/test';
import {
  inspectClinicalPdf,
  normalizePdfText,
  pdfJsDirectoryPath,
  verifyClinicalPdfInspection,
  type ClinicalPdfExpectations,
  type ClinicalPdfInspection,
  type PdfTextFragment,
} from './pdf-verification';

const text = (value: string, y: number, x = 48): PdfTextFragment => ({
  text: value, x, y, width: 200, height: 10,
});

/** Mirror inspectClinicalPdf: text and page text always derive from fragments. */
function syncText(inspection: ClinicalPdfInspection): ClinicalPdfInspection {
  inspection.pageCount = inspection.pages.length;
  for (const page of inspection.pages)
    page.text = normalizePdfText(page.fragments.map(fragment => fragment.text).join(' '));
  inspection.text = normalizePdfText(inspection.pages.map(page => page.text).join(' '));
  return inspection;
}

function replaceText(inspection: ClinicalPdfInspection, from: string, to: string) {
  for (const page of inspection.pages)
    page.fragments = page.fragments.map(fragment => ({ ...fragment, text: fragment.text.replace(from, to) }))
      .filter(fragment => fragment.text.trim());
  return syncText(inspection);
}

function splitAcrossPages(first: string, second: string): ClinicalPdfInspection {
  return syncText({ pageCount: 2, text: '', pages: [
    { number: 1, width: 595, height: 842, text: '', images: [], fragments: [
      text('Paciente de prueba', 35), text(first, 760),
      text('ClinicView · Información confidencial', 795), text('Página 1 de 2', 810),
    ] },
    { number: 2, width: 595, height: 842, text: '', images: [], fragments: [
      text('Paciente de prueba', 35), text('Emitido: fecha de exportación', 55), text(second, 105),
      text('ClinicView · Información confidencial', 795), text('Página 2 de 2', 810),
    ] },
  ] });
}

function fixture(): ClinicalPdfInspection {
  const page = {
    number: 1, width: 595, height: 842,
    text: 'Paciente de prueba ORDEN UNO 31 de diciembre de 2023 ORDEN DOS FIN COMPLETO Imagen sintética Página 1 de 1',
    fragments: [
      text('Paciente de prueba', 35, 330),
      text('ORDEN UNO', 110),
      text('31 de diciembre de 2023', 130),
      text('ORDEN DOS', 150),
      text('FIN COMPLETO', 170),
      text('Imagen sintética', 470),
      text('Página 1 de 1', 810),
    ],
    images: [
      { pixelWidth: 880, pixelHeight: 220, x: 48, y: 32, width: 132, height: 33 },
      { pixelWidth: 320, pixelHeight: 180, x: 70, y: 230, width: 320, height: 180 },
    ],
  };
  return { pageCount: 1, text: page.text, pages: [page] };
}

const expectations: ClinicalPdfExpectations = {
  requiredTexts: ['FIN COMPLETO'],
  forbiddenTexts: ['OCR NO VALIDADO'],
  orderedMarkers: ['ORDEN UNO', 'ORDEN DOS'],
  expectedDates: ['31 de diciembre de 2023'],
  minPageCount: 1,
  maxPageCount: 20,
  requirePageNumbers: true,
  expectedImages: [{ width: 320, height: 180, belowHeader: true, caption: 'Imagen sintética' }],
};

test.describe('downloaded clinical PDF verifier guards', () => {
  test('keeps Node font paths readable on Windows and POSIX with PDF.js trailing slash', () => {
    expect(pdfJsDirectoryPath('C:\\Project with spaces\\node_modules\\pdfjs-dist\\standard_fonts\\')).toBe('C:/Project with spaces/node_modules/pdfjs-dist/standard_fonts/');
    expect(pdfJsDirectoryPath('/workspace/node_modules/pdfjs-dist/standard_fonts/')).toBe('/workspace/node_modules/pdfjs-dist/standard_fonts/');
  });

  test('accepts ordered complete text, clinical dates and a visible non-logo attachment', () => {
    expect(verifyClinicalPdfInspection(fixture(), expectations).issues).toEqual([]);
    expect(normalizePdfText('fecha\n clínica\u00a0 2023\u00ad')).toBe('fecha clínica 2023');
  });

  test('rejects non-PDF downloads before parsing', async () => {
    await expect(inspectClinicalPdf(Buffer.from('<html>Unauthorized</html>'))).rejects.toThrow('not a PDF');
  });

  test('fails when the end of long clinical content is truncated', () => {
    const truncated = fixture();
    replaceText(truncated, 'FIN COMPLETO', '');
    expect(verifyClinicalPdfInspection(truncated, expectations).issues).toContain('Missing PDF text: FIN COMPLETO');
  });

  test('does not let compatibility normalization hide corrupted clinical subscripts', () => {
    const source = fixture();
    source.pages[0].fragments.push(text('SatO2 98 %', 190));
    syncText(source);
    expect(verifyClinicalPdfInspection(source, { requiredUnicodeTexts: ['SatO₂'] }).issues)
      .toContain('Missing exact Unicode PDF text: SatO₂');
    source.pages[0].fragments.pop();
    source.pages[0].fragments.push(text('SatO₂ 98 %', 190));
    syncText(source);
    expect(verifyClinicalPdfInspection(source, { requiredUnicodeTexts: ['SatO₂'] }).issues).toEqual([]);
  });

  test('fails if unvalidated OCR leaks into the actual exported bytes', () => {
    const leaked = fixture();
    leaked.pages[0].fragments.push(text('OCR NO VALIDADO', 190));
    syncText(leaked);
    expect(verifyClinicalPdfInspection(leaked, expectations).issues).toContain('Forbidden PDF text: OCR NO VALIDADO');
  });

  test('rejects reversed clinical chronology and repeated index markers', () => {
    const reversed = fixture();
    const [secondMarker] = reversed.pages[0].fragments.splice(3, 1);
    reversed.pages[0].fragments.splice(1, 0, { ...secondMarker, y: 100 });
    syncText(reversed);
    expect(verifyClinicalPdfInspection(reversed, expectations).issues).toContain('Incorrect chronological order at: ORDEN DOS');
    const repeated = fixture();
    repeated.pages[0].fragments.push(text('ORDEN UNO', 190));
    syncText(repeated);
    expect(verifyClinicalPdfInspection(repeated, expectations).issues).toContain('Chronological marker is not unique; use body-only text: ORDEN UNO');
  });

  test('rejects a date shifted by a timezone conversion', () => {
    const shifted = fixture();
    replaceText(shifted, '31 de diciembre de 2023', '01 de enero de 2024');
    expect(verifyClinicalPdfInspection(shifted, expectations).issues).toContain('Missing PDF text: 31 de diciembre de 2023');
  });

  test('does not mistake a logo, an invisible image, or a caption alone for the attachment', () => {
    for (const mutation of ['absent', 'header', 'tiny', 'caption'] as const) {
      const broken = fixture();
      if (mutation === 'absent') broken.pages[0].images.pop();
      if (mutation === 'header') broken.pages[0].images[1].y = 35;
      if (mutation === 'tiny') broken.pages[0].images[1].width = 1;
      if (mutation === 'caption') replaceText(broken, 'Imagen sintética', '');
      expect(verifyClinicalPdfInspection(broken, expectations).issues.some((issue) => issue.startsWith('Missing visible attachment'))).toBe(true);
    }
  });

  test('detects text outside the page and overlaid paragraphs', () => {
    const outside = fixture();
    outside.pages[0].fragments.push(text('Clipped text', 180, 570));
    syncText(outside);
    expect(verifyClinicalPdfInspection(outside, expectations).issues.some((issue) => issue.includes('outside the page'))).toBe(true);
    const overlap = fixture();
    overlap.pages[0].fragments.push(text('Overlay defect', 110));
    syncText(overlap);
    expect(verifyClinicalPdfInspection(overlap, expectations).issues.some((issue) => issue.includes('overlapping text'))).toBe(true);
  });

  test('detects a displaced attachment hiding text or falling outside the page', () => {
    const overlap = fixture();
    overlap.pages[0].images[1].y = 100;
    expect(verifyClinicalPdfInspection(overlap, expectations).issues.some((issue) => issue.includes('image overlaps text'))).toBe(true);
    const outside = fixture();
    outside.pages[0].images[1].x = 550;
    expect(verifyClinicalPdfInspection(outside, expectations).issues.some((issue) => issue.includes('image falls outside'))).toBe(true);
  });

  test('rejects header/footer-only pages and broken numbering', () => {
    const empty = fixture();
    empty.pages[0].fragments = [text('Paciente de prueba', 35), text('Página 1 de 1', 810)];
    syncText(empty);
    expect(verifyClinicalPdfInspection(empty, expectations).issues.some((issue) => issue.includes('no body text'))).toBe(true);
    const numbering = fixture();
    replaceText(numbering, 'Página 1 de 1', 'Página 0 de 1');
    expect(verifyClinicalPdfInspection(numbering, expectations).issues.some((issue) => issue.includes('page numbering'))).toBe(true);
  });

  test('rejects a clinical entry card orphaned at the page bottom', () => {
    const orphan = fixture();
    orphan.pages[0].fragments.push(text('Fecha de atención: 20 de febrero de 2024 · Estado: Activo', 720));
    syncText(orphan);
    expect(verifyClinicalPdfInspection(orphan, { requireEntryBodyOnSamePage: true }).issues.some((issue) => issue.includes('orphaned entry header'))).toBe(true);
    orphan.pages[0].fragments.push(text('PRIMERA SECCION', 740), text('Contenido de la sección', 758));
    syncText(orphan);
    expect(verifyClinicalPdfInspection(orphan, { requireEntryBodyOnSamePage: true }).issues).toEqual([]);
  });

  test('keeps a clinical section heading with its own first body text, not earlier text or the footer', () => {
    const expected = { expectedSectionStarts: [{ heading: 'EVOLUCIÓN', bodyStart: 'CONTENIDO DE EVOLUCIÓN' }] };
    const orphan = fixture();
    orphan.pages[0].fragments.push(text('EVOLUCIÓN', 745));
    syncText(orphan);
    expect(verifyClinicalPdfInspection(orphan, expected).issues)
      .toContain('Page 1 has an orphaned section heading: EVOLUCIÓN');
    orphan.pages[0].fragments.push(text('CONTENIDO DE EVOLUCIÓN', 720));
    syncText(orphan);
    expect(verifyClinicalPdfInspection(orphan, expected).issues)
      .toContain('Page 1 has an orphaned section heading: EVOLUCIÓN');
    orphan.pages[0].fragments.pop();
    orphan.pages[0].fragments.push(text('CONTENIDO DE EVOLUCIÓN', 802));
    syncText(orphan);
    expect(verifyClinicalPdfInspection(orphan, expected).issues)
      .toContain('Page 1 has an orphaned section heading: EVOLUCIÓN');
    orphan.pages[0].fragments.pop();
    orphan.pages[0].fragments.push(text('CONTENIDO DE EVOLUCIÓN', 762));
    syncText(orphan);
    expect(verifyClinicalPdfInspection(orphan, expected).issues).toEqual([]);
    expect(verifyClinicalPdfInspection(fixture(), expected).issues)
      .toContain('Missing section heading occurrence: EVOLUCIÓN');
  });

  test('checks every repeated section heading, including the final occurrence', () => {
    const inspection = fixture();
    inspection.pages[0].fragments.push(text('EVOLUCIÓN', 190), text('CONTENIDO CLÍNICO', 205));
    inspection.pages.push({ number: 2, width: 595, height: 842, text: '', images: [], fragments: [text('EVOLUCIÓN', 740), text('Página 2 de 2', 810)] });
    syncText(inspection);
    expect(verifyClinicalPdfInspection(inspection, {
      expectedSectionStarts: [{ heading: 'EVOLUCIÓN', bodyStart: 'CONTENIDO CLÍNICO', minOccurrences: 2 }],
    }).issues).toContain('Page 2 has an orphaned section heading: EVOLUCIÓN');
  });

  test('accepts a complete paragraph split across pages without fixed header/footer interruptions', () => {
    const paragraph = 'Parrafo 09: contenido sintetico de seguimiento, conservado integramente para comprobar los saltos de pagina.';
    const inspection = splitAcrossPages(paragraph.slice(0, -7).trim(), 'pagina.');
    expect(inspection.text).not.toContain(paragraph);
    expect(verifyClinicalPdfInspection(inspection, {
      requiredTexts: [paragraph, 'Paciente de prueba'], requirePageNumbers: true,
    }).issues).toEqual([]);
  });

  test('still rejects a missing final word when a paragraph should continue onto the next page', () => {
    const inspection = splitAcrossPages('Contenido clínico conservado hasta la última', 'palabra.');
    replaceText(inspection, 'palabra.', 'CONTENIDO POSTERIOR');
    expect(verifyClinicalPdfInspection(inspection, {
      requiredTexts: ['Contenido clínico conservado hasta la última palabra.'],
    }).issues).toContain('Missing PDF text: Contenido clínico conservado hasta la última palabra.');
  });

  test('keeps exact NFC clinical symbols across pages without letting NFKC mask subscript or micro-sign changes', () => {
    const expected = 'Revisión SatO₂ 98 % ± 2 µg';
    const inspection = splitAcrossPages('Revisio\u0301n SatO₂ 98 %', '± 2 µg');
    expect(verifyClinicalPdfInspection(inspection, { requiredUnicodeTexts: [expected] }).issues).toEqual([]);
    replaceText(inspection, 'SatO₂', 'SatO2');
    expect(verifyClinicalPdfInspection(inspection, { requiredUnicodeTexts: [expected] }).issues)
      .toContain(`Missing exact Unicode PDF text: ${expected}`);
    replaceText(inspection, 'SatO2', 'SatO₂');
    replaceText(inspection, 'µg', 'μg');
    expect(verifyClinicalPdfInspection(inspection, { requiredUnicodeTexts: [expected] }).issues)
      .toContain(`Missing exact Unicode PDF text: ${expected}`);
  });

  test('detects forbidden OCR text split between pages despite fixed header and footer insertions', () => {
    const inspection = splitAcrossPages('OCR NO', 'VALIDADO');
    expect(inspection.text).not.toContain('OCR NO VALIDADO');
    expect(verifyClinicalPdfInspection(inspection, { forbiddenTexts: ['OCR NO VALIDADO'] }).issues)
      .toContain('Forbidden PDF text: OCR NO VALIDADO');
  });

  test('does not erase clinical text that resembles a footer when it is inside the body band', () => {
    const inspection = splitAcrossPages('Antes', 'Después');
    inspection.pages[0].fragments.splice(2, 0, text('ClinicView · Información confidencial', 775));
    // Keep the inserted fragment fully inside the body band (ends at782).
    inspection.pages[0].fragments[2].height = 7;
    syncText(inspection);
    expect(verifyClinicalPdfInspection(inspection, { requiredTexts: ['Antes Después'] }).issues)
      .toContain('Missing PDF text: Antes Después');
    expect(verifyClinicalPdfInspection(inspection, {
      requiredTexts: ['Antes ClinicView · Información confidencial Después'],
    }).issues).toEqual([]);
  });

  test('uses configured body bounds for split paragraphs without changing the full-text view', () => {
    const inspection = splitAcrossPages('Primera parte', 'continuación.');
    inspection.pages[1].fragments.find(fragment => fragment.text === 'continuación.')!.y = 85;
    syncText(inspection);
    expect(verifyClinicalPdfInspection(inspection, { requiredTexts: ['Primera parte continuación.'] }).issues)
      .toContain('Missing PDF text: Primera parte continuación.');
    expect(verifyClinicalPdfInspection(inspection, {
      requiredTexts: ['Primera parte continuación.', 'Emitido: fecha de exportación'],
      bodyBounds: { top: 80, bottom: 782 },
    }).issues).toEqual([]);
  });
});
