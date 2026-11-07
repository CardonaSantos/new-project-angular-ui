
import {Component,computed,effect,inject,signal} from '@angular/core';
import {Router} from '@angular/router';
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
import {formatInstant,zonedInstantFrom} from '../../../shared/formatting';
import {ReservationsUrlState} from '../data-access/reservations-url-state';
import {ReservationsApi} from '../data-access/reservations.api';
import {ReservationsAccess} from '../data-access/reservations-access';
import type {ReservationState} from '../data-access/reservations.models';

const ESTADO_CHOICES=[
 {id:'PENDIENTE',label:'Pendiente'},{id:'CONFIRMADA',label:'Confirmada'},
 {id:'CANCELADA',label:'Cancelada'},{id:'COMPLETADA',label:'Completada'},
 {id:'NO_ASISTIO',label:'No asistió'},
];

@Component({
 selector:'gc-reservations-list-page',
 providers:[ReservationsUrlState],
 imports:[GcPageHeader,GcButtonDirective,GcDataTable,GcTableCellDirective,
  GcPagination,GcErrorState,GcSearchSelect],
 template:`
 <div class="rsv-page">
  <gc-page-header title="Reservaciones"
   description="Reservas de mesa registradas en esta sucursal."/>
  <section class="rsv-card">
   <div class="rsv-toolbar gc-filter-grid">
    <gc-search-select id="rsv-branch" label="Sucursal" [items]="branchChoices()"
     [value]="url.filters().sucursalId" [clearable]="false" (valueChange)="changeBranch($event)"/>
    <gc-search-select id="rsv-estado" label="Estado" [items]="estadoChoices" [searchable]="false"
     [value]="url.filters().estado" placeholder="Todos" (valueChange)="changeEstado($event)"/>
    <div class="rsv-field"><label for="rsv-desde">Desde</label>
     <input id="rsv-desde" type="date" [value]="url.filters().desde"
      (change)="changeDesde($any($event.target).value)"/>
    </div>
    <div class="rsv-field"><label for="rsv-hasta">Hasta</label>
     <input id="rsv-hasta" type="date" [value]="url.filters().hasta"
      (change)="changeHasta($any($event.target).value)"/>
    </div>
    <form class="rsv-toolbar" (submit)="applySearch($event)">
     <div class="rsv-field"><label for="rsv-search">Buscar</label>
      <input id="rsv-search" [value]="search()" (input)="search.set($any($event.target).value)"
       maxlength="100" placeholder="Nombre o teléfono de contacto"/>
     </div>
     <button gcButton variant="outline" type="submit">Buscar</button>
    </form>
    @if(canManage()){<button gcButton type="button" (click)="create()">Nueva reservación</button>}
   </div>
   @if(page.status()==='error'){<gc-error-state [message]="errorMessage()" (retry)="reload()"/>}
   @else{
    <gc-data-table [columns]="columns" [rows]="page.data()?.rows??[]" [loading]="page.busy()">
     <ng-template gcTableCell="actions" let-row>
      <button type="button" gcButton variant="outline" (click)="open(row['id'])">Ver detalle</button>
     </ng-template>
    </gc-data-table>
    <gc-pagination [index]="url.filters().page-1" [size]="url.filters().limit"
     [total]="page.data()?.total??0" (pageChange)="onPage($event)"/>
   }
  </section>
 </div>`,
 styleUrl:'../reservations.scss'
})
export class GcReservationsListPage {
 protected readonly url=inject(ReservationsUrlState);
 protected readonly branch=inject(GcBranchContext);
 protected readonly branchChoices=computed(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly estadoChoices=ESTADO_CHOICES;
 private readonly api=inject(ReservationsApi);
 private readonly access=inject(ReservationsAccess);
 private readonly router=inject(Router);
 protected readonly page=new GcPageState<{rows:GcTableRow[];total:number}>();
 protected readonly search=signal('');
 protected readonly columns:GcTableColumn[]=[
  {key:'nombreContacto',label:'Contacto'},{key:'telefonoContacto',label:'Teléfono'},
  {key:'personas',label:'Personas'},{key:'inicio',label:'Inicio'},{key:'fin',label:'Fin'},
  {key:'estado',label:'Estado'},{key:'actions',label:'Acciones'}];
 constructor(){
  effect(()=>{
   const f=this.url.filters();this.search.set(f.search);
   if(f.sucursalId)void this.load();
  });
 }
 protected canManage(){return this.access.canManage()}
 protected errorMessage(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load()}
 protected async changeBranch(id:string){await this.url.patch({sucursalId:id,page:1})}
 protected async changeEstado(id:string){await this.url.patch({estado:id||null,page:1})}
 protected async changeDesde(v:string){await this.url.patch({desde:v||null,page:1})}
 protected async changeHasta(v:string){await this.url.patch({hasta:v||null,page:1})}
 protected applySearch(e:Event){e.preventDefault();void this.url.patch({search:this.search().trim()||null,page:1})}
 protected async onPage(e:GcPageChange){await this.url.patch({page:e.index+1,limit:e.size})}
 protected create(){void this.router.navigate(['/reservations/new'],{queryParams:{sucursalId:this.url.filters().sucursalId}})}
 protected open(id:GcTableRow[string]){void this.router.navigate(['/reservations',String(id)])}
 private async load(){
  const f=this.url.filters();
  const zone=this.branch.branches().find(b=>b.id===f.sucursalId)?.zonaHoraria??'America/Guatemala';
  await this.page.load(async()=>{
   const r=await firstValueFrom(this.api.list({sucursalId:f.sucursalId,page:f.page,limit:f.limit,
    search:f.search||undefined,estado:(f.estado||undefined) as ReservationState|undefined,
    desde:f.desde?zonedInstantFrom(f.desde,'00:00',zone):undefined,
    hasta:f.hasta?zonedInstantFrom(f.hasta,'23:59',zone):undefined}));
   return {total:r.meta.total,rows:r.data.map(x=>({id:x.id,nombreContacto:x.nombreContacto,
    telefonoContacto:x.telefonoContacto??'—',personas:x.personas,
    inicio:formatInstant(x.inicio,zone,'DD/MM/YYYY HH:mm'),
    fin:formatInstant(x.fin,zone,'DD/MM/YYYY HH:mm'),estado:estadoLabel(x.estado),
    actions:x.id}))};
  });
 }
}

function estadoLabel(estado:ReservationState):string{
 return ESTADO_CHOICES.find(e=>e.id===estado)?.label??estado;
}
