import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

type Rectangle = { x: number; y: number; width: number; height: number };

export interface PdfTextFragment extends Rectangle {
  text: string;
}

export interface PdfImagePaint extends Rectangle {
  pixelWidth: number;
  pixelHeight: number;
}

export interface PdfPageInspection {
  number: number;
  width: number;
  height: number;
  text: string;
  fragments: PdfTextFragment[];
  images: PdfImagePaint[];
}

export interface ClinicalPdfInspection {
  pageCount: number;
  text: string;
  pages: PdfPageInspection[];
}

export interface ClinicalPdfExpectations {
  requiredTexts?: readonly string[];
  forbiddenTexts?: readonly string[];
  /** Use unique BODY text, not titles repeated in the table of contents. */
  orderedMarkers?: readonly string[];
  /** Already formatted in the expected clinical timezone, e.g. 31 de diciembre de 2023. */
  expectedDates?: readonly string[];
  minPageCount?: number;
  maxPageCount?: number;
  expectedImages?: readonly {
    width: number;
    height: number;
    minOccurrences?: number;
    /** Match a meaningful painted image, not an invisible image or header logo. */
    minPaintedWidth?: number;
    minPaintedHeight?: number;
    belowHeader?: boolean;
    caption?: string;
  }[];
  checkGeometry?: boolean;
  /** ClinicView's content is between its fixed header and footer. Values are PDF points. */
  bodyBounds?: { top: number; bottom: number };
  requirePageNumbers?: boolean;
  /** Keep each ClinicView entry's title/date card with at least its first body lines. */
  requireEntryBodyOnSamePage?: boolean;
}

export interface ClinicalPdfVerification extends ClinicalPdfInspection {
  valid: boolean;
  issues: string[];
}

/** Preserve dates/punctuation while joining PDF line fragments and discretionary hyphens. */
export function normalizePdfText(value: string): string {
  return value.normalize('NFKC').replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim();
}

/** PDF.js validates a URL-style trailing slash even for its Node fs reader. */
export function pdfJsDirectoryPath(directory: string): string {
  return directory.replace(/\\/g, '/').replace(/\/+$/, '') + '/';
}

/**
 * Inspect the ACTUAL downloaded bytes. This is intentionally independent of export JSON
 * and application internals, so a truncated renderer or missing image cannot pass by
 * asserting only the source data. PDF.js is a dev-only dependency, never client bundled.
 */
