/** Semantic tokens: components must never depend on a specific preset or raw hex. */
export interface ThemeColors {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  /** Background painted under the pointer, with its own readable text color. */
  hover: string;
  onHover: string;
  surface: string;
  surfaceContainer: string;
  surfaceContainerLow: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  success: string;
  onSuccess: string;
  warning: string;
  onWarning: string;
  error: string;
  onError: string;
}

/**
 * Token order for the hand-editing UI, grouped the way someone thinks about a
 * screen rather than alphabetically. Mirrors THEME_TOKENS in the API's
 * organization/domain/theme.ts, which validates what gets stored.
 */
export const THEME_TOKEN_GROUPS = [
  { label: 'Fondos', tokens: ['surface', 'surfaceContainerLow', 'surfaceContainer'] },
  { label: 'Texto', tokens: ['onSurface', 'onSurfaceVariant'] },
  { label: 'Marca y botones', tokens: ['primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer'] },
  { label: 'Hover', tokens: ['hover', 'onHover'] },
  { label: 'Bordes', tokens: ['outline', 'outlineVariant'] },
  { label: 'Estados', tokens: ['success', 'onSuccess', 'warning', 'onWarning', 'error', 'onError'] },
] as const satisfies readonly { label: string; tokens: readonly (keyof ThemeColors)[] }[];

/** Human labels for each token, so the editor doesn't show camelCase keys. */
export const THEME_TOKEN_LABELS: Record<keyof ThemeColors, string> = {
  primary: 'Color de marca',
  onPrimary: 'Texto sobre el color de marca',
  primaryContainer: 'Fondo suave de marca',
  onPrimaryContainer: 'Texto sobre el fondo suave',
  hover: 'Fondo al pasar el mouse',
  onHover: 'Texto al pasar el mouse',
  surface: 'Fondo general',
  surfaceContainerLow: 'Fondo de tarjetas',
  surfaceContainer: 'Fondo de secciones',
  onSurface: 'Texto principal',
  onSurfaceVariant: 'Texto secundario',
  outline: 'Bordes',
  outlineVariant: 'Bordes suaves',
  success: 'Éxito',
  onSuccess: 'Texto sobre éxito',
  warning: 'Advertencia',
  onWarning: 'Texto sobre advertencia',
  error: 'Error',
  onError: 'Texto sobre error',
};

/** Pairs that end up on top of each other, used to report contrast. */
export const THEME_CONTRAST_PAIRS: readonly [keyof ThemeColors, keyof ThemeColors][] = [
  ['onSurface', 'surface'],
  ['onSurfaceVariant', 'surface'],
  ['onSurface', 'surfaceContainer'],
  ['onSurfaceVariant', 'surfaceContainer'],
  ['onSurface', 'surfaceContainerLow'],
  ['primary', 'surface'],
  ['primary', 'surfaceContainer'],
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onHover', 'hover'],
  ['onSuccess', 'success'],
  ['onWarning', 'warning'],
  ['onError', 'error'],
];

export type ThemePresetId = 'cappuccino' | 'ocean';
export type ResolvedMode = 'light' | 'dark';
/** A full hand-edited palette for both modes, as stored by the API. */
export type ThemeDocument = Record<ResolvedMode, ThemeColors>;
export type ThemePreference = ResolvedMode | 'system';
export type DensityPreference = 'comfortable' | 'compact';

export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  light: ThemeColors;
  dark: ThemeColors;
}

/** Static, curated presets. Contrast pairs are intentional; custom colors are validated separately. */
export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  cappuccino: {
    id: 'cappuccino',
    label: 'Cappuccino',
    light: {
      primary: '#604535',
      onPrimary: '#ffffff',
      primaryContainer: '#ead9c4',
      onPrimaryContainer: '#332317',
      hover: '#ead9c4',
      onHover: '#332317',
      surface: '#faf7f2',
      surfaceContainer: '#f0e8dc',
      surfaceContainerLow: '#f6f0e8',
      onSurface: '#302820',
      onSurfaceVariant: '#5f5348',
      outline: '#85766a',
      outlineVariant: '#d7c9ba',
      success: '#246747',
      onSuccess: '#ffffff',
      warning: '#8b5300',
      onWarning: '#ffffff',
      error: '#a52d32',
      onError: '#ffffff',
    },
    dark: {
      primary: '#e1bfa4',
      onPrimary: '#352418',
      primaryContainer: '#644634',
      onPrimaryContainer: '#fff0e1',
      hover: '#644634',
      onHover: '#fff0e1',
      surface: '#191512',
      surfaceContainer: '#302822',
      surfaceContainerLow: '#241e1a',
      onSurface: '#f3e8dc',
      onSurfaceVariant: '#d5c4b3',
      outline: '#af9b8b',
      outlineVariant: '#594a3e',
      success: '#a6dbba',
      onSuccess: '#103923',
      warning: '#f2c378',
      onWarning: '#482900',
      error: '#ffb4ab',
      onError: '#690005',
    },
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean',
    light: {
      primary: '#245e9b',
      onPrimary: '#ffffff',
      primaryContainer: '#d8e9fd',
      onPrimaryContainer: '#183958',
      hover: '#d8e9fd',
      onHover: '#183958',
      surface: '#f7faff',
      surfaceContainer: '#e6eef7',
      surfaceContainerLow: '#eef4fc',
      onSurface: '#1d2d3c',
      onSurfaceVariant: '#4c6072',
      outline: '#6d8296',
      outlineVariant: '#bdcddd',
      success: '#246747',
      onSuccess: '#ffffff',
      warning: '#8b5300',
      onWarning: '#ffffff',
      error: '#a52d32',
      onError: '#ffffff',
    },
    dark: {
      primary: '#a9ccfa',
      onPrimary: '#123958',
      primaryContainer: '#254f77',
      onPrimaryContainer: '#e3f1ff',
      hover: '#254f77',
      onHover: '#e3f1ff',
      surface: '#141c25',
      surfaceContainer: '#263543',
      surfaceContainerLow: '#1d2935',
      onSurface: '#e8f0f8',
      onSurfaceVariant: '#bfcede',
      outline: '#9ab0c4',
      outlineVariant: '#43586b',
      success: '#a6dbba',
      onSuccess: '#103923',
      warning: '#f2c378',
      onWarning: '#482900',
      error: '#ffb4ab',
      onError: '#690005',
    },
  },
};
