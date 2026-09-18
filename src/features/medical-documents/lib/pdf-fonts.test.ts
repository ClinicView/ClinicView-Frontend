import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { unsupportedPdfCharacters } from './pdf-fonts';

const font = (text: string) => ({ hasGlyphForCodePoint: (code: number) => text.includes(String.fromCodePoint(code)) });

test('checks Unicode code points without flattening subscripts, accents or clinical symbols', () => {
  assert.deepEqual(unsupportedPdfCharacters(['SatO₂ 98 %\nµg ± ≥ ≤ α β →'], [font('SatO₂ 98 %µg ± ≥ ≤ α β →')]), []);
  assert.deepEqual(unsupportedPdfCharacters(['₂ 2 ₂'], [font(' 2')]), ['₂']);
});

test('accepts coverage from fallback fonts but requires both body and bold coverage', () => {
  assert.deepEqual(unsupportedPdfCharacters(['O₂≥'], [font('O₂'), font('≥')], [font('O₂'), font('≥')]), []);
  assert.deepEqual(unsupportedPdfCharacters(['O₂≥'], [font('O₂≥')], [font('O≥')]), ['₂']);
});

test('reports unsupported characters once and does not treat surrogate halves as symbols', () => {
  assert.deepEqual(unsupportedPdfCharacters(['漢漢\r\n\t😀'], [font('')]), ['漢', '😀']);
});
