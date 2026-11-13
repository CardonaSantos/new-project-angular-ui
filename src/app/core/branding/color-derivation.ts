/**
 * Derives a small Material-3-style color group from a single brand color.
 *
 * The app's design tokens (see styles.scss `:root`) already follow the M3
 * "primary / on-primary / primary-container / on-primary-container" shape.
 * Rather than ask the business owner to pick all four, we ask for one brand
 * color and compute the other three so they stay readable:
 *  - onPrimary: text/icons placed directly on the brand color.
 *  - primaryContainer: a soft, low-emphasis tint of the brand color, used
 *    for badges/chips/filled-light surfaces.
 *  - onPrimaryContainer: text/icons placed on that container.
 *
 * This is a light approximation of Material 3's tonal-palette generation
 * (HSL-based, not LCH/CAM16), which is enough for a single accent color and
 * avoids pulling in a color-science dependency for one settings field.
 */

export interface BrandPalette {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

const HEX_RE = /^#([0-9a-f]{6})$/i;

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const match = HEX_RE.exec(hex.trim());
  if (!match) throw new Error('Color hex inválido, use #RRGGBB');
  const n = parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l };
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  switch (max) {
    case rn:
      h = ((gn - bn) / delta) % 6;
      break;
    case gn:
      h = (bn - rn) / delta + 2;
      break;
    default:
      h = (rn - gn) / delta + 4;
  }
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}

function hslToRgb({ h, s, l }: Hsl): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r1, g1, b1] = [0, 0, 0];
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

/** WCAG relative luminance, used only to pick a readable on-color. */
function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function deriveBrandPalette(hex: string): BrandPalette {
  const primary = hexToRgb(hex);
  const primaryHex = rgbToHex(primary.r, primary.g, primary.b);
  const primaryHsl = rgbToHsl(primary.r, primary.g, primary.b);
  const primaryLuminance = relativeLuminance(primary);

  // onPrimary: choose white vs. a hue-tinted near-black, whichever reads
  // better against the brand color.
  const white = { r: 255, g: 255, b: 255 };
  const nearBlack = hslToRgb({ h: primaryHsl.h, s: Math.min(primaryHsl.s, 0.35), l: 0.12 });
  const contrastWithWhite = contrastRatio(primaryLuminance, relativeLuminance(white));
  const contrastWithBlack = contrastRatio(primaryLuminance, relativeLuminance(nearBlack));
  const onPrimary =
    contrastWithWhite >= contrastWithBlack
      ? '#FFFFFF'
      : rgbToHex(nearBlack.r, nearBlack.g, nearBlack.b);

  // primaryContainer: a soft tint of the brand color (same hue, muted
  // saturation, high lightness) — keeps the container clearly lighter than
  // the brand color even when the brand color itself is already pale.
  const containerLightness = clamp(primaryHsl.l + 0.35, 0.88, 0.95);
  const containerSaturation = clamp(primaryHsl.s * 0.6, 0, 0.45);
  const container = hslToRgb({
    h: primaryHsl.h,
    s: containerSaturation,
    l: containerLightness,
  });
  const primaryContainer = rgbToHex(container.r, container.g, container.b);

  // onPrimaryContainer: a dark, readable tint for text/icons on that
  // container, kept well below the container's lightness.
  const onContainer = hslToRgb({
    h: primaryHsl.h,
    s: clamp(primaryHsl.s * 0.7, 0, 0.5),
    l: clamp(containerLightness - 0.68, 0.14, 0.24),
  });
  const onPrimaryContainer = rgbToHex(onContainer.r, onContainer.g, onContainer.b);

  return { primary: primaryHex, onPrimary, primaryContainer, onPrimaryContainer };
}
