import Decimal from 'decimal.js';

/**
 * Backend money and quantities are decimal strings. Never convert them through
 * JavaScript number, even for display: values can exceed Number.MAX_SAFE_INTEGER.
 */
// Isolated arithmetic context: do not change Decimal.js defaults for other features.
const ApiDecimal = Decimal.clone({ precision: 80, rounding: Decimal.ROUND_HALF_UP });
const DECIMAL_INPUT = /^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export function parseApiDecimal(value: string): Decimal {
  const normalized = value.trim();
  if (!DECIMAL_INPUT.test(normalized)) {
    throw new Error('Se esperaba un número decimal válido sin separadores de miles.');
  }
  return new ApiDecimal(normalized);
}

/** API-friendly canonical decimal string (no scientific notation). */
export function toApiDecimal(value: string): string {
  return parseApiDecimal(value).toFixed();
}

/** Rounds explicitly only when the business UI requests a fixed scale. */
export function roundDecimal(value: string, scale: number): string {
  if (!Number.isInteger(scale) || scale < 0 || scale > 20) {
    throw new RangeError('La precisión debe ser un entero entre 0 y 20.');
  }
  return parseApiDecimal(value).toFixed(scale, Decimal.ROUND_HALF_UP);
}

/** Decimal addition without binary floating-point arithmetic. */
export function sumDecimals(values: readonly string[]): string {
  return values.reduce<Decimal>((sum, value) => sum.plus(parseApiDecimal(value)), new ApiDecimal(0)).toFixed();
}

export interface DecimalDisplayOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

function decimalDisplay(value: string, minimum: number, maximum: number): string {
  if (!Number.isInteger(minimum) || !Number.isInteger(maximum) ||
      minimum < 0 || maximum > 20 || maximum < minimum) {
    throw new RangeError('Precisión decimal inválida.');
  }
  const rounded = parseApiDecimal(value).toDecimalPlaces(maximum, Decimal.ROUND_HALF_UP);
  const isNegative = rounded.isNegative() && !rounded.isZero();
  const [whole, fraction = ''] = rounded.abs().toFixed(maximum).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const trimmed = fraction.replace(/0+$/, '');
  const digits = trimmed.padEnd(minimum, '0');
  return (isNegative ? '-' : '') + grouped + (digits ? '.' + digits : '');
}

/** Groups thousands while preserving exact decimal-string input. */
export function formatDecimal(value: string, options: DecimalDisplayOptions = {}): string {
  return decimalDisplay(value, options.minimumFractionDigits ?? 0, options.maximumFractionDigits ?? 6);
}

/** Currency display only. Do not submit this formatted string back to the API. */
export function formatCurrency(
  value: string,
  currency: 'GTQ' | 'USD' = 'GTQ',
): string {
  const formatted = decimalDisplay(value, 2, 2);
  const negative = formatted.startsWith('-');
  const symbol = currency === 'GTQ' ? 'Q' : 'US$';
  return (negative ? '-' : '') + symbol + ' ' + (negative ? formatted.slice(1) : formatted);
}
