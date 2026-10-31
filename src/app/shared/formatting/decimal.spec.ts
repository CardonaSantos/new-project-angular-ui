import { describe, expect, it } from 'vitest';
import {
  formatCurrency, formatDecimal, parseApiDecimal, roundDecimal, sumDecimals, toApiDecimal,
} from './decimal';

describe('shared decimal formatting', () => {
  it('keeps exact amounts beyond JavaScript safe integers', () => {
    expect(toApiDecimal('9007199254740993.01')).toBe('9007199254740993.01');
    expect(formatCurrency('9007199254740993.01')).toBe('Q 9,007,199,254,740,993.01');
  });

  it('adds binary-floating-point edge cases exactly', () => {
    expect(sumDecimals(['0.10', '0.20'])).toBe('0.3');
    expect(roundDecimal(sumDecimals(['0.10', '0.20']), 2)).toBe('0.30');
  });

  it('formats negative currencies and quantities', () => {
    expect(formatCurrency('-1234.5')).toBe('-Q 1,234.50');
    expect(formatCurrency('0.004', 'USD')).toBe('US$ 0.00');
    expect(formatDecimal('1234.56789', { maximumFractionDigits: 3 })).toBe('1,234.568');
  });

  it('rejects unsafe or ambiguous input', () => {
    for (const value of ['NaN', 'Infinity', '1,000.50', '1e4', '12foo', '']) {
      expect(() => parseApiDecimal(value)).toThrow();
    }
    expect(() => roundDecimal('1.2', -1)).toThrow();
  });
});
