/**
 * Builds a full semantic palette (light and dark) from a single brand color.
 *
 * Why OKLCH and tonal ramps: the token set in theme-presets.ts is shaped like
 * Material 3 — each surface has a matching "on" color, and the relationship
 * inverts between modes (in light, primaryContainer is pale and its on-color
 * dark; in dark it's the other way around). Deriving that from HSL fails,
 * because HSL "lightness" is not perceptual: #FFFF00 and #0000FF both sit at
 * L=50% while differing wildly in apparent brightness, so a fixed HSL target
 * yields inconsistent contrast per hue. OKLab/OKLCH lightness is perceptually
 * uniform, so one tone number means the same apparent lightness for any hue.
 *
 * Tones follow M3's assignments (light: primary=40, container=90; dark:
 * primary=80, container=30). Surfaces come from a near-neutral ramp on the
 * brand hue, which is what gives a themed app its subtle warm/cool cast
 * instead of flat grey. Status colors (success/warning/error) are NOT derived
 * from the brand: an error has to read as an error even in a red-branded app.
 *
 * Generated pairs are finally checked against real WCAG contrast ratios and
 * nudged until they pass, rather than trusting the tone math to imply it.
 */

import type { ResolvedMode, ThemeColors } from './theme-presets';

interface Oklch {
  l: number;
  c: number;
  h: number;
}
interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_RE = /^#([0-9a-f]{6})$/i;
/** Minimum body-text contrast (WCAG AA). */
const AA_CONTRAST = 4.5;

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

