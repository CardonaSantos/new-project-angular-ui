import { computed, signal } from '@angular/core';

/** Column preferences in memory only. The original column schema remains the source of truth. */
export class GcTablePreferences {
  private readonly source: readonly string[];
  readonly order = signal<readonly string[]>([]);
  readonly hidden = signal<readonly string[]>([]);
  readonly visible = computed(() => this.order().filter((key) => !this.hidden().includes(key)));

  constructor(columns: readonly string[]) {
    this.source = [...new Set(columns)];
    this.order.set(this.source);
  }

  toggle(key: string): void {
    if (!this.source.includes(key)) return;
    if (!this.hidden().includes(key) && this.visible().length <= 1) return;
    this.hidden.update((hidden) => hidden.includes(key) ? hidden.filter((item) => item !== key) : [...hidden, key]);
  }

  move(key: string, direction: -1 | 1): void {
    this.order.update((old) => {
      const next = [...old];
      const from = next.indexOf(key);
      const to = from + direction;
      if (from === -1 || to < 0 || to >= next.length) return old;
      next.splice(from, 1);
      next.splice(to, 0, key);
      return next;
    });
  }

  reset(): void {
    this.order.set([...this.source]);
    this.hidden.set([]);
  }
}
