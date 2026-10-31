import dayjs, { Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/es';

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ZONED_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * A YYYY-MM-DD value is a calendar date, NOT a UTC instant.
 * Never call new Date(dateOnly).toISOString() to render operational dates.
 */
export function parseCalendarDate(value: string): Dayjs {
  if (!CALENDAR_DATE.test(value)) throw new Error('Fecha inválida: se requiere YYYY-MM-DD.');
  const parsed = dayjs(value, 'YYYY-MM-DD', true);
  if (!parsed.isValid()) throw new Error('Fecha de calendario inexistente.');
  return parsed;
}

export function formatCalendarDate(value: string, format = 'DD/MM/YYYY'): string {
  return parseCalendarDate(value).locale('es').format(format);
}

/** An instant must include its UTC marker or explicit numeric offset. */
export function parseIsoInstant(value: string): Dayjs {
  if (!ZONED_INSTANT.test(value)) throw new Error('El instante requiere zona UTC (Z) u offset explícito.');
  // Day.js may normalize impossible calendar dates if not checked separately.
  parseCalendarDate(value.slice(0, 10));
  const hour = Number(value.slice(11, 13));
  const minute = Number(value.slice(14, 16));
  const second = Number(value.slice(17, 19));
  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error('Hora del instante inválida.');
  }
  if (!value.endsWith('Z')) {
    const offset = value.slice(-6);
    const offsetHours = Number(offset.slice(1, 3));
    const offsetMinutes = Number(offset.slice(4, 6));
    if (offsetHours > 14 || offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes > 0)) {
      throw new Error('Offset horario inválido.');
    }
  }
  const parsed = dayjs(value);
  if (!parsed.isValid()) throw new Error('Instante ISO inválido.');
  return parsed.utc();
}

function checkedTimeZone(timeZone: string): string {
  if (!timeZone.trim()) throw new RangeError('La zona horaria es obligatoria.');
  // Intl throws on invalid IANA zones, preventing silent fallback to browser time.
  new Intl.DateTimeFormat('es', { timeZone });
  return timeZone;
}

/** Render server instants in the selected branch IANA time zone. */
export function formatInstant(
  value: string,
  timeZone: string,
  format = 'DD/MM/YYYY HH:mm',
): string {
  return parseIsoInstant(value).tz(checkedTimeZone(timeZone)).locale('es').format(format);
}

/** Date a given instant falls on in the branch (not necessarily browser) zone. */
export function calendarDateAtBranch(value: string, timeZone: string): string {
  return parseIsoInstant(value).tz(checkedTimeZone(timeZone)).format('YYYY-MM-DD');
}
