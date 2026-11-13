import { Injectable, signal } from '@angular/core';
import type { SelfServiceAccess } from './self-service.models';

const STORAGE_KEY = 'gc-self-service-session';

interface StoredSession extends SelfServiceAccess { qrToken: string; }

/** One active table session per browser tab, held in sessionStorage — never
 * localStorage, so the next customer on a shared tablet doesn't inherit it
 * once the browser tab/app is closed. Keyed by the QR token in the URL, so a
 * stale session from a different table never gets reused by mistake. */
@Injectable({ providedIn: 'root' })
export class SelfServiceSessionStore {
  readonly access = signal<SelfServiceAccess | null>(null);

  restore(qrToken: string): SelfServiceAccess | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const stored = JSON.parse(raw) as StoredSession;
      if (stored.qrToken !== qrToken) return null;
      if (new Date(stored.expiraEn).getTime() <= Date.now()) { this.clear(); return null; }
      this.access.set(stored);
      return stored;
    } catch { return null; }
  }

  save(qrToken: string, value: SelfServiceAccess): void {
    this.access.set(value);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...value, qrToken } satisfies StoredSession));
  }

  clear(): void {
    this.access.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }
}
