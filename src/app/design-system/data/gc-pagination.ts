import { Component, computed, input, output } from '@angular/core';

export interface GcPageChange {
  index: number;
  size: number;
}

/** Zero-based page indices; the total is the total matched rows on the server. */
@Component({
  selector: 'gc-pagination',
  template: `
    <div class="gc-pager">
      <p aria-live="polite">
        @if (total() === 0) { 0 registros }
        @else { {{ firstRecord() }}–{{ lastRecord() }} de {{ total() }} registros }
      </p>
      <div class="gc-controls">
        <label for="gc-page-size">Filas</label>
        <select id="gc-page-size" [value]="size()" (change)="changeSize(+$any($event.target).value)">
          @for (option of sizes; track option) { <option [value]="option">{{ option }}</option> }
        </select>
        <button type="button" [disabled]="index() <= 0"
          aria-label="Página anterior" (click)="previous()">Anterior</button>
        <span>Página {{ currentPage() }} de {{ pageCount() }}</span>
        <button type="button" [disabled]="index() >= pageCount() - 1"
          aria-label="Página siguiente" (click)="next()">Siguiente</button>
      </div>
    </div>
  `,
  styles: [ `
    .gc-pager { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:.75rem; padding:.5rem 0; color:var(--gc-on-surface-variant); font-size:.875rem; }
    .gc-pager p { margin:0; }
    .gc-controls { display:flex; gap:.55rem; align-items:center; flex-wrap:wrap; }
    select,button { min-height:2.5rem; padding:.3rem .6rem; color:var(--gc-on-surface); border:1px solid var(--gc-outline-variant); border-radius:calc(var(--gc-radius) * .55); background:var(--gc-surface); }
    button:not(:disabled) { cursor:pointer; }
    button:not(:disabled):hover { background:var(--gc-surface-container); }
    button:disabled { opacity:.45; cursor:not-allowed; }
    @media (pointer:coarse) { select,button { min-height:44px; } }
  ` ],
})
export class GcPagination {
  readonly index = input(0);
  readonly size = input(10);
  readonly total = input(0);
  readonly pageChange = output<GcPageChange>();
  protected readonly sizes = [5, 10, 25, 50];
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / Math.max(1, this.size()))));
  readonly currentPage = computed(() => Math.min(this.pageCount(), this.index() + 1));
  readonly firstRecord = computed(() => this.total() === 0 ? 0 : this.index() * this.size() + 1);
  readonly lastRecord = computed(() => Math.min(this.total(), (this.index() + 1) * this.size()));

  protected previous(): void {
    if (this.index() > 0) this.pageChange.emit({ index: this.index() - 1, size: this.size() });
  }
  protected next(): void {
    if (this.index() < this.pageCount() - 1) this.pageChange.emit({ index: this.index() + 1, size: this.size() });
  }
  protected changeSize(size: number): void {
    if (this.sizes.includes(size)) this.pageChange.emit({ index: 0, size });
  }
}
