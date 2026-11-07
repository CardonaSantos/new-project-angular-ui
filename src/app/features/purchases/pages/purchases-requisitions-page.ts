
import {Component,computed,effect,inject,signal} from '@angular/core';
import {Router,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcDataTable,type GcTableRow,type GcTableColumn} from '../../../design-system/data/gc-data-table';
import {GcTableCellDirective} from '../../../design-system/data/gc-table-cell.directive';
import {GcPagination,type GcPageChange} from '../../../design-system/data/gc-pagination';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {formatInstant} from '../../../shared/formatting';
import {InventoryApi} from '../../inventory/data-access/inventory.api';
import {PurchasesApi} from '../data-access/purchases.api';
import {PurchasesAccess} from '../data-access/purchases-access';
import {RequisitionsUrlState} from '../data-access/requisitions-url-state';
import {GcPurchasesNav} from '../purchases-nav';

const ESTADO_CHOICES=[
 {id:'ABIERTA',label:'Abierta'},{id:'ATENDIDA',label:'Atendida'},{id:'CANCELADA',label:'Cancelada'},
];

@Component({
 selector:'gc-purchases-requisitions-page',
 providers:[RequisitionsUrlState],
 imports:[RouterLink,GcPurchasesNav,GcPageHeader,GcButtonDirective,GcDataTable,GcTableCellDirective,
  GcPagination,GcErrorState,GcSearchSelect],
 template:`
 <main class="req-page"><gc-purchases-nav/>
  <gc-page-header title="Requisiciones" description="Solicitudes de insumos entre almacenes."/>
  <section class="req-card">
   <div class="req-toolbar gc-filter-grid">
    <gc-search-select id="req-branch" label="Sucursal" [items]="branchChoices()"
     [value]="url.filters().sucursalId" [clearable]="false" (valueChange)="changeBranch($event)"/>
    <gc-search-select id="req-estado" label="Estado" [items]="estadoChoices" [searchable]="false"
     [value]="url.filters().estado" placeholder="Todos" (valueChange)="changeEstado($event)"/>
    <form class="req-toolbar" (submit)="applySearch($event)">
     <div class="req-field"><label for="req-search">Buscar</label>
      <input id="req-search" [value]="search()" (input)="search.set($any($event.target).value)"
       maxlength="60" placeholder="Número de requisición"/>
     </div>
     <button gcButton variant="outline" type="submit">Buscar</button>
    </form>
    @if(access.canSupplyRequest()){
     <a gcButton [routerLink]="['/purchases/requisitions/new']">Nueva requisición</a>
    }
   </div>
   @if(page.status()==='error'){<gc-error-state [message]="errorMessage()" (retry)="reload()"/>}
   @else{
    <gc-data-table [columns]="columns" [rows]="page.data()?.rows??[]" [loading]="page.busy()">
     <ng-template gcTableCell="actions" let-row>
      <a gcButton variant="outline" [routerLink]="['/purchases/requisitions',row['id']]">Ver detalle</a>
     </ng-template>
    </gc-data-table>
    <gc-pagination [index]="url.filters().page-1" [size]="url.filters().limit"
     [total]="page.data()?.total??0" (pageChange)="onPage($event)"/>
   }
  </section>
 </main>`,
 styleUrl:'../requisitions.scss'
})
export class GcPurchasesRequisitionsPage {
 protected readonly url=inject(RequisitionsUrlState);
 protected readonly branch=inject(GcBranchContext);
 protected readonly access=inject(PurchasesAccess);
 protected readonly branchChoices=computed(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly estadoChoices=ESTADO_CHOICES;
 private readonly api=inject(PurchasesApi);
 private readonly inv=inject(InventoryApi);
 private readonly router=inject(Router);
 protected readonly page=new GcPageState<{rows:GcTableRow[];total:number}>();
 protected readonly search=signal('');
 protected readonly columns:GcTableColumn[]=[
  {key:'numero',label:'Número'},{key:'almacenDestino',label:'Almacén destino'},
  {key:'fecha',label:'Fecha'},{key:'insumos',label:'Insumos'},{key:'estado',label:'Estado'},
  {key:'actions',label:'Acciones'}];
 constructor(){
  effect(()=>{
   const f=this.url.filters();this.search.set(f.search);
   if(f.sucursalId)void this.load();
  });
 }
 protected errorMessage(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load()}
 protected async changeBranch(id:string){await this.url.patch({sucursalId:id,page:1})}
 protected async changeEstado(id:string){await this.url.patch({estado:id||null,page:1})}
 protected applySearch(e:Event){e.preventDefault();void this.url.patch({search:this.search().trim()||null,page:1})}
 protected async onPage(e:GcPageChange){await this.url.patch({page:e.index+1,limit:e.size})}
 private async load(){
  const f=this.url.filters();
  const zone=this.branch.branches().find(b=>b.id===f.sucursalId)?.zonaHoraria??'America/Guatemala';
  await this.page.load(async()=>{
   const [list,warehouses]=await Promise.all([
    firstValueFrom(this.api.requisitions({sucursalId:f.sucursalId,page:f.page,limit:f.limit,
     estado:(f.estado||undefined) as 'ABIERTA'|'ATENDIDA'|'CANCELADA'|undefined,
     search:f.search||undefined})),
    firstValueFrom(this.inv.warehouseOptions({sucursalId:f.sucursalId,limit:50})),
   ]);
   const names=new Map(warehouses.data.map(w=>[w.id,w.label]));
   return {total:list.meta.total,rows:list.data.map(r=>({id:r.id,numero:r.numero,
    almacenDestino:names.get(r.almacenDestinoId)??r.almacenDestinoId,
    fecha:formatInstant(r.creadaEn,zone,'DD/MM/YYYY'),insumos:r.lineas.length,
    estado:estadoLabel(r.estadoVisible??r.estado),actions:r.id}))};
  });
 }
}

function estadoLabel(estado:string):string{
 const labels:Record<string,string>={ABIERTA:'Abierta',ATENDIDA:'Atendida',CANCELADA:'Cancelada',
  SOLICITADA:'Solicitada',EN_PROCESO:'En proceso',PARCIAL:'Parcial'};
 return labels[estado]??estado;
}
