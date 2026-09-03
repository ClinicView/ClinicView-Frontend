import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  getRecordDetailsPresentation,
  getRecordDetailsSearchText,
  recordDetailsIncludeValue,
} from './record-details-presentation';

test('mantiene vacía la presentación de registros legacy sin details', () => {
  assert.deepEqual(getRecordDetailsPresentation('CONSULTATION', {}), []);
  assert.deepEqual(getRecordDetailsPresentation('EVOLUTION', null), []);
});

test('presenta paths anidados y opciones con etiquetas clínicas', () => {
  const sections = getRecordDetailsPresentation('CONSULTATION', {
    chiefComplaint: 'Cefalea persistente',
    vitalSigns: {
      systolicBloodPressure: 120,
      diastolicBloodPressure: 80,
      oxygenSaturation: 98,
    },
    diagnoses: [
      {
        description: 'Hipertensión arterial esencial',
        code: 'I10',
        type: 'CONFIRMED',
      },
    ],
  });

  assert.equal(sections.length, 3);
  assert.deepEqual(
    sections[1].blocks[0],
    {
      kind: 'fields',
      key: 'consultation-vitals-fields-0',
      fields: [
        {
          key: 'vitalSigns.systolicBloodPressure',
          label: 'Presión sistólica (mmHg)',
          value: '120',
          wide: false,
        },
        {
          key: 'vitalSigns.diastolicBloodPressure',
          label: 'Presión diastólica (mmHg)',
          value: '80',
          wide: false,
        },
        {
          key: 'vitalSigns.oxygenSaturation',
          label: 'Saturación de oxígeno (%)',
          value: '98',
          wide: false,
        },
      ],
    },
  );

  const diagnoses = sections[2].blocks[0];
  assert.equal(diagnoses.kind, 'table');
  if (diagnoses.kind !== 'table') return;
  assert.deepEqual(
    diagnoses.columns.map((column) => column.label),
    ['Descripción', 'Código', 'Tipo'],
  );
  assert.deepEqual(diagnoses.rows, [
    ['Hipertensión arterial esencial', 'I10', 'Confirmado'],
  ]);
});

test('conserva el orden entre tablas y texto posterior', () => {
  const sections = getRecordDetailsPresentation('LAB_RESULT', {
    studyName: 'Hemograma completo',
    results: [
      {
        analyte: 'Hemoglobina',
        value: '11.2',
        unit: 'g/dL',
        flag: 'LOW',
      },
    ],
    interpretation: 'Anemia leve compatible con ferropenia.',
  });

  assert.equal(sections[1].blocks[0].kind, 'table');
  assert.equal(sections[1].blocks[1].kind, 'fields');
  const table = sections[1].blocks[0];
  if (table.kind !== 'table') return;
  assert.deepEqual(table.rows[0], ['Hemoglobina', '11.2', 'g/dL', 'Bajo']);
});

test('incorpora details a la búsqueda y permite omitir duplicados legacy', () => {
  const sections = getRecordDetailsPresentation('PROCEDURE', {
    procedureName: 'Curación de herida',
    technique: 'Lavado con solución salina y cobertura estéril.',
    complications: 'No se presentaron complicaciones.',
  });

  const searchText = getRecordDetailsSearchText(sections);
  assert.match(searchText, /curación de herida/);
  assert.match(searchText, /cobertura estéril/);
  assert.equal(
    recordDetailsIncludeValue(sections, '  No se presentaron   complicaciones. '),
    true,
  );
  assert.equal(recordDetailsIncludeValue(sections, 'Texto diferente'), false);
});
