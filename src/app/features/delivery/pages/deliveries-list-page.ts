
import {Component,computed,effect,inject,signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcDataTable,type GcCellValue,type GcTableRow,type GcTableColumn} from '../../../design-system/data/gc-data-table';
import {GcTableCellDirective} from '../../../design-system/data/gc-table-cell.directive';
import {GcPagination,type GcPageChange} from '../../../design-system/data/gc-pagination';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {formatInstant} from '../../../shared/formatting';
import {DeliveryApi} from '../data-access/delivery.api';
import {DELIVERY_STATE_LABEL,type DeliveryState} from '../data-access/delivery.models';
import {DeliveriesUrlState} from '../data-access/deliveries-url-state';

const ESTADO_CHOICES=(Object.keys(DELIVERY_STATE_LABEL) as DeliveryState[]).map(id=>(
 {id,label:DELIVERY_STATE_LABEL[id]}));

@Component({
 selector:'gc-deliveries-list-page',
 providers:[DeliveriesUrlState],
 imports:[RouterLink,GcPageHeader,GcButtonDirective,GcDataTable,GcTableCellDirective,
  GcPagination,GcErrorState,GcSearchSelect],
 template:`
 <main class="del-page">
  <gc-page-header title="Entregas" description="Tablero de pedidos a domicilio y de plataformas externas."/>
  <section class="del-card">
   <div class="del-toolbar gc-filter-grid">
    <gc-search-select id="del-branch" label="Sucursal" [items]="branchChoices()"
     [value]="url.filters().sucursalId" [clearable]="false" (valueChange)="changeBranch($event)"/>
    <gc-search-select id="del-estado" label="Estado" [items]="estadoChoices" [searchable]="false"
     [value]="url.filters().estado" placeholder="Todos" (valueChange)="changeEstado($event)"/>
    <form class="del-toolbar" (submit)="applySearch($event)">
     <div class="del-field"><label for="del-search">Buscar</label>
      <input id="del-search" [value]="search()" (input)="search.set($any($event.target).value)"
       maxlength="60" placeholder="Número de orden o dirección"/>
     </div>
     <button gcButton variant="outline" type="submit">Buscar</button>
    </form>
   </div>
   @if(page.status()==='error'){<gc-error-state [message]="errorMessage()" (retry)="reload()"/>}
   @else{
    <gc-data-table [columns]="columns" [rows]="page.data()?.rows??[]" [loading]="page.busy()">
     <ng-template gcTableCell="estado" let-row>
      <span class="del-state-badge" [class]="badgeClass(row['estadoRaw'])">{{row['estado']}}</span>
     </ng-template>
     <ng-template gcTableCell="actions" let-row>
      <a gcButton variant="outline" [routerLink]="['/delivery',row['id']]">Ver detalle</a>
     </ng-template>
    </gc-data-table>
    <gc-pagination [index]="url.filters().page-1" [size]="url.filters().limit"
     [total]="page.data()?.total??0" (pageChange)="onPage($event)"/>
   }
  </section>
 </main>`,
 styleUrl:'../delivery.scss'
})
export class GcDeliveriesListPage {
 protected readonly url=inject(DeliveriesUrlState);
 protected readonly branch=inject(GcBranchContext);
 protected readonly branchChoices=computed(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly estadoChoices=ESTADO_CHOICES;
 private readonly api=inject(DeliveryApi);
 protected readonly page=new GcPageState<{rows:GcTableRow[];total:number}>();
 protected readonly search=signal('');
 protected readonly columns:GcTableColumn[]=[
  {key:'numero',label:'Orden'},{key:'origen',label:'Origen'},{key:'direccion',label:'Dirección'},
  {key:'repartidor',label:'Repartidor'},{key:'estado',label:'Estado'},
  {key:'fecha',label:'Actualizado'},{key:'actions',label:'Acciones'}];
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
 protected badgeClass(estado:GcCellValue){
  if(estado==='EN_REPARTO')return 'del-state-badge--progress';
  if(estado==='ENTREGADA')return 'del-state-badge--done';
  if(estado==='CANCELADA')return 'del-state-badge--cancelled';
  return 'del-state-badge--pending';
 }
 private async load(){
  const f=this.url.filters();
  const zone=this.branch.branches().find(b=>b.id===f.sucursalId)?.zonaHoraria??'America/Guatemala';
  await this.page.load(async()=>{
   const list=await firstValueFrom(this.api.list({sucursalId:f.sucursalId,page:f.page,limit:f.limit,
    estado:(f.estado||undefined) as DeliveryState|undefined,search:f.search||undefined}));
   return {total:list.meta.total,rows:list.data.map(d=>{
    const stamp=d.entregadaEn??d.enRepartoEn;
    return {id:d.id,numero:d.orden.numero,
     origen:d.canalExterno?d.canalExterno.nombre:'Propio',
     direccion:d.direccionTexto,repartidor:d.repartidor?.nombre??'Sin asignar',
     estadoRaw:d.estado,estado:DELIVERY_STATE_LABEL[d.estado],
     fecha:stamp?formatInstant(stamp,zone):'—',actions:d.id};
   })};
  });
 }
}
