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
