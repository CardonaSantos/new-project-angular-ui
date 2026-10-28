import { Injectable, signal } from '@angular/core';

/** UI-only branding. No persisted settings and no unrestricted URLs. */
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

  reset(): void {
    this.name.set('Gastro Core');
    this.logoUrl.set(null);
  }
}
