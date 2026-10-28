/** Semantic tokens: components must never depend on a specific preset or raw hex. */
export interface ThemeColors {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
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

export type ThemePresetId = 'cappuccino' | 'ocean';
export type ResolvedMode = 'light' | 'dark';
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
