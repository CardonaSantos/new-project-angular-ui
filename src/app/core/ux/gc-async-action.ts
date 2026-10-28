import { computed, signal } from '@angular/core';

export type GcActionStatus = 'idle' | 'loading' | 'success' | 'error';
export type GcActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'busy' | 'error'; error?: unknown };

/** Per-action instance; never share a busy flag across unrelated operations. */
export class GcAsyncAction {
  readonly status = signal<GcActionStatus>('idle');
  readonly error = signal<unknown>(null);
  readonly pending = computed(() => this.status() === 'loading');

  async run<T>(operation: () => Promise<T>): Promise<GcActionResult<T>> {
    if (this.pending()) return { ok: false, reason: 'busy' };
    this.status.set('loading');
    this.error.set(null);
    try {
      const value = await operation();
      this.status.set('success');
      return { ok: true, value };
    } catch (error: unknown) {
      this.error.set(error);
      this.status.set('error');
      return { ok: false, reason: 'error', error };
    }
  }

  reset(): void {
    if (!this.pending()) {
      this.status.set('idle');
      this.error.set(null);
    }
  }
}
