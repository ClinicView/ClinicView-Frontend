import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { clinicalSummarySections } from './clinical-summary-presentation';
import type { ClinicalSummaryPayload } from '../types/clinical-summary';

const empty: ClinicalSummaryPayload = {
  allergyStatus: 'UNKNOWN',
  allergies: [],
  problemStatus: 'UNKNOWN',
  problems: [],
  medicationStatus: 'UNKNOWN',
  medications: [],
};
test('la exportación diferencia desconocido de ausencia declarada', () => {
  assert.match(clinicalSummarySections(empty)[0].content, /Por verificar/);
  assert.match(
    clinicalSummarySections({ ...empty, allergyStatus: 'NONE_KNOWN' })[0]
      .content,
    /declarado/,
  );
});
test('preserva reacciones, fuentes y elementos no vigentes en la exportación', () => {
  const sections = clinicalSummarySections({
    ...empty,
    allergyStatus: 'RECORDED',
    allergies: [
      {
        id: 'a',
        name: 'Sustancia demo',
        reaction: 'Reacción demo',
        severity: 'SEVERE',
        notes: 'Fuente demo',
      },
    ],
    problemStatus: 'RECORDED',
    problems: [
      {
        id: 'p',
        name: 'Problema demo',
        status: 'RESOLVED',
        code: 'DEMO',
        onsetDate: '2026-08-01',
      },
    ],
    medicationStatus: 'RECORDED',
    medications: [
      {
        id: 'm',
        name: 'Medicamento demo',
        regimen: 'Pauta demo',
        status: 'STOPPED',
        indication: 'Indicación demo',
      },
    ],
  });
  assert.match(
    sections[0].content,
    /Reacción demo.*Grave\nObservaciones: Fuente demo/,
  );
  assert.match(sections[1].content, /Resuelto.*2026-08-01/);
  assert.match(sections[2].content, /Suspendida\nIndicación: Indicación demo/);
  assert.match(sections[2].title, /no constituye una prescripción/);
});
