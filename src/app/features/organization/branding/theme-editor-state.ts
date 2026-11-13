import { computed, signal } from '@angular/core';
import {
  THEME_CONTRAST_PAIRS,
  THEME_PRESETS,
  type ResolvedMode,
  type ThemeColors,
  type ThemeDocument,
  type ThemePresetId,
} from '../../../design-system/themes/theme-presets';
import {
  contrastRatio,
  generateThemeColors,
  isValidHexColor,
} from '../../../design-system/themes/theme-palette';

export interface ContrastReport {
  foreground: keyof ThemeColors;
  background: keyof ThemeColors;
  ratio: number;
  passes: boolean;
}

/** WCAG AA for body text. Reported, never enforced — the palette is hand-made. */
const AA = 4.5;

/**
 * Draft state for the theme editor, kept out of the page component so the
 * editing rules stay testable on their own.
 *
 * The draft is always a complete document for both modes: the API refuses a
 * partial palette, and a half-filled form would otherwise look saveable.
 */
export class ThemeEditorState {
  readonly mode = signal<ResolvedMode>('light');
  private readonly draft = signal<ThemeDocument | null>(null);
  /** The document as last saved, to tell whether anything actually changed. */
  private readonly baseline = signal<ThemeDocument | null>(null);

  readonly current = computed(() => this.draft());
  readonly colors = computed<ThemeColors | null>(() => this.draft()?.[this.mode()] ?? null);
  readonly enabled = computed(() => this.draft() !== null);
  readonly dirty = computed(() =>
    JSON.stringify(this.draft()) !== JSON.stringify(this.baseline()),
  );

  /** Contrast for every pair that meets on screen, in the mode being edited. */
  readonly contrast = computed<ContrastReport[]>(() => {
    const colors = this.colors();
    if (!colors) return [];
    return THEME_CONTRAST_PAIRS.map(([foreground, background]) => {
      const ratio = contrastRatio(colors[foreground], colors[background]);
      return { foreground, background, ratio, passes: ratio >= AA };
    });
  });
  readonly failing = computed(() => this.contrast().filter(entry => !entry.passes));

  /** Loads what the server has; null means the business has no custom theme. */
  load(document: ThemeDocument | null): void {
    this.draft.set(document ? structuredClone(document) : null);
    this.baseline.set(document ? structuredClone(document) : null);
  }

  /** Marks the current draft as saved, after the server accepted it. */
  commit(document: ThemeDocument | null): void {
    this.baseline.set(document ? structuredClone(document) : null);
    this.draft.set(document ? structuredClone(document) : null);
  }

  /**
   * Fills every field from a preset so editing starts from a working palette
   * instead of 38 blank inputs. Nothing is derived once saved — this only
   * seeds the form.
   */
  fillFromPreset(preset: ThemePresetId): void {
    const source = THEME_PRESETS[preset];
    this.draft.set({ light: { ...source.light }, dark: { ...source.dark } });
  }

  /** Same idea, seeding both modes from one color. */
  fillFromColor(hex: string): boolean {
    if (!isValidHexColor(hex)) return false;
    this.draft.set({
      light: generateThemeColors(hex, 'light'),
      dark: generateThemeColors(hex, 'dark'),
    });
    return true;
  }

  /** Copies the mode being edited over the other one, as a starting point. */
  copyToOtherMode(): void {
    const document = this.draft();
    if (!document) return;
    const from = this.mode();
    const to: ResolvedMode = from === 'light' ? 'dark' : 'light';
    this.draft.set({ ...document, [to]: { ...document[from] } } as ThemeDocument);
  }

  setColor(token: keyof ThemeColors, value: string): void {
    const document = this.draft();
    if (!document || !isValidHexColor(value)) return;
    const mode = this.mode();
    this.draft.set({
      ...document,
      [mode]: { ...document[mode], [token]: value.trim().toLowerCase() },
    } as ThemeDocument);
  }

  /** Drops the custom theme, returning the business to the built-in palette. */
  clear(): void {
    this.draft.set(null);
  }
}
