import { contrastRatio, generateThemeColors, isValidHexColor } from './theme-palette';
import type { ResolvedMode } from './theme-presets';

/** Brand colors spanning hues plus the degenerate greys. */
const BRANDS = ['#fd024e', '#604535', '#245e9b', '#2e7d32', '#ffc107', '#8e24aa', '#777777', '#000000', '#ffffff'];
const MODES: ResolvedMode[] = ['light', 'dark'];

/**
 * Pairs that actually meet on screen. The last two matter most: components
 * put on-surface text inside hover backgrounds painted with primaryContainer,
 * so those have to hold even though they are not a "designed" pair.
 */
const PAIRS: [keyof ReturnType<typeof generateThemeColors>, keyof ReturnType<typeof generateThemeColors>][] = [
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onSurface', 'surface'],
  ['onSurfaceVariant', 'surface'],
  ['onSurface', 'surfaceContainer'],
  ['onSurfaceVariant', 'surfaceContainer'],
  ['onSurface', 'primaryContainer'],
  ['onSurfaceVariant', 'primaryContainer'],
];

describe('theme palette generated from a brand color', () => {
  it('keeps every on/background pair at AA in both modes', () => {
    const failures: string[] = [];
    for (const brand of BRANDS) {
      for (const mode of MODES) {
        const colors = generateThemeColors(brand, mode);
        for (const [foreground, background] of PAIRS) {
          const ratio = contrastRatio(colors[foreground], colors[background]);
          if (ratio < 4.5)
            failures.push(`${brand} ${mode}: ${foreground}/${background}=${ratio.toFixed(2)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('inverts the container relationship between light and dark', () => {
    // A palette shaped for light mode but applied in dark is what made hover
    // states unreadable, so the inversion is the invariant worth pinning.
    for (const brand of BRANDS) {
      const light = generateThemeColors(brand, 'light');
      const dark = generateThemeColors(brand, 'dark');
      expect(contrastRatio(light.primaryContainer, '#ffffff'))
        .toBeLessThan(contrastRatio(dark.primaryContainer, '#ffffff'));
      expect(contrastRatio(light.surface, '#ffffff'))
        .toBeLessThan(contrastRatio(dark.surface, '#ffffff'));
    }
  });

  it('uses the brand color verbatim when it is already legible', () => {
    expect(generateThemeColors('#604535', 'light').primary).toBe('#604535');
    expect(generateThemeColors('#245e9b', 'light').primary).toBe('#245e9b');
  });

  it('adjusts a brand color that would fail as text', () => {
    // #fd024e only reaches ~4.0:1 against a light surface, and --gc-primary is
    // the color of every link in the app.
    const primary = generateThemeColors('#fd024e', 'light').primary;
    expect(primary).not.toBe('#fd024e');
    expect(contrastRatio(primary, generateThemeColors('#fd024e', 'light').surface))
      .toBeGreaterThanOrEqual(4.5);
  });

  it('keeps status colors semantic rather than brand-tinted', () => {
    const green = generateThemeColors('#2e7d32', 'light');
    const pink = generateThemeColors('#fd024e', 'light');
    expect(green.error).toBe(pink.error);
    expect(green.success).toBe(pink.success);
  });

  it('validates hex input', () => {
    expect(isValidHexColor('#604535')).toBe(true);
    expect(isValidHexColor('604535')).toBe(false);
    expect(isValidHexColor('#60453')).toBe(false);
    expect(isValidHexColor('red')).toBe(false);
  });
});
