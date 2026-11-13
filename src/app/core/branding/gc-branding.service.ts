import { Injectable, signal } from '@angular/core';

/**
 * The business's identity in the shell: trade name and logo.
 *
 * Colors deliberately do not live here. ThemeManagerService owns every color
 * token and writes them to :root; a second writer would mean whichever ran
 * last wins, and the theme manager re-applies all of its tokens whenever the
 * mode, density or radius changes — silently reverting a brand color set
 * from here. The brand color goes to `ThemeManagerService.setBrandColor`.
 */
@Injectable({ providedIn: 'root' })
export class GcBrandingService {
  readonly name = signal('Gastro Core');
  readonly logoUrl = signal<string | null>(null);

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

  reset(): void {
    this.name.set('Gastro Core');
    this.logoUrl.set(null);
  }
}
