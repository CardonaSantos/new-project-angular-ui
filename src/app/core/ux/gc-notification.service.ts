import { Injectable, signal } from '@angular/core';

export type GcNoticeTone = 'success' | 'info' | 'warning' | 'error';
/** Optional call-to-action rendered as a routerLink inside the toast (e.g. "Cobrar" on a
 * "pedido listo" notice, linking straight to that order's detail/payment page). */
export interface GcNoticeLink { label: string; path: readonly (string | number)[] }
export interface GcNotice { id: number; tone: GcNoticeTone; message: string; link?: GcNoticeLink }

/** In-memory notice queue with bounded length and auto-dismiss for every tone. */
@Injectable({ providedIn: 'root' })
export class GcNotificationService {
  /** Error toasts stay up long enough to read, but must not get stuck forever. */
  private static readonly ERROR_DURATION_MS = 10000;
  private sequence = 0;
  private recent = { key: '', at: 0, id: 0 };
  private readonly internal = signal<readonly GcNotice[]>([]);
  readonly notices = this.internal.asReadonly();

  show(message: string, tone: GcNoticeTone = 'info', durationMs = 4000, link?: GcNoticeLink): number {
    const key = tone + ':' + message.trim();
    const now = Date.now();
    if (key === this.recent.key && now - this.recent.at < 2500 &&
        this.internal().some(notice => notice.id === this.recent.id)) return this.recent.id;
    const id = ++this.sequence;
    this.recent = { key, at: now, id };
    const item: GcNotice = { id, tone, message: message.trim().slice(0, 300), ...(link ? { link } : {}) };
    this.internal.update((current) => [...current.slice(-3), item]);
    // Callers sometimes pass durationMs:0 for an error expecting it to persist until the user
    // dismisses it manually; that stuck-forever behavior is exactly what the X button is for, and
    // errors still need their own auto-dismiss so they don't pile up unread. Always give error
    // toasts a fixed, longer window instead of trusting a per-call duration for that tone.
    const effectiveDuration = tone === 'error' ? GcNotificationService.ERROR_DURATION_MS : durationMs;
    if (effectiveDuration > 0) {
      setTimeout(() => this.dismiss(id), Math.min(effectiveDuration, 30000));
    }
    return id;
  }

  dismiss(id: number): void {
    this.internal.update((current) => current.filter((item) => item.id !== id));
  }

  clear(): void { this.internal.set([]); }
}
