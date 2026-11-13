import { Injectable, signal } from '@angular/core';
import { deriveBrandPalette, isValidHexColor } from './color-derivation';

const THEME_PROPERTIES = [
  '--gc-primary',
  '--gc-on-primary',
  '--gc-primary-container',
  '--gc-on-primary-container',
] as const;

/** UI-only branding. No persisted settings and no unrestricted URLs. */
@Injectable({ providedIn: 'root' })
export class GcBrandingService {
  readonly name = signal('Gastro Core');
  readonly logoUrl = signal<string | null>(null);
  readonly colorPrimario = signal<string | null>(null);

  setName(name: string): void {
    const normalized = name.trim().slice(0, 60);
    if (normalized) this.name.set(normalized);
  }

  setLogo(url: string): boolean {
    const value = url.trim();
    // Only same-site assets or HTTPS resources are allowed.
    if (!value || (!value.startsWith('/') && !/^https:\/\/[^\s]+$/i.test(value)) ||
        value.startsWith('//') || /[\s<>]/.test(value)) return false;
    this.logoUrl.set(value);
    return true;
  }

  clearLogo(): void {
    this.logoUrl.set(null);
  }

  /**
   * Sets the brand's primary color and derives the matching on-color and
   * container tokens, applying all four as inline overrides on `:root` so
   * every component reading `--gc-primary` etc. picks them up live.
   */
  setColor(hex: string | null | undefined): boolean {
    if (!hex) {
      this.clearColor();
      return true;
    }
    const value = hex.trim();
    if (!isValidHexColor(value)) return false;
    const palette = deriveBrandPalette(value);
    this.colorPrimario.set(palette.primary);
    this.applyTheme(palette);
    return true;
  }

  private clearColor(): void {
    this.colorPrimario.set(null);
    if (typeof document === 'undefined') return;
    for (const prop of THEME_PROPERTIES) {
      document.documentElement.style.removeProperty(prop);
    }
  }

  private applyTheme(palette: {
    primary: string;
    onPrimary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
  }): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement.style;
    root.setProperty('--gc-primary', palette.primary);
    root.setProperty('--gc-on-primary', palette.onPrimary);
    root.setProperty('--gc-primary-container', palette.primaryContainer);
    root.setProperty('--gc-on-primary-container', palette.onPrimaryContainer);
  }

  reset(): void {
    this.name.set('Gastro Core');
    this.logoUrl.set(null);
    this.clearColor();
  }
}
