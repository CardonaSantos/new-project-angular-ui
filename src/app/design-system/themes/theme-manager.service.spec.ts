import { TestBed } from '@angular/core/testing';
import { ThemeManagerService } from './theme-manager.service';

describe('ThemeManagerService', () => {
  it('starts with Cappuccino', () => {
    const theme = TestBed.inject(ThemeManagerService);
    expect(theme.preset()).toBe('cappuccino');
    expect(theme.mode()).toBe('system');
  });

  it('switches themes and can reset without storing data', () => {
    const theme = TestBed.inject(ThemeManagerService);
    theme.setMode('light');
    const color = theme.colors().primary;
    theme.setPreset('ocean');
    expect(theme.colors().primary).not.toBe(color);
    theme.reset();
    expect(theme.preset()).toBe('cappuccino');
  });

  it('validates accent colors and clamps font size', () => {
    const theme = TestBed.inject(ThemeManagerService);
    expect(theme.setPrimaryHex('red')).toBe(false);
    expect(theme.setPrimaryHex('#604535')).toBe(true);
    theme.setFontScale(99);
    expect(theme.fontScale()).toBe(1.25);
  });
});