function hexToRgb(hex: string): Rgb {
  const match = HEX_RE.exec(hex.trim());
  if (!match) throw new Error('Color hex inválido, use #RRGGBB');
  const n = parseInt(match[1], 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

const toLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const toGamma = (c: number): number =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

/** sRGB -> OKLab -> OKLCH (Björn Ottosson's matrices). */
function rgbToOklch(rgb: Rgb): Oklch {
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const labL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const labA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const labB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return {
    l: labL,
    c: Math.sqrt(labA * labA + labB * labB),
    h: Math.atan2(labB, labA),
  };
}

function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const labA = c * Math.cos(h);
  const labB = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * labA + 0.2158037573 * labB) ** 3;
  const m_ = (l - 0.1055613458 * labA - 0.0638541728 * labB) ** 3;
  const s_ = (l - 0.0894841775 * labA - 1.291485548 * labB) ** 3;
  return {
    r: toGamma(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    g: toGamma(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    b: toGamma(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  };
}

const inGamut = ({ r, g, b }: Rgb): boolean =>
  r >= -0.001 && r <= 1.001 && g >= -0.001 && g <= 1.001 && b >= -0.001 && b <= 1.001;

/**
 * Converts an M3 tone (which is CIE L*) to OKLab's lightness, by way of the
 * grey carrying that luminance. Treating a tone as OKLab L directly looks
 * right but is not: the two scales diverge badly at the dark end, which turns
 * "tone 6" into near-black instead of a usable dark surface.
 */
function toneToLightness(tone: number): number {
  const t = Math.max(0, Math.min(100, tone));
  const y = t > 8 ? Math.pow((t + 16) / 116, 3) : t / 903.2962962;
  const grey = toGamma(y);
  return rgbToOklch({ r: grey, g: grey, b: grey }).l;
}

/**
 * Renders a tone as hex, reducing chroma until it fits in sRGB. Clipping the
 * channels instead would shift the hue, which is what makes naive conversions
 * drift (a saturated blue turning purple as it lightens).
 */
function toneToHex(lightness: number, chroma: number, hue: number): string {
  let low = 0;
  let high = chroma;
  let best = { l: lightness, c: 0, h: hue };
  for (let i = 0; i < 24 && high - low > 0.0005; i++) {
    const mid = (low + high) / 2;
    const candidate = { l: lightness, c: mid, h: hue };
    if (inGamut(oklchToRgb(candidate))) {
      best = candidate;
      low = mid;
    } else {
      high = mid;
    }
  }
  if (inGamut(oklchToRgb({ l: lightness, c: chroma, h: hue })))
    best = { l: lightness, c: chroma, h: hue };
  const rgb = oklchToRgb(best);
  return rgbToHex({
    r: Math.max(0, Math.min(1, rgb.r)),
    g: Math.max(0, Math.min(1, rgb.g)),
    b: Math.max(0, Math.min(1, rgb.b)),
  });
}

/** WCAG relative luminance from a hex string. */
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Walks the foreground tone away from the background until the pair clears
 * `target`, so a guarantee replaces an assumption. Direction is chosen by
 * which end has more headroom.
 */
function ensureContrast(
  foreground: string,
  background: string,
  chroma: number,
  hue: number,
  startTone: number,
  target = AA_CONTRAST,
): string {
  if (contrastRatio(foreground, background) >= target) return foreground;
  const towardsLight = luminance(background) < 0.18;
  for (let step = 1; step <= 20; step++) {
    const tone = towardsLight
      ? Math.min(100, startTone + step * 5)
      : Math.max(0, startTone - step * 5);
    const candidate = toneToHex(toneToLightness(tone), chroma, hue);
    if (contrastRatio(candidate, background) >= target) return candidate;
    if (tone === 0 || tone === 100) break;
  }
  // Last resort: plain white or black always clears AA against a mid surface.
  const white = '#ffffff';
  const black = '#000000';
  return contrastRatio(white, background) >= contrastRatio(black, background) ? white : black;
}

/** Status colors stay semantic; only their mode-appropriate pair changes. */
const STATUS: Record<ResolvedMode, Pick<ThemeColors,
  'success' | 'onSuccess' | 'warning' | 'onWarning' | 'error' | 'onError'>> = {
  light: {
    success: '#246747',
    onSuccess: '#ffffff',
    warning: '#8b5300',
    onWarning: '#ffffff',
    error: '#a52d32',
    onError: '#ffffff',
  },
  dark: {
    success: '#a6dbba',
    onSuccess: '#103923',
    warning: '#f2c378',
    onWarning: '#482900',
    error: '#ffb4ab',
    onError: '#690005',
  },
};

export function generateThemeColors(brandHex: string, mode: ResolvedMode): ThemeColors {
  const brand = rgbToOklch(hexToRgb(brandHex));
  const hue = brand.h;
  // A brand color picked as a flat grey would otherwise produce a palette with
  // no identity at all; keep a floor so surfaces still read as tinted.
  const brandChroma = Math.max(0.04, Math.min(brand.c, 0.19));
  const neutral = 0.008;
  const neutralVariant = 0.022;

  const tone = (t: number, chroma: number) => toneToHex(toneToLightness(t), chroma, hue);
  const brandTone = (t: number) => tone(t, brandChroma);
  const neutralTone = (t: number) => tone(t, neutral);
  const variantTone = (t: number) => tone(t, neutralVariant);

  const light = mode === 'light';
  const surface = light ? neutralTone(98) : neutralTone(6);
  const surfaceContainerLow = light ? neutralTone(96) : neutralTone(10);
  const surfaceContainer = light ? neutralTone(93) : neutralTone(14);

  // --gc-primary is both a fill and a text color in this codebase (every link
  // uses it), so it has to clear AA against the surfaces too — not just pair
  // with on-primary. Keep the brand color itself when it already does, since
  // that is the whole point of a brand color; fall back to the tone M3 picks
  // for this mode when it doesn't.
  const literalBrand = brandHex.trim().toLowerCase();
  const readableAsText =
    contrastRatio(literalBrand, surface) >= AA_CONTRAST &&
    contrastRatio(literalBrand, surfaceContainer) >= AA_CONTRAST;
  const primary = readableAsText ? literalBrand : brandTone(light ? 40 : 80);
  const primaryContainer = light ? brandTone(90) : brandTone(30);

  if (light) {
    return {
      primary,
      onPrimary: ensureContrast(brandTone(100), primary, brandChroma, hue, 100),
      primaryContainer,
      onPrimaryContainer: ensureContrast(brandTone(10), primaryContainer, brandChroma, hue, 10),
      // Hover starts out matching the container pair, which is what the
      // curated presets do; businesses retune it from the appearance page.
      hover: primaryContainer,
      onHover: ensureContrast(brandTone(10), primaryContainer, brandChroma, hue, 10),
      surface,
      surfaceContainer,
      surfaceContainerLow,
      onSurface: ensureContrast(neutralTone(10), surface, neutral, hue, 10),
      // Checked against the darkest surface it can land on, so muted text stays
      // legible inside cards and hover states, not just on the page background.
      onSurfaceVariant: ensureContrast(variantTone(30), surfaceContainer, neutralVariant, hue, 30),
      outline: variantTone(50),
      outlineVariant: variantTone(80),
      ...STATUS.light,
    };
  }

  return {
    primary,
    onPrimary: ensureContrast(brandTone(20), primary, brandChroma, hue, 20),
    primaryContainer,
    onPrimaryContainer: ensureContrast(brandTone(90), primaryContainer, brandChroma, hue, 90),
    hover: primaryContainer,
    onHover: ensureContrast(brandTone(90), primaryContainer, brandChroma, hue, 90),
    surface,
    surfaceContainer,
    surfaceContainerLow,
    onSurface: ensureContrast(neutralTone(90), surface, neutral, hue, 90),
    onSurfaceVariant: ensureContrast(variantTone(80), surfaceContainer, neutralVariant, hue, 80),
    outline: variantTone(60),
    outlineVariant: variantTone(30),
    ...STATUS.dark,
  };
}
