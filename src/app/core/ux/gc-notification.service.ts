import { Injectable, signal } from '@angular/core';

export type GcNoticeTone = 'success' | 'info' | 'warning' | 'error';
export interface GcNotice { id: number; tone: GcNoticeTone; message: string }

/** In-memory notice queue with bounded length and auto-dismiss for non-errors. */
@Injectable({ providedIn: 'root' })
export class GcNotificationService {
  private sequence = 0;
  private recent = { key: '', at: 0, id: 0 };
  private readonly internal = signal<readonly GcNotice[]>([]);
  readonly notices = this.internal.asReadonly();

  show(message: string, tone: GcNoticeTone = 'info', durationMs = 4000): number {
    const key = tone + ':' + message.trim();
    const now = Date.now();
    if (key === this.recent.key && now - this.recent.at < 2500 &&
        this.internal().some(notice => notice.id === this.recent.id)) return this.recent.id;
    const id = ++this.sequence;
    this.recent = { key, at: now, id };
    const item: GcNotice = { id, tone, message: message.trim().slice(0, 300) };
    this.internal.update((current) => [...current.slice(-3), item]);
    if (durationMs > 0 && tone !== 'error') {
      setTimeout(() => this.dismiss(id), Math.min(durationMs, 30000));
    }
    return id;
  }

  dismiss(id: number): void {
    this.internal.update((current) => current.filter((item) => item.id !== id));
  }

  clear(): void { this.internal.set([]); }
}
