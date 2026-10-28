import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  DensityPreference,
  ResolvedMode,
  THEME_PRESETS,
  ThemeColors,
  ThemePreference,
  ThemePresetId,
} from './theme-presets';

const MATERIAL_TOKEN_MAP: Partial<Record<keyof ThemeColors, string>> = {
  primary: '--mat-sys-primary',
  onPrimary: '--mat-sys-on-primary',
  primaryContainer: '--mat-sys-primary-container',
  onPrimaryContainer: '--mat-sys-on-primary-container',
  surface: '--mat-sys-surface',
  surfaceContainer: '--mat-sys-surface-container',
  surfaceContainerLow: '--mat-sys-surface-container-low',
  onSurface: '--mat-sys-on-surface',
  onSurfaceVariant: '--mat-sys-on-surface-variant',
  outline: '--mat-sys-outline',
  outlineVariant: '--mat-sys-outline-variant',
  error: '--mat-sys-error',
  onError: '--mat-sys-on-error',
};

/** UI-only theme runtime: no localStorage, no database, no network side effects. */
@Injectable({ providedIn: 'root' })
export class ThemeManagerService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly systemQuery = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  private readonly systemIsDark = signal(this.systemQuery?.matches ?? false);

  readonly preset = signal<ThemePresetId>('cappuccino');
  readonly mode = signal<ThemePreference>('system');
  readonly density = signal<DensityPreference>('comfortable');
  readonly fontScale = signal(1);
  readonly cornerRadius = signal(14);
  readonly customPrimary = signal<string | null>(null);

  readonly resolvedMode = computed<ResolvedMode>(() =>
    this.mode() === 'system' ? (this.systemIsDark() ? 'dark' : 'light') : this.mode() as ResolvedMode,
  );
  readonly colors = computed(() => THEME_PRESETS[this.preset()][this.resolvedMode()]);

  private readonly handleSystemChange = (event: MediaQueryListEvent): void =>
    this.systemIsDark.set(event.matches);

  constructor() {
    this.systemQuery?.addEventListener('change', this.handleSystemChange);
    this.destroyRef.onDestroy(() =>
      this.systemQuery?.removeEventListener('change', this.handleSystemChange),
    );

    effect(() => {
      const root = this.document.documentElement;
      const colors = this.colors();
      const mode = this.resolvedMode();
      root.dataset['gcTheme'] = this.preset();
      root.dataset['gcMode'] = mode;
      root.dataset['gcDensity'] = this.density();
      root.style.colorScheme = mode;

      for (const [key, value] of Object.entries(colors)) {
        const cssName = key.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
        root.style.setProperty('--gc-' + cssName, value);
        const matName = MATERIAL_TOKEN_MAP[key as keyof ThemeColors];
        if (matName) root.style.setProperty(matName, value);
      }

      const accent = this.customPrimary();
      if (accent) {
        const onAccent = this.contrastText(accent);
        root.style.setProperty('--gc-primary', accent);
        root.style.setProperty('--gc-on-primary', onAccent);
        root.style.setProperty('--mat-sys-primary', accent);
        root.style.setProperty('--mat-sys-on-primary', onAccent);
      }

      root.style.setProperty('--gc-font-scale', String(this.fontScale()));
      root.style.setProperty('--gc-radius', this.cornerRadius() + 'px');
    });
  }

  setPreset(id: ThemePresetId): void {
    this.preset.set(id);
    this.customPrimary.set(null);
  }

  setMode(value: ThemePreference): void {
    this.mode.set(value);
  }

  setDensity(value: DensityPreference): void {
    this.density.set(value);
  }

  setFontScale(value: number): void {
    if (Number.isFinite(value)) this.fontScale.set(Math.max(1, Math.min(1.25, value)));
  }

  setCornerRadius(value: number): void {
    if (Number.isFinite(value)) this.cornerRadius.set(Math.round(Math.max(4, Math.min(24, value))));
  }

  setPrimaryHex(value: string): boolean {
    const trimmed = value.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) return false;
    this.customPrimary.set(trimmed.toLowerCase());
    return true;
  }

  reset(): void {
    this.preset.set('cappuccino');
    this.mode.set('system');
    this.density.set('comfortable');
    this.fontScale.set(1);
    this.cornerRadius.set(14);
    this.customPrimary.set(null);
  }

  private contrastText(color: string): string {
    const values = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16) / 255);
    const linear = values.map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    // Selects the better of white and near-black; threshold guarantees >=4.5:1.
    return luminance > 0.179 ? '#17120e' : '#ffffff';
  }
}
