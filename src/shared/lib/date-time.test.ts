import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  ageFromDateOnly,
  currentDateOnly,
  dateTimeLocalToIso,
  formatDateOnly,
  isoToDateTimeLocal,
  toDateOnlyInputValue,
} from './date-time';

test('normaliza date-only sin desplazar el día', () => {
  assert.equal(toDateOnlyInputValue('1990-01-01'), '1990-01-01');
  assert.equal(toDateOnlyInputValue('1990-01-01T00:00:00.000Z'), '1990-01-01');
  assert.equal(
    formatDateOnly('1990-01-01T00:00:00.000Z', {
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
});

test('calcula la edad alrededor del cumpleaños con calendario local', () => {
  const beforeBirthday = new Date(2026, 8, 2, 12, 0);
  const onBirthday = new Date(2026, 8, 3, 12, 0);

  assert.equal(ageFromDateOnly('2000-09-03', beforeBirthday), 25);
  assert.equal(ageFromDateOnly('2000-09-03', onBirthday), 26);
  assert.equal(ageFromDateOnly('2030-01-01', onBirthday), null);
});

test('usa el calendario local para el máximo de un input date', () => {
  assert.equal(currentDateOnly(new Date(2026, 0, 2, 23, 30)), '2026-01-02');
});

test('datetime-local conserva el mismo valor tras convertir a ISO y volver', () => {
  const localValue = '2026-06-14T09:35';
  const iso = dateTimeLocalToIso(localValue);

  assert.ok(iso);
  assert.equal(isoToDateTimeLocal(iso), localValue);
  assert.equal(dateTimeLocalToIso('2026-02-30T10:00'), null);
  assert.equal(dateTimeLocalToIso('texto inválido'), null);
});
