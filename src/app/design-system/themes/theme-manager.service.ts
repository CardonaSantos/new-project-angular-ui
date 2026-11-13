import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  DensityPreference,
  ResolvedMode,
  THEME_PRESETS,
  ThemeColors,
  ThemeDocument,
  ThemePreference,
  ThemePresetId,
} from './theme-presets';
import { generateThemeColors, isValidHexColor } from './theme-palette';

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

interface StoredPreferences {
  mode?: ThemePreference;
  density?: DensityPreference;
  fontScale?: number;
  cornerRadius?: number;
  preset?: ThemePresetId;
}

/**
 * Owns every color token and writes them to :root — the single writer, so
 * nothing else should set --gc-* colors.
 *
 * Split of responsibilities: the brand color and logo belong to the business
 * and come from the server, while mode, density, font scale and radius are
 * personal and are kept per user in localStorage (a shared POS terminal has
 * several users, and dark mode is a per-person choice). Nothing sensitive is
 * ever stored here.
 */
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
  /** The business's saved brand color (from the server), if it has one. */
  readonly brandColor = signal<string | null>(null);
  /** A hand-edited palette for both modes, which outranks everything else. */
  readonly brandTheme = signal<ThemeDocument | null>(null);
  /** Forces a mode regardless of preference, for the customer-facing QR menu. */
  private readonly lockedMode = signal<ResolvedMode | null>(null);
  /**
   * Who the stored preferences belong to. The caller supplies it rather than
   * this service reading the session, keeping the design system free of auth
   * dependencies.
   */
  private readonly scope = signal('anon');
  private readonly loadedFor = signal('');

  readonly resolvedMode = computed<ResolvedMode>(() => {
    const locked = this.lockedMode();
    if (locked) return locked;
    return this.mode() === 'system'
      ? (this.systemIsDark() ? 'dark' : 'light')
      : this.mode() as ResolvedMode;
  });
  /**
   * An unsaved local accent wins over the saved one so the appearance page can
   * preview live.
   */
  readonly accent = computed(() => this.customPrimary() ?? this.brandColor());
  /**
   * Precedence, strongest first: a hand-edited theme is used verbatim — the
   * whole point of editing it by hand — then a brand color seeds a generated
   * palette, and otherwise the built-in preset applies.
   */
  readonly colors = computed<ThemeColors>(() => {
    const mode = this.resolvedMode();
    const manual = this.brandTheme();
    if (manual) return manual[mode];
    const accent = this.accent();
    return accent
      ? generateThemeColors(accent, mode)
      : THEME_PRESETS[this.preset()][mode];
  });

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

      root.style.setProperty('--gc-font-scale', String(this.fontScale()));
      root.style.setProperty('--gc-radius', this.cornerRadius() + 'px');
    });
  }

  setPreset(id: ThemePresetId): void {
    this.preset.set(id);
    this.customPrimary.set(null);
    this.savePreferences();
  }

  setMode(value: ThemePreference): void {
    this.mode.set(value);
    this.savePreferences();
  }

  setDensity(value: DensityPreference): void {
    this.density.set(value);
    this.savePreferences();
  }

  setFontScale(value: number): void {
    if (!Number.isFinite(value)) return;
    this.fontScale.set(Math.max(1, Math.min(1.25, value)));
    this.savePreferences();
  }

  setCornerRadius(value: number): void {
    if (!Number.isFinite(value)) return;
    this.cornerRadius.set(Math.round(Math.max(4, Math.min(24, value))));
    this.savePreferences();
  }

  /**
   * Restores this user's saved appearance. Called on login; re-running it for
   * the same user is a no-op so it can be wired to an effect safely.
   */
  loadPreferences(userId: string): void {
    const scope = userId.trim() || 'anon';
    if (this.loadedFor() === scope) return;
    this.scope.set(scope);
    this.loadedFor.set(scope);
    this.applyDefaults();
    let saved: string | null = null;
    try {
      saved = this.document.defaultView?.localStorage?.getItem(this.key()) ?? null;
    } catch {
      return; // Storage disabled; defaults are already in place.
    }
    if (!saved) return;
    try {
      const values = JSON.parse(saved) as StoredPreferences;
      if (values.mode === 'light' || values.mode === 'dark' || values.mode === 'system')
        this.mode.set(values.mode);
      if (values.density === 'comfortable' || values.density === 'compact')
        this.density.set(values.density);
      if (values.preset && Object.hasOwn(THEME_PRESETS, values.preset))
        this.preset.set(values.preset);
      if (Number.isFinite(values.fontScale))
        this.fontScale.set(Math.max(1, Math.min(1.25, Number(values.fontScale))));
      if (Number.isFinite(values.cornerRadius))
        this.cornerRadius.set(Math.round(Math.max(4, Math.min(24, Number(values.cornerRadius)))));
    } catch {
      /* Corrupted entry; the defaults above still stand. */
    }
  }

  /** Drops the in-memory preferences on logout without erasing what's stored. */
  forgetPreferences(): void {
    this.loadedFor.set('');
    this.scope.set('anon');
    this.applyDefaults();
  }

  private applyDefaults(): void {
    this.preset.set('cappuccino');
    this.mode.set('system');
    this.density.set('comfortable');
    this.fontScale.set(1);
    this.cornerRadius.set(14);
    this.customPrimary.set(null);
  }

  private key(): string {
    return 'gc:appearance:v1:' + this.scope();
  }

  private savePreferences(): void {
    // Before load() runs there is nothing meaningful to persist, and writing
    // would overwrite the stored entry with defaults.
    if (this.loadedFor() !== this.scope()) return;
    try {
      this.document.defaultView?.localStorage?.setItem(
        this.key(),
        JSON.stringify({
          mode: this.mode(),
          density: this.density(),
          fontScale: this.fontScale(),
          cornerRadius: this.cornerRadius(),
          preset: this.preset(),
        } satisfies StoredPreferences),
      );
    } catch {
      /* No browser storage permissions; the session still works. */
    }
  }

  /** Local, unsaved accent — used by the appearance page to preview a color. */
  setPrimaryHex(value: string): boolean {
    const trimmed = value.trim();
    if (!isValidHexColor(trimmed)) return false;
    this.customPrimary.set(trimmed.toLowerCase());
    return true;
  }

  clearPrimaryHex(): void {
    this.customPrimary.set(null);
  }

  /**
   * The brand color stored for the business. Null restores the preset, which
   * is what "restablecer al predeterminado" means.
   */
  /** The business's hand-edited palette, applied exactly as given. */
  setBrandTheme(value: ThemeDocument | null | undefined): void {
    this.brandTheme.set(value ?? null);
  }

  /**
   * Pins the mode for surfaces that must look the same to everyone, such as
   * the QR menu a diner opens on a phone that may be in dark mode. Not
   * persisted: it describes the screen, not the person.
   */
  lockMode(mode: ResolvedMode | null): void {
    this.lockedMode.set(mode);
  }

  setBrandColor(value: string | null | undefined): boolean {
    if (!value) {
      this.brandColor.set(null);
      return true;
    }
    const trimmed = value.trim();
    if (!isValidHexColor(trimmed)) return false;
    this.brandColor.set(trimmed.toLowerCase());
    return true;
  }

  /** Resets personal preferences only; the business's brand color stays. */
  reset(): void {
    this.applyDefaults();
    this.savePreferences();
  }
}
