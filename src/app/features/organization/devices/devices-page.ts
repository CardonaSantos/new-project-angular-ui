import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
import { DevicesApi } from '../data-access/organization-api';
import { DEVICE_TYPES, deviceLabel } from '../data-access/organization.models';
import type { Device, DeviceType, Paged } from '../data-access/organization.models';
import { GcOrganizationNav } from '../organization-nav';

@Component({
  selector:'gc-devices-page',
  imports:[RouterLink,GcPageHeader,GcButtonDirective,GcDataTable,GcTableCellDirective,
    GcTableToolbar,GcFilterBar,GcPagination,GcStatusBadge,GcErrorState,GcOrganizationNav],
  template:`
  <div class="gc-org-page">
    <gc-page-header title="Dispositivos">
      @if (branch.has('devices.manage')) {
        <a gcButton gcPageActions routerLink="/organization/devices/new">Nuevo dispositivo</a>
      }
    </gc-page-header>
    <gc-organization-nav />
    <section class="gc-org-card gc-org-page">
      <div class="gc-org-toolbar">
        <gc-table-toolbar searchLabel="Buscar dispositivos" [query]="search()"
          (queryChange)="search.set($event)"/>
        <div class="gc-org-field">
          <label for="dv-branch-filter">Sucursal</label>
          <select id="dv-branch-filter" [value]="branchFilter()"
            (change)="setBranch($any($event.target).value)">
            <option value="">Todas</option>
            @for (item of branch.branches(); track item.id) {
              <option [value]="item.id">{{ item.nombre }}</option>
            }
          </select>
        </div>
        <gc-filter-bar filterId="dv-type-filter" label="Tipo" [options]="types"
          [value]="typeFilter()" (valueChange)="setType($event)"/>
        <gc-filter-bar filterId="dv-active-filter" label="Estado" [options]="statuses"
          [value]="statusFilter()" (valueChange)="setStatus($event)"/>
        <button gcButton variant="outline" type="button" (click)="applySearch()">Buscar</button>
      </div>
      @if (page.status()==='error') {
        <gc-error-state [message]="errorMessage()" (retry)="reload()"/>
      } @else {
        <gc-data-table [rows]="rows()" [columns]="columns" [loading]="page.busy()">
          <ng-template gcTableCell="estado" let-row>
            <gc-status-badge [label]="row['estado'] ? 'Activo' : 'Inactivo'"
              [tone]="row['estado'] ? 'success' : 'neutral'"/>
          </ng-template>
          <ng-template gcTableCell="acciones" let-row>
            <a [routerLink]="['/organization/devices',row['id']]"
              [attr.aria-label]="'Ver dispositivo ' + row['nombre']">Ver detalle</a>
          </ng-template>
        </gc-data-table>
        <gc-pagination [index]="pageIndex()" [size]="pageSize()"
          [total]="page.data()?.meta?.total ?? 0" (pageChange)="onPage($event)" />
      }
    </section>
  </div>
  `,
  styleUrl:'../organization.scss',
})
export class GcDevicesPage implements OnInit {
  protected readonly branch=inject(GcBranchContext);
  protected readonly access=inject(OrganizationAccess);
  private readonly api=inject(DevicesApi);
  protected readonly search=signal('');
  protected readonly branchFilter=signal('');
  protected readonly typeFilter=signal('');
  protected readonly statusFilter=signal('all');
  protected readonly pageIndex=signal(0);
  protected readonly pageSize=signal(10);
  protected readonly page=new GcPageState<Paged<Device>>();
  protected readonly types=[{value:'',label:'Todos'},...DEVICE_TYPES];
  protected readonly statuses=[
    {value:'all',label:'Todos'}, {value:'true',label:'Activos'}, {value:'false',label:'Inactivos'},
  ];
  protected readonly columns:GcTableColumn[]=[
    {key:'codigo',label:'Código'}, {key:'nombre',label:'Nombre'},
    {key:'tipo',label:'Tipo'}, {key:'sucursal',label:'Sucursal'},
    {key:'estado',label:'Estado'}, {key:'acciones',label:'Acciones'},
  ];
  protected readonly rows=computed<GcTableRow[]>(()=> (this.page.data()?.data??[]).map(d=>({
    id:d.id,codigo:d.codigo,nombre:d.nombre,tipo:deviceLabel(d.tipo),
    sucursal:d.sucursal.nombre,estado:d.activo,acciones:d.id,
  })));
  ngOnInit():void {void this.initialize();}
  private async initialize():Promise<void> {
    try {if(!this.access.loaded())await this.access.load();}catch{/* handled by interceptor */}
    await this.load();
  }
  protected errorMessage():string {return gcErrorMessage(this.page.error());}
  protected reload():void {void this.load();}
  protected setType(value:string):void {this.typeFilter.set(value);this.applySearch();}
  protected setStatus(value:string):void {this.statusFilter.set(value);this.applySearch();}
  protected setBranch(value:string):void {this.branchFilter.set(value);this.applySearch();}
  protected applySearch():void {this.pageIndex.set(0);void this.load();}
  protected onPage(change:GcPageChange):void {
    this.pageIndex.set(change.index);this.pageSize.set(change.size);void this.load();
  }
  private async load():Promise<void> {
    await this.page.load(()=>firstValueFrom(this.api.list({
      page:this.pageIndex()+1,limit:this.pageSize(),search:this.search().trim(),
      sucursalId:this.branchFilter()||undefined,
      tipo:(this.typeFilter()||undefined) as DeviceType|undefined,
      activo:this.statusFilter()==='all'?undefined:this.statusFilter()==='true',
    })));
  }
}
