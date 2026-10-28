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
    const visible = this.visible();
    const position = visible.indexOf(key);
    const adjacent = visible[position + direction];
    if (position < 0 || !adjacent) return;
    this.order.update((previous) => {
      const next = [...previous];
      const first = next.indexOf(key);
      const second = next.indexOf(adjacent);
      [next[first], next[second]] = [next[second], next[first]];
      return next;
    });
  }

  reset(): void {
    this.order.set([...this.source]);
    this.hidden.set([]);
  }
}
