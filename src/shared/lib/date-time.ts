const DEFAULT_LOCALE = 'es-PE';
export const CLINICAL_TIME_ZONE = 'America/Lima';

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

interface DateTimeParts extends DateOnlyParts {
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

export interface DateTimeLocalToIsoOptions {
  /** Conserva segundos y milisegundos ocultos por un input con precisión de minutos. */
  preserveSubMinuteFrom?: string | Date | null;
}

const CLINICAL_PARTS_FORMATTER = new Intl.DateTimeFormat(
  'en-CA-u-ca-gregory-nu-latn',
  {
    timeZone: CLINICAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  },
);

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
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
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

function clinicalDateTimeParts(date: Date): DateTimeParts {
  const values = new Map(
    CLINICAL_PARTS_FORMATTER.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.get('year')!,
    month: values.get('month')!,
    day: values.get('day')!,
    hour: values.get('hour')!,
    minute: values.get('minute')!,
    second: values.get('second')!,
    millisecond: date.getUTCMilliseconds(),
  };
}

function utcTimestampFromParts(parts: DateTimeParts): number {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, parts.millisecond);
  return date.getTime();
}

function clinicalOffsetMilliseconds(date: Date): number {
  return utcTimestampFromParts(clinicalDateTimeParts(date)) - date.getTime();
}

function sameDateTimeParts(left: DateTimeParts, right: DateTimeParts): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second &&
    left.millisecond === right.millisecond
  );
}

/** Resuelve una hora de pared de Lima y rechaza horas inexistentes o duplicadas. */
function clinicalDateTimeToInstant(parts: DateTimeParts): Date | null {
  const wallClockTimestamp = utcTimestampFromParts(parts);
  const sampleWindow = 36 * 60 * 60 * 1000;
  const offsets = new Set(
    [-sampleWindow, 0, sampleWindow].map((delta) =>
      clinicalOffsetMilliseconds(new Date(wallClockTimestamp + delta)),
    ),
  );
  const candidates = new Map<number, Date>();

  for (const offset of offsets) {
    const candidate = new Date(wallClockTimestamp - offset);
    if (sameDateTimeParts(clinicalDateTimeParts(candidate), parts)) {
      candidates.set(candidate.getTime(), candidate);
    }
  }

  return candidates.size === 1 ? [...candidates.values()][0] : null;
}

/**
 * Normaliza un DATE de API (`YYYY-MM-DD`) sin convertirlo a un instante.
 */
export function toDateOnlyInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const parts = parseDateOnly(value);
  return parts ? dateOnlyFromParts(parts) : '';
}

export function isValidDateOnly(value: string | null | undefined): boolean {
  return Boolean(value && parseDateOnly(value));
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

/** Devuelve la fecha civil actual en Lima para inputs `type="date"`. */
export function currentDateOnly(now = new Date()): string {
  return dateOnlyFromParts(clinicalDateTimeParts(now));
}

export function isFutureDateOnly(value: string, now = new Date()): boolean {
  const normalized = toDateOnlyInputValue(value);
  return normalized !== '' && normalized > currentDateOnly(now);
}

/** Calcula edad comparando calendarios, nunca instantes UTC. */
export function ageFromDateOnly(
  value: string | null | undefined,
  now = new Date(),
): number | null {
  if (!value) return null;
  const birth = parseDateOnly(value);
  if (!birth) return null;

  const today = clinicalDateTimeParts(now);
  const birthKey = birth.year * 10_000 + birth.month * 100 + birth.day;
  const todayKey = today.year * 10_000 + today.month * 100 + today.day;
  if (birthKey > todayKey) return null;

  let age = today.year - birth.year;
  if (today.month < birth.month || (today.month === birth.month && today.day < birth.day)) {
    age -= 1;
  }
  return age;
}

/** Formatea un instante ISO con la zona clínica fija de Lima. */
export function formatInstant(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
  fallback = '—',
): string {
  if (!value) return fallback;
  const date = validInstant(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    ...options,
    timeZone: CLINICAL_TIME_ZONE,
  }).format(date);
}

/** Convierte un instante ISO a la hora de Lima esperada por `datetime-local`. */
export function isoToDateTimeLocal(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = validInstant(value);
  if (!date) return '';
  const parts = clinicalDateTimeParts(date);
  return [
    `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`,
    `${pad(parts.hour)}:${pad(parts.minute)}`,
  ].join('T');
}

/** Devuelve el instante actual como hora de pared de Lima para `datetime-local`. */
export function currentDateTimeLocal(now = new Date()): string {
  return isoToDateTimeLocal(now);
}

/** Interpreta un `datetime-local` como hora de Lima y lo convierte a ISO UTC. */
export function dateTimeLocalToIso(
  value: string,
  options: DateTimeLocalToIsoOptions = {},
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(
    value.trim(),
  );
  if (!match) return null;

  const dateParts = parseDateOnly(`${match[1]}-${match[2]}-${match[3]}`);
  if (!dateParts) return null;

  const hour = Number(match[4]);
  const minute = Number(match[5]);
  let second = Number(match[6] ?? 0);
  let millisecond = Number((match[7] ?? '0').padEnd(3, '0'));
  if (hour > 23 || minute > 59 || second > 59) return null;

  if (match[6] === undefined && options.preserveSubMinuteFrom) {
    const original = validInstant(options.preserveSubMinuteFrom);
    if (!original) return null;
    second = original.getUTCSeconds();
    millisecond = original.getUTCMilliseconds();
  }

  return clinicalDateTimeToInstant({
    ...dateParts,
    hour,
    minute,
    second,
    millisecond,
  })?.toISOString() ?? null;
}

export function isFutureDateTimeLocal(value: string, now = new Date()): boolean {
  const instant = dateTimeLocalToIso(value);
  return instant !== null && new Date(instant).getTime() > now.getTime();
}