export async function inspectClinicalPdf(bytes: Uint8Array): Promise<ClinicalPdfInspection> {
  if (bytes.length < 5 || Buffer.from(bytes.subarray(0, 5)).toString('ascii') !== '%PDF-') {
    throw new Error('The downloaded file is not a PDF.');
  }
  const { getDocument, OPS, Util } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const require = createRequire(resolve(process.cwd(), 'package.json'));
  const packageRoot = dirname(require.resolve('pdfjs-dist/package.json'));
  const task = getDocument({
    // PDF.js transfers this buffer; do not detach the caller's downloaded bytes.
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    useWorkerFetch: false,
    standardFontDataUrl: pdfJsDirectoryPath(join(packageRoot, 'standard_fonts')),
    stopAtErrors: true,
  });
  const document = await task.promise;
  try {
    const pages: PdfPageInspection[] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const fragments: PdfTextFragment[] = [];
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const matrix = Util.transform(viewport.transform, item.transform);
        const fontHeight = Math.hypot(matrix[2], matrix[3]);
        const style = content.styles[item.fontName];
        const ascent = style?.ascent ?? 0.8;
        const descent = style?.descent ?? -0.2;
        fragments.push({
          text: item.str,
          x: matrix[4],
          y: matrix[5] - fontHeight * ascent,
          width: item.width,
          height: fontHeight * (ascent - descent),
        });
      }

      const images: PdfImagePaint[] = [];
      const operators = await page.getOperatorList();
      const resolveImage = async (id: string): Promise<{ width: number; height: number }> => {
        const store = id.startsWith('g_') ? page.commonObjs : page.objs;
        return new Promise((resolveImageData, reject) => {
          const timeout = setTimeout(() => reject(new Error(`PDF page ${number} has an unresolved image.`)), 5_000);
          store.get(id, (data: { width: number; height: number } | null) => {
            clearTimeout(timeout);
            if (data && Number.isFinite(data.width) && Number.isFinite(data.height)) resolveImageData(data);
            else reject(new Error(`PDF page ${number} has an undecodable image.`));
          });
        });
      };
      const identity = [1, 0, 0, 1, 0, 0];
      let transform = identity;
      const stack: number[][] = [];
      const addImage = (pixelWidth: number, pixelHeight: number, imageTransform = transform) => {
        const matrix = Util.transform(viewport.transform, imageTransform);
        const points = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => [
          matrix[0] * x + matrix[2] * y + matrix[4],
          matrix[1] * x + matrix[3] * y + matrix[5],
        ]);
        const xs = points.map(([x]) => x);
        const ys = points.map(([, y]) => y);
        images.push({
          pixelWidth, pixelHeight,
          x: Math.min(...xs), y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        });
      };
      for (let index = 0; index < operators.fnArray.length; index += 1) {
        const operation = operators.fnArray[index];
        const args = operators.argsArray[index];
        if (operation === OPS.save) stack.push([...transform]);
        else if (operation === OPS.restore) transform = stack.pop() ?? identity;
        else if (operation === OPS.transform) transform = Util.transform(transform, args);
        else if (operation === OPS.paintImageXObject) {
          const image = await resolveImage(args[0]);
          addImage(image.width, image.height);
        }
        else if (operation === OPS.paintInlineImageXObject) addImage(args[0].width, args[0].height);
        // Optimized repeated XObjects have no dimensions in their operator arguments.
        // Resolve the decoded image rather than counting only its resource declaration.
        else if (operation === OPS.paintImageXObjectRepeat) {
          const image = await resolveImage(args[0]);
          for (let position = 0; position < args[3].length; position += 2) {
            addImage(image.width, image.height, Util.transform(transform, [
              args[1], 0, 0, args[2], args[3][position], args[3][position + 1],
            ]));
          }
        }
      }
      pages.push({
        number, width: viewport.width, height: viewport.height,
        text: normalizePdfText(fragments.map((fragment) => fragment.text).join(' ')),
        fragments, images,
      });
      page.cleanup();
    }
    return {
      pageCount: document.numPages,
      text: normalizePdfText(pages.map((page) => page.text).join(' ')),
      pages,
    };
  } finally {
    await task.destroy();
  }
}

