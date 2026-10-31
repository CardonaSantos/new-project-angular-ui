import { Directive, TemplateRef, inject, input } from '@angular/core';
import type { GcCellValue, GcTableColumn, GcTableRow } from './gc-data-table';

/**
 * Optional rich cell template. The feature owns its actions, links and badges;
 * GcDataTable remains independent of domain modules.
 *
 * <gc-data-table ...>
 *   <ng-template gcTableCell="status" let-row let-value="value">
 *     <gc-status-badge [tone]="..." [label]="..." />
 *   </ng-template>
 * </gc-data-table>
 */
export interface GcTableCellContext {
  $implicit: GcTableRow;
  value: GcCellValue;
  column: GcTableColumn | undefined;
}

@Directive({ selector: 'ng-template[gcTableCell]' })
export class GcTableCellDirective {
  readonly gcTableCell = input.required<string>();
  readonly template = inject<TemplateRef<GcTableCellContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _directive: GcTableCellDirective,
    context: unknown,
  ): context is GcTableCellContext {
    void context;
    return true;
  }
}
