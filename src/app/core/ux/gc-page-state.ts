import { computed, signal, untracked } from '@angular/core';

export type GcPageStatus = 'idle' | 'loading' | 'refreshing' | 'ready' | 'empty' | 'error';

/** Request sequencing prevents stale promises from overwriting newer data. */
export class GcPageState<T> {
  readonly status = signal<GcPageStatus>('idle');
  readonly data = signal<T | null>(null);
  readonly error = signal<unknown>(null);
  readonly busy = computed(() => this.status() === 'loading' || this.status() === 'refreshing');
  private generation = 0;

  async load(fetcher: () => Promise<T>, isEmpty: (value: T) => boolean = () => false): Promise<void> {
    const current = ++this.generation;
    // load() may run within a feature effect; data is not a filter dependency.
    this.status.set(untracked(this.data) === null ? 'loading' : 'refreshing');
    this.error.set(null);
    try {
      // Avoid accidentally tracking page state or other signals read by fetcher.
      const value = await untracked(fetcher);
      if (current !== this.generation) return;
      this.data.set(value);
      this.status.set(isEmpty(value) ? 'empty' : 'ready');
    } catch (error: unknown) {
      if (current !== this.generation) return;
      this.error.set(error);
      this.status.set('error');
    }
  }

  reset(): void {
    this.generation += 1;
    this.data.set(null);
    this.error.set(null);
    this.status.set('idle');
  }
}