/** Pure checks are exported so regression tests can prove that the verifier fails closed. */
export function verifyClinicalPdfInspection(
  inspection: ClinicalPdfInspection,
  expected: ClinicalPdfExpectations,
): ClinicalPdfVerification {
  const issues: string[] = [];
  const text = normalizePdfText(inspection.text);
  if (inspection.pageCount < (expected.minPageCount ?? 1)) issues.push('PDF has too few pages.');
  if (expected.maxPageCount !== undefined && inspection.pageCount > expected.maxPageCount) {
    issues.push('PDF has unexpectedly many pages.');
  }
  for (const required of [...(expected.requiredTexts ?? []), ...(expected.expectedDates ?? [])]) {
    if (!text.includes(normalizePdfText(required))) issues.push(`Missing PDF text: ${required}`);
  }
  for (const forbidden of expected.forbiddenTexts ?? []) {
    if (text.includes(normalizePdfText(forbidden))) issues.push(`Forbidden PDF text: ${forbidden}`);
  }
  let previousPosition = -1;
  for (const marker of expected.orderedMarkers ?? []) {
    const normalized = normalizePdfText(marker);
    const position = text.indexOf(normalized);
    if (position < 0) issues.push(`Missing chronological body marker: ${marker}`);
    else {
      if (text.indexOf(normalized, position + normalized.length) >= 0) {
        issues.push(`Chronological marker is not unique; use body-only text: ${marker}`);
      }
      if (position <= previousPosition) issues.push(`Incorrect chronological order at: ${marker}`);
      previousPosition = position;
    }
  }
  for (const image of expected.expectedImages ?? []) {
    const matches = inspection.pages.flatMap((page) => page.images.filter((paint) =>
      paint.pixelWidth === image.width && paint.pixelHeight === image.height &&
      paint.width >= (image.minPaintedWidth ?? 32) && paint.height >= (image.minPaintedHeight ?? 32) &&
      (!image.belowHeader || paint.y >= (expected.bodyBounds?.top ?? 90)) &&
      (!image.caption || page.text.includes(normalizePdfText(image.caption))),
    ));
    if (matches.length < (image.minOccurrences ?? 1)) {
      issues.push(`Missing visible attachment image: ${image.width}x${image.height}${image.caption ? ` (${image.caption})` : ''}`);
    }
  }
  for (const page of inspection.pages) {
    if (!page.fragments.length) issues.push(`Page ${page.number} has no selectable text.`);
    const bodyTop = expected.bodyBounds?.top ?? 90;
    const bodyBottom = expected.bodyBounds?.bottom ?? page.height - 60;
    if (!page.fragments.some((fragment) => fragment.y >= bodyTop && fragment.y + fragment.height <= bodyBottom)) {
      issues.push(`Page ${page.number} has no body text (only header/footer or an empty page).`);
    }
    if (expected.requirePageNumbers && !page.text.includes(`Página ${page.number} de ${inspection.pageCount}`)) {
      issues.push(`Page ${page.number} has missing/incorrect page numbering.`);
    }
    if (expected.requireEntryBodyOnSamePage) {
      for (const header of page.fragments.filter((fragment) => fragment.text.includes(' · Estado: '))) {
        // Metadata can wrap, so start below its last text line. The next section
        // needs a heading and at least one content line, not just a lone heading.
        const following = page.fragments.filter((fragment) =>
          fragment.y > header.y + header.height && fragment.y + fragment.height <= bodyBottom);
        const lineTops = new Set(following.map((fragment) => Math.round(fragment.y)));
        if (lineTops.size < 2) {
          issues.push(`Page ${page.number} has an orphaned entry header: ${header.text.slice(0, 100)}`);
        }
      }
    }
    if (expected.checkGeometry === false) continue;
    const finiteRectangle = (rectangle: Rectangle) => Object.values(rectangle).every((value) =>
      typeof value !== 'number' || Number.isFinite(value));
    for (const fragment of page.fragments) {
      if (!finiteRectangle(fragment) || fragment.width < 0 || fragment.height <= 0 ||
        fragment.x < -1 || fragment.y < -1 || fragment.x + fragment.width > page.width + 1 ||
        fragment.y + fragment.height > page.height + 1) {
        issues.push(`Page ${page.number} text falls outside the page: ${fragment.text.slice(0, 80)}`);
      }
    }
    for (const paint of page.images) {
      if (!finiteRectangle(paint) || paint.x < -1 || paint.y < -1 ||
        paint.x + paint.width > page.width + 1 || paint.y + paint.height > page.height + 1) {
        issues.push(`Page ${page.number} image falls outside the page.`);
      }
      for (const fragment of page.fragments) {
        const horizontal = Math.min(paint.x + paint.width, fragment.x + fragment.width) - Math.max(paint.x, fragment.x);
        const vertical = Math.min(paint.y + paint.height, fragment.y + fragment.height) - Math.max(paint.y, fragment.y);
        if (horizontal > 3 && vertical > fragment.height * 0.45) {
          issues.push(`Page ${page.number} image overlaps text: ${fragment.text.slice(0, 80)}`);
        }
      }
    }
    // A conservative collision test, not a claim to replace visual QA. Tolerances
    // ignore kerning and line-box noise but detect duplicated/overlaid paragraphs.
    for (let first = 0; first < page.fragments.length; first += 1) {
      const a = page.fragments[first];
      for (let second = first + 1; second < page.fragments.length; second += 1) {
        const b = page.fragments[second];
        const horizontal = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const vertical = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (horizontal > 3 && vertical > Math.min(a.height, b.height) * 0.45) {
          issues.push(`Page ${page.number} overlapping text: ${a.text.slice(0, 45)} / ${b.text.slice(0, 45)}`);
        }
      }
    }
  }
  return { ...inspection, valid: issues.length === 0, issues };
}

export async function validateClinicalPdf(
  bytes: Uint8Array,
  expected: ClinicalPdfExpectations,
): Promise<ClinicalPdfVerification> {
  return verifyClinicalPdfInspection(await inspectClinicalPdf(bytes), expected);
}
