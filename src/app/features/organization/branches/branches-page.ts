import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GcPageState } from '../../../core/ux/gc-page-state';
import { gcErrorMessage } from '../../../core/http/api-error';
import { GcBranchContext } from '../../../core/organization/gc-branch-context';
import { GcPageHeader } from '../../../design-system/components/page-header/gc-page-header';
import { GcButtonDirective } from '../../../design-system/components/button/gc-button.directive';
import { GcDataTable, GcTableColumn, GcTableRow } from '../../../design-system/data/gc-data-table';
import { GcTableCellDirective } from '../../../design-system/data/gc-table-cell.directive';
import { GcTableToolbar } from '../../../design-system/data/gc-table-toolbar';
import { GcFilterBar } from '../../../design-system/data/gc-filter-bar';
import { GcPagination, GcPageChange } from '../../../design-system/data/gc-pagination';
import { GcStatusBadge } from '../../../design-system/components/status-badge/gc-status-badge';
import { GcErrorState } from '../../../design-system/feedback/gc-error-state';
import { OrganizationAccess } from '../data-access/organization-access';
import { BranchesApi } from '../data-access/organization-api';
import type { Branch, Paged } from '../data-access/organization.models';
import { GcOrganizationNav } from '../organization-nav';

@Component({
  selector: 'gc-branches-page',
  imports: [RouterLink, GcPageHeader, GcButtonDirective, GcDataTable, GcTableCellDirective,
    GcTableToolbar, GcFilterBar, GcPagination, GcStatusBadge, GcErrorState, GcOrganizationNav],
  template: `
  <div class="gc-org-page">
    <gc-page-header title="Sucursales">
      @if (access.canGlobal('branches.manage')) {
        <a gcButton gcPageActions routerLink="/organization/branches/new">Nueva sucursal</a>
      }
    </gc-page-header>
    <gc-organization-nav />
    <section class="gc-org-card gc-org-page">
      <form class="gc-org-toolbar" (submit)="applySearch($event)">
        <gc-table-toolbar searchLabel="Buscar sucursales" [query]="search()"
          (queryChange)="search.set($event)"/>
        <gc-filter-bar filterId="branch-active-filter" label="Estado" [value]="status()"
          [options]="statusOptions" (valueChange)="updateStatus($event)" />
        <button gcButton variant="outline" type="submit">Buscar</button>
      </form>
      @if (page.status() === 'error') {
        <gc-error-state [message]="errorMessage()" (retry)="reload()"/>
      } @else {
        <gc-data-table [rows]="rows()" [columns]="columns" [loading]="page.busy()">
          <ng-template gcTableCell="estado" let-row>
            <gc-status-badge [label]="row['estado'] ? 'Activa' : 'Inactiva'"
              [tone]="row['estado'] ? 'success' : 'neutral'"/>
          </ng-template>
          <ng-template gcTableCell="acciones" let-row>
            <div class="gc-org-table-actions">
              <a [routerLink]="['/organization/branches', row['id']]"
                [attr.aria-label]="'Ver sucursal ' + row['nombre']">Ver detalle</a>
            </div>
          </ng-template>
        </gc-data-table>
        <gc-pagination [index]="pageIndex()" [size]="pageSize()" [total]="page.data()?.meta?.total ?? 0"
          (pageChange)="onPage($event)" />
      }
    </section>
  </div>
  `,
  styleUrl: '../organization.scss',
})
export class GcBranchesPage implements OnInit {
  private readonly api = inject(BranchesApi);
  protected readonly context = inject(GcBranchContext);
  protected readonly access = inject(OrganizationAccess);
  protected readonly search = signal('');
  protected readonly status = signal('all');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly page = new GcPageState<Paged<Branch>>();
  protected readonly columns: GcTableColumn[] = [
    {key:'codigo',label:'Código'},
    {key:'nombre',label:'Sucursal'},
    {key:'direccion',label:'Dirección'},
    {key:'estado',label:'Estado'},
    {key:'acciones',label:'Acciones'},
  ];
  protected readonly statusOptions = [
    {value:'all',label:'Todas'}, {value:'true',label:'Activas'}, {value:'false',label:'Inactivas'},
  ];
  protected readonly rows = computed<GcTableRow[]>(() => (this.page.data()?.data ?? []).map(branch => ({
    id:branch.id, codigo:branch.codigo, nombre:branch.nombre,
    direccion:branch.direccion ?? '—', estado:branch.activa, acciones:branch.id,
  })));
  ngOnInit(): void { void this.initialize(); }
  private async initialize(): Promise<void> {
    try { if (!this.access.loaded()) await this.access.load(); } catch { /* interceptor reports */ }
    await this.load();
  }
  protected errorMessage(): string { return gcErrorMessage(this.page.error()); }
  protected reload(): void { void this.load(); }
  protected applySearch(event?: Event): void { event?.preventDefault(); this.pageIndex.set(0); void this.load(); }
  protected updateStatus(value: string): void { this.status.set(value); this.applySearch(); }
  protected onPage(change: GcPageChange): void {
    this.pageIndex.set(change.index); this.pageSize.set(change.size); void this.load();
  }
  private async load(): Promise<void> {
    await this.page.load(() => firstValueFrom(this.api.list({
      page:this.pageIndex()+1, limit:this.pageSize(), search:this.search().trim(),
      activo:this.status()==='all'?undefined:this.status()==='true',
    })));
  }
}
