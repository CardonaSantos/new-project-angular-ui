import { Component, computed, contentChildren, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { GcTableCellDirective } from './gc-table-cell.directive';
import { ColumnDef, injectTable, tableFeatures } from '@tanstack/angular-table';
import { GcSkeleton } from '../feedback/gc-skeleton';
import { GcEmptyState } from '../components/empty-state/gc-empty-state';

export type GcCellValue = string | number | boolean | null | undefined;
export type GcTableRow = Record<string, GcCellValue>;
export type GcSortDirection = 'asc' | 'desc' | null;

export interface GcTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  numeric?: boolean;
  /** Optional presentation formatter; do not mutate the API value. */
  format?: (value: GcCellValue, row: GcTableRow) => string;
}

export interface GcSort {
  key: string;
  direction: GcSortDirection;
}

/**
 * Headless TanStack v9 table. Search, sort and pagination are controlled by
 * the owning feature, so API-driven tables never silently sort a single page.
 */
const features = tableFeatures({});

@Component({
  selector: 'gc-data-table',
  imports: [GcSkeleton, GcEmptyState, NgTemplateOutlet],
  templateUrl: './gc-data-table.html',
  styleUrl: './gc-data-table.scss',
})
export class GcDataTable {
  readonly rows = input.required<readonly GcTableRow[]>();
  readonly columns = input.required<readonly GcTableColumn[]>();
  readonly loading = input(false);
  readonly sort = input<GcSort | null>(null);
  readonly sortChange = output<GcSort>();

  private readonly cellTemplates = contentChildren(GcTableCellDirective);
  protected readonly templatesByKey = computed(() =>
    new Map(this.cellTemplates().map((cell) => [cell.gcTableCell(), cell.template])),
  );
  protected readonly columnsByKey = computed(() =>
    new Map(this.columns().map((column) => [column.key, column])),
  );

  protected cellText(row: GcTableRow, key: string): string {
    const value = row[key];
    const format = this.columnsByKey().get(key)?.format;
    if (format) return format(value, row);
    return value === undefined || value === null || value === '' ? '—' : String(value);
  }

  protected readonly tanstackColumns = computed<ColumnDef<typeof features, GcTableRow>[]>(() =>
    this.columns().map((column) => ({
      id: column.key,
      accessorKey: column.key,
      header: column.label,
    })),
  );

  protected readonly table = injectTable(() => ({
    features,
    data: [...this.rows()],
    columns: this.tanstackColumns(),
  }));

  protected toggleSort(column: GcTableColumn): void {
    if (!column.sortable) return;
    const current = this.sort();
    const direction: GcSortDirection = current?.key !== column.key
      ? 'asc'
      : current.direction === 'asc'
        ? 'desc'
        : current.direction === 'desc'
          ? null
          : 'asc';
    this.sortChange.emit({ key: column.key, direction });
  }

  protected sortLabel(column: GcTableColumn): string {
    const sort = this.sort();
    if (!sort || sort.key !== column.key || !sort.direction) return 'sin ordenar';
    return sort.direction === 'asc' ? 'ascendente' : 'descendente';
  }
}
