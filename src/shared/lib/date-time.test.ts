import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  ageFromDateOnly,
  currentDateOnly,
  currentDateTimeLocal,
  dateTimeLocalToIso,
  formatDateOnly,
  formatInstant,
  isFutureDateOnly,
  isFutureDateTimeLocal,
  isValidDateOnly,
  isoToDateTimeLocal,
  toDateOnlyInputValue,
} from './date-time';

test('normaliza date-only sin desplazar el día', () => {
  assert.equal(toDateOnlyInputValue('1990-01-01'), '1990-01-01');
  assert.equal(
    formatDateOnly('1990-01-01', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    '01/01/1990',
  );
});

test('rechaza fechas civiles inexistentes', () => {
  assert.equal(toDateOnlyInputValue('2025-02-29'), '');
  assert.equal(toDateOnlyInputValue('2024-02-29'), '2024-02-29');
  assert.equal(toDateOnlyInputValue('2024-02-29T00:00:00.000Z'), '');
  assert.equal(toDateOnlyInputValue('2024-02-29Trash'), '');
  assert.equal(isValidDateOnly('2024-02-29'), true);
  assert.equal(isValidDateOnly('2025-02-29'), false);
});

test('calcula la edad con el día clínico de Lima', () => {
  const beforeBirthday = new Date('2026-09-03T04:59:59.999Z');
  const onBirthday = new Date('2026-09-03T05:00:00.000Z');

  assert.equal(ageFromDateOnly('2000-09-03', beforeBirthday), 25);
  assert.equal(ageFromDateOnly('2000-09-03', onBirthday), 26);
  assert.equal(ageFromDateOnly('2030-01-01', onBirthday), null);
});

test('usa el calendario de Lima para máximos aunque el proceso esté en otra zona', () => {
  const instant = new Date('2026-09-03T02:30:00.000Z');
  assert.equal(currentDateOnly(instant), '2026-09-02');
  assert.equal(currentDateTimeLocal(instant), '2026-09-02T21:30');
});

test('convierte datetime-local de Lima a un instante UTC estable', () => {
  const localValue = '2026-06-14T09:35';
  const iso = dateTimeLocalToIso(localValue);

  assert.equal(iso, '2026-06-14T14:35:00.000Z');
  assert.equal(isoToDateTimeLocal(iso), localValue);
  assert.equal(dateTimeLocalToIso('2026-02-30T10:00'), null);
  assert.equal(dateTimeLocalToIso('texto inválido'), null);
});

test('rechaza horas históricas inexistentes o duplicadas en Lima', () => {
  assert.equal(dateTimeLocalToIso('1994-01-01T00:30'), null);
  assert.equal(dateTimeLocalToIso('1994-03-31T23:30'), null);
});

test('preserva segundos y milisegundos al corregir un valor de precisión minuto', () => {
  assert.equal(
    dateTimeLocalToIso('2026-09-02T10:30', {
      preserveSubMinuteFrom: '2026-09-02T14:30:45.987Z',
    }),
    '2026-09-02T15:30:45.987Z',
  );
});

test('formatea instantes y evalúa fechas futuras con política Lima', () => {
  const now = new Date('2026-09-03T02:30:00.000Z');
  assert.equal(
    formatInstant(now, { day: '2-digit', month: '2-digit', year: 'numeric' }),
    '02/09/2026',
  );
  assert.equal(isFutureDateOnly('2026-09-03', now), true);
  assert.equal(isFutureDateOnly('2026-09-02', now), false);
  assert.equal(isFutureDateTimeLocal('2026-09-02T21:31', now), true);
  assert.equal(isFutureDateTimeLocal('2026-09-02T21:30', now), false);
});
