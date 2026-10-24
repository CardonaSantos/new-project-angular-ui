import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type Theme = 'system' | 'light' | 'dark';
export type Density = 'comfortable' | 'compact';

@Injectable({ providedIn: 'root' })
export class AppearancePreferences {
  private readonly document = inject(DOCUMENT);
  readonly theme = signal<Theme>('system');
  readonly density = signal<Density>('comfortable');
  readonly fontScale = signal(1);

  constructor() {
    effect(() => {
      const root = this.document.documentElement;
      root.dataset['theme'] = this.theme();
      root.dataset['density'] = this.density();
      root.style.setProperty('--gc-font-scale', String(this.fontScale()));
    });
  }
}
