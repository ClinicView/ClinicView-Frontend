const DEFAULT_LOCALE = 'es-PE';

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
};

interface DateOnlyParts {
  year: number;
  month: number;
  day: number;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseDateOnly(value: string): DateOnlyParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }

  return { year, month, day };
}

function dateOnlyFromParts({ year, month, day }: DateOnlyParts): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

function dateAtUtcMidnight({ year, month, day }: DateOnlyParts): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function validInstant(value: string | Date): Date | null {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Normaliza un DATE de API (`YYYY-MM-DD` o un ISO que empiece por esa fecha)
 * sin convertirlo a la zona horaria del navegador.
 */
export function toDateOnlyInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const parts = parseDateOnly(value);
  return parts ? dateOnlyFromParts(parts) : '';
}

/** Formatea una fecha civil sin desplazarla por UTC/zona horaria. */
export function formatDateOnly(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
  fallback = '—',
): string {
  if (!value) return fallback;
  const parts = parseDateOnly(value);
  if (!parts) return fallback;

  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    ...options,
    timeZone: 'UTC',
  }).format(dateAtUtcMidnight(parts));
}

/** Devuelve la fecha civil local actual para inputs `type="date"`. */
export function currentDateOnly(now = new Date()): string {
  return dateOnlyFromParts({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  });
}

/** Calcula edad comparando calendarios, nunca instantes UTC. */
export function ageFromDateOnly(
  value: string | null | undefined,
  now = new Date(),
): number | null {
  if (!value) return null;
  const birth = parseDateOnly(value);
  if (!birth) return null;

  const today = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
  const birthKey = birth.year * 10_000 + birth.month * 100 + birth.day;
  const todayKey = today.year * 10_000 + today.month * 100 + today.day;
  if (birthKey > todayKey) return null;

  let age = today.year - birth.year;
  if (today.month < birth.month || (today.month === birth.month && today.day < birth.day)) {
    age -= 1;
  }
  return age;
}

/** Formatea un instante ISO en la zona horaria local del usuario. */
export function formatInstant(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
  fallback = '—',
): string {
  if (!value) return fallback;
  const date = validInstant(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, options).format(date);
}

/** Convierte un instante ISO al valor local esperado por `datetime-local`. */
export function isoToDateTimeLocal(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = validInstant(value);
  if (!date) return '';
  return [
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join('T');
}

/** Devuelve el instante actual como valor local para `datetime-local`. */
export function currentDateTimeLocal(now = new Date()): string {
  return isoToDateTimeLocal(now);
}

/** Convierte de forma explícita un `datetime-local` a ISO UTC. */
export function dateTimeLocalToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(
    value.trim(),
  );
  if (!match) return null;

  const dateParts = parseDateOnly(`${match[1]}-${match[2]}-${match[3]}`);
  if (!dateParts) return null;

  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  const millisecond = Number((match[7] ?? '0').padEnd(3, '0'));
  if (hour > 23 || minute > 59 || second > 59) return null;

  const date = new Date(0);
  date.setFullYear(dateParts.year, dateParts.month - 1, dateParts.day);
  date.setHours(hour, minute, second, millisecond);

  // También detecta horas locales inexistentes durante cambios de DST.
  if (
    date.getFullYear() !== dateParts.year ||
    date.getMonth() !== dateParts.month - 1 ||
    date.getDate() !== dateParts.day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return null;
  }

  return date.toISOString();
}
