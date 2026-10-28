import { Component, computed, signal } from '@angular/core';
import { GcPageHeader } from '../../design-system/components/page-header/gc-page-header';
import { GcButtonDirective } from '../../design-system/components/button/gc-button.directive';
import {
  GcDataTable,
  GcTableColumn,
  GcTableRow,
  GcSort,
} from '../../design-system/data/gc-data-table';
import { GcTableToolbar } from '../../design-system/data/gc-table-toolbar';
import { GcFilterBar, GcFilterOption } from '../../design-system/data/gc-filter-bar';
import { GcPagination, GcPageChange } from '../../design-system/data/gc-pagination';

const SAMPLE_ROWS: readonly GcTableRow[] = [
  { code: 'ART-001', name: 'Café en grano', category: 'Insumos', quantity: 120, status: 'Disponible' },
  { code: 'ART-002', name: 'Leche entera', category: 'Insumos', quantity: 46, status: 'Disponible' },
  { code: 'ART-003', name: 'Cappuccino clásico', category: 'Bebidas', quantity: 22, status: 'Disponible' },
  { code: 'ART-004', name: 'Café americano', category: 'Bebidas', quantity: 15, status: 'Disponible' },
  { code: 'ART-005', name: 'Chocolate caliente', category: 'Bebidas', quantity: 0, status: 'Agotado' },
  { code: 'ART-006', name: 'Pan de banano', category: 'Alimentos', quantity: 8, status: 'Disponible' },
  { code: 'ART-007', name: 'Croissant', category: 'Alimentos', quantity: 6, status: 'Disponible' },
  { code: 'ART-008', name: 'Jarabe de vainilla', category: 'Insumos', quantity: 0, status: 'Agotado' },
  { code: 'ART-009', name: 'Espresso doble', category: 'Bebidas', quantity: 14, status: 'Disponible' },
  { code: 'ART-010', name: 'Té chai', category: 'Bebidas', quantity: 10, status: 'Disponible' },
  { code: 'ART-011', name: 'Galleta de avena', category: 'Alimentos', quantity: 0, status: 'Agotado' },
  { code: 'ART-012', name: 'Miel', category: 'Insumos', quantity: 33, status: 'Disponible' },
  { code: 'ART-013', name: 'Pastel de zanahoria', category: 'Alimentos', quantity: 4, status: 'Disponible' },
  { code: 'ART-014', name: 'Filtro de café', category: 'Insumos', quantity: 70, status: 'Disponible' },
  { code: 'ART-015', name: 'Limonada', category: 'Bebidas', quantity: 19, status: 'Disponible' },
];

@Component({
  selector: 'gc-table-playground',
  imports: [GcPageHeader, GcButtonDirective, GcDataTable, GcTableToolbar, GcFilterBar, GcPagination],
  templateUrl: './table-playground.html',
  styleUrl: './table-playground.scss',
})
export class TablePlayground {
  protected readonly columns: readonly GcTableColumn[] = [
    { key: 'code', label: 'Código', sortable: true },
    { key: 'name', label: 'Nombre', sortable: true },
    { key: 'category', label: 'Categoría', sortable: true },
    { key: 'quantity', label: 'Existencia (demo)', sortable: true, numeric: true },
    { key: 'status', label: 'Estado' },
  ];
  protected readonly categories: readonly GcFilterOption[] = [
    { label: 'Todas', value: '' },
    { label: 'Bebidas', value: 'Bebidas' },
    { label: 'Alimentos', value: 'Alimentos' },
    { label: 'Insumos', value: 'Insumos' },
  ];
  protected readonly search = signal('');
  protected readonly category = signal('');
  protected readonly sort = signal<GcSort | null>(null);
  protected readonly page = signal(0);
  protected readonly size = signal(5);
  protected readonly loading = signal(false);

  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('es');
    const category = this.category();
    const sort = this.sort();
    const data = SAMPLE_ROWS.filter((row) =>
      (!category || row['category'] === category) &&
      (!query || Object.values(row).some((value) =>
        String(value ?? '').toLocaleLowerCase('es').includes(query))),
    );
    if (sort?.direction) {
      const direction = sort.direction === 'asc' ? 1 : -1;
      data.sort((a, b) => {
        const left = a[sort.key];
        const right = b[sort.key];
        if (typeof left === 'number' && typeof right === 'number') {
          return (left - right) * direction;
        }
        return String(left ?? '').localeCompare(String(right ?? ''), 'es', { numeric: true }) * direction;
      });
    }
    return data;
  });

  protected readonly displayed = computed(() => {
    const start = this.page() * this.size();
    return this.filtered().slice(start, start + this.size());
  });

  protected setSearch(query: string): void {
    this.search.set(query);
    this.page.set(0);
  }
  protected setCategory(category: string): void {
    this.category.set(category);
    this.page.set(0);
  }
  protected setSort(sort: GcSort): void {
    this.sort.set(sort.direction ? sort : null);
    this.page.set(0);
  }
  protected setPage(event: GcPageChange): void {
    this.page.set(event.index);
    this.size.set(event.size);
  }
  protected reset(): void {
    this.search.set('');
    this.category.set('');
    this.sort.set(null);
    this.page.set(0);
    this.loading.set(false);
  }
}
