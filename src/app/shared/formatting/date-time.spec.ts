import { describe, expect, it } from 'vitest';
import {
  calendarDateAtBranch, formatCalendarDate, formatInstant, parseCalendarDate, parseIsoInstant,
} from './date-time';

describe('shared date formatting', () => {
  it('parses calendar dates strictly without shifting the day', () => {
    expect(formatCalendarDate('2026-10-31')).toBe('31/10/2026');
    expect(() => parseCalendarDate('2026-02-30')).toThrow();
    expect(() => parseCalendarDate('31/10/2026')).toThrow();
  });

  it('requires timezone information for instants', () => {
    expect(() => parseIsoInstant('2026-10-31T01:00:00')).toThrow();
    expect(parseIsoInstant('2026-10-31T01:00:00Z').toISOString()).toBe('2026-10-31T01:00:00.000Z');
  });

  it('uses branch timezone even when calendar day changes', () => {
    const instant = '2026-10-31T01:00:00Z';
    expect(calendarDateAtBranch(instant, 'America/Guatemala')).toBe('2026-10-30');
    expect(formatInstant(instant, 'America/Guatemala')).toBe('30/10/2026 19:00');
    expect(formatInstant(instant, 'UTC')).toBe('31/10/2026 01:00');
  });

  it('rejects invalid timezones instead of using local browser time', () => {
    expect(() => formatInstant('2026-10-31T01:00:00Z', 'Incorrect/Timezone')).toThrow();
  });
});
