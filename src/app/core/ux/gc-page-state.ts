import { computed, signal } from '@angular/core';

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
    this.status.set(this.data() === null ? 'loading' : 'refreshing');
    this.error.set(null);
    try {
      const value = await fetcher();
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
