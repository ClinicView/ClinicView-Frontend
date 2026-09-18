import type { Font as PdfFontStore } from '@react-pdf/renderer';

/** Static, OFL-licensed fonts served by ClinicView, never a third-party CDN. */
export const PDF_FONT_FILES = {
  regular: '/fonts/pdf/NotoSans-Regular.ttf',
  bold: '/fonts/pdf/NotoSans-Bold.ttf',
  math: '/fonts/pdf/NotoSansMath-Regular.ttf',
  symbols: '/fonts/pdf/NotoSansSymbols2-Regular.ttf',
} as const;

export type PdfFontSources = Record<keyof typeof PDF_FONT_FILES, string>;
/** Safe, actionable message for the export UI, never a raw font/network error. */
export class PdfTypographyError extends Error {
  override name = 'PdfTypographyError';
}
type GlyphFont = { hasGlyphForCodePoint: (codePoint: number) => boolean };

function requireGlyphFont(value: unknown): GlyphFont {
  // react-pdf's published subset of fontkit types omits this runtime API.
  if (typeof value !== 'object' || value === null || !('hasGlyphForCodePoint' in value) ||
      typeof value.hasGlyphForCodePoint !== 'function') throw new Error('Fuente PDF no disponible.');
  return value as GlyphFont;
}

/** Fail closed instead of silently replacing a clinical symbol with a different glyph. */
export function unsupportedPdfCharacters(
  values: Iterable<string>,
  regular: readonly GlyphFont[],
  bold: readonly GlyphFont[] = regular,
): string[] {
  const unsupported = new Set<string>();
  const checked = new Set<number>();
  for (const value of values) {
    for (const character of value) {
      const code = character.codePointAt(0)!;
      if (character === '\n' || character === '\r' || character === '\t' || checked.has(code)) continue;
      checked.add(code);
      if (!regular.some(font => font.hasGlyphForCodePoint(code)) ||
          !bold.some(font => font.hasGlyphForCodePoint(code))) unsupported.add(character);
    }
  }
  return [...unsupported];
}

interface PreparedFonts {
  families: string[];
  regular: GlyphFont[];
  bold: GlyphFont[];
}

const prepared = new Map<string, Promise<PreparedFonts>>();
let attempt = 0;

export function preparePdfFonts(Font: typeof PdfFontStore, sources: PdfFontSources): Promise<PreparedFonts> {
  const key = JSON.stringify(sources);
  const cached = prepared.get(key);
  if (cached) return cached;
  // A failed FontSource caches its rejected load. Retry with fresh family names
  // without clearing the global font store or disrupting another ongoing export.
  const prefix = `ClinicViewPdf${++attempt}`;
  const families = [`${prefix}Sans`, `${prefix}Math`, `${prefix}Symbols`];
  const pending = (async () => {
    Font.register({ family: families[0], fonts: [
      { src: sources.regular, fontWeight: 400 },
      { src: sources.bold, fontWeight: 700 },
    ] });
    Font.register({ family: families[1], src: sources.math });
    Font.register({ family: families[2], src: sources.symbols });
    const descriptors = [
      { fontFamily: families[0], fontWeight: 400 },
      { fontFamily: families[0], fontWeight: 700 },
      { fontFamily: families[1] },
      { fontFamily: families[2] },
    ];
    await Promise.all(descriptors.map(descriptor => Font.load(descriptor)));
    const data = descriptors.map(descriptor => requireGlyphFont(Font.getFont(descriptor).data));
    return { families, regular: [data[0], data[2], data[3]], bold: [data[1], data[2], data[3]] };
  })();
  prepared.set(key, pending);
  pending.catch(() => prepared.delete(key));
  return pending;
}
