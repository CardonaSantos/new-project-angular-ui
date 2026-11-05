
import {DatePipe} from '@angular/common';
import {formatInstant} from '../../../shared/formatting';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {UsersAccess} from '../data-access/users-access';
import {Component,OnInit,inject,signal,computed} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcPagination,type GcPageChange} from '../../../design-system/data/gc-pagination';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcDataTable,type GcTableColumn,type GcTableRow} from '../../../design-system/data/gc-data-table';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {UsersApi} from '../data-access/users.api';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import type {ActivityItem,Audit,Page,StaffOverview} from '../data-access/users.models';
@Component({
 selector:'gc-user-audit-page',
 imports:[DatePipe,GcPageHeader,GcPagination,GcErrorState,GcButtonDirective,GcDataTable,GcSearchSelect],
 template:`
 <div class="gc-u-page">
  <gc-page-header title="Auditoría y actividad"/>
  <section class="gc-u-card gc-u-page">
   <h2>Resumen operativo</h2>
   <div class="gc-u-audit-filters" role="group" aria-label="Período de actividad">
    <div class="gc-u-field"><label for="audit-from">Desde</label>
     <input id="audit-from" type="date" [value]="from()" (change)="from.set($any($event.target).value)"/></div>
    <div class="gc-u-field"><label for="audit-to">Hasta (sin incluir)</label>
     <input id="audit-to" type="date" [value]="to()" (change)="to.set($any($event.target).value)"/></div>
    <button gcButton type="button" (click)="refreshActivity()">Aplicar</button>
   </div>
   @if(overviewError()){<p role="alert" class="gc-u-alert">{{overviewError()}}</p>}
   @if(overview();as stats){
    <div class="gc-u-metrics">
     <div class="gc-u-metric"><strong>{{stats.ordenes.total}}</strong><span>Órdenes registradas</span></div>
     <div class="gc-u-metric"><strong>{{stats.cobros.cantidad}}</strong><span>Cobros realizados</span></div>
     <div class="gc-u-metric"><strong>{{stats.caja.turnos}}</strong><span>Turnos de caja</span></div>
     <div class="gc-u-metric"><strong>{{stats.delivery.entregas}}</strong><span>Entregas</span></div>
     <div class="gc-u-metric"><strong>{{stats.inventario.movimientos}}</strong><span>Movimientos de inventario</span></div>
    </div>
   }
  </section>
  <section class="gc-u-card gc-u-page">
   <h2>Actividad</h2>
   <gc-search-select class="gc-u-filter-compact" id="audit-kind" label="Tipo de actividad" [items]="kindChoices"
     [value]="kind()" placeholder="Todos" [searchable]="false"
     (valueChange)="kind.set($event);refreshActivity()"/>
   @if(activity.status()==='error'){<gc-error-state [message]="activityError()" (retry)="refreshActivity()"/>}
   @else{
    <gc-data-table [rows]="activityRows()" [columns]="activityColumns" [loading]="activity.busy()"/>
    <gc-pagination [index]="activityIndex()" [size]="10" [total]="activity.data()?.meta?.total??0"
      (pageChange)="changeActivity($event)"/>
   }
  </section>
  <section class="gc-u-card gc-u-page">
   <h2>Cambios registrados</h2>
   @if(audit.status()==='error'){<gc-error-state [message]="auditError()" (retry)="reloadAudit()"/>}
   @else{
    @for(entry of audit.data()?.data??[];track entry.id){
     <div class="gc-u-row">
      <div><strong>{{entry.accion}}</strong>
       <p class="gc-u-muted">{{entry.actor?.nombre??'Sistema'}} · {{entry.creadoEn|date:'medium'}}</p>
       @if(entry.motivo){<p>{{entry.motivo}}</p>}
      </div>
     </div>
    } @empty{<p class="gc-u-muted">Sin cambios registrados.</p>}
    <gc-pagination [index]="auditIndex()" [size]="10" [total]="audit.data()?.meta?.total??0"
     (pageChange)="changeAudit($event)"/>
   }
  </section>
 </div>`,
 styleUrl:'../users.scss'
})
export class GcUserAuditPage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 private readonly api=inject(UsersApi);
 private readonly branch=inject(GcBranchContext);
 private readonly access=inject(UsersAccess);
 private scope(){return this.access.canGlobal('users.read')?undefined:this.branch.branchId()??undefined}
 protected readonly id=this.route.snapshot.paramMap.get('id')??this.route.snapshot.parent?.paramMap.get('id')??'';
 protected readonly activity=new GcPageState<Page<ActivityItem>>();
 protected readonly audit=new GcPageState<Page<Audit>>();
 protected readonly overview=signal<StaffOverview|null>(null);
 protected readonly overviewError=signal<string|null>(null);
 protected readonly from=signal('');protected readonly to=signal('');
 protected readonly kind=signal('');
 protected readonly kinds=['ORDEN','PAGO','CAJA','ENTREGA','INVENTARIO'];
 protected readonly kindChoices=[
  {id:'ORDEN',label:'Órdenes'},{id:'PAGO',label:'Pagos'},{id:'CAJA',label:'Caja'},
  {id:'ENTREGA',label:'Entregas'},{id:'INVENTARIO',label:'Inventario'}
 ];
 protected readonly activityIndex=signal(0);protected readonly auditIndex=signal(0);
 protected readonly activityColumns:GcTableColumn[]=[
  {key:'kind',label:'Tipo'},{key:'label',label:'Actividad'},
  {key:'status',label:'Estado'},{key:'amount',label:'Importe'},{key:'at',label:'Fecha'}
 ];
 protected readonly activityRows=computed<GcTableRow[]>(()=>this.activity.data()?.data.map(x=>({
  kind:x.kind,label:x.label,status:x.status,amount:x.amount,at:this.renderDate(x.at),
 }))??[]);
 protected renderDate(instant:string):string {
  try{return formatInstant(instant,this.branch.active()?.zonaHoraria??'America/Guatemala');}
  catch{return '—'}
 }
 ngOnInit(){this.refreshActivity();void this.loadAudit()}
 protected activityError(){return gcErrorMessage(this.activity.error())}
 protected auditError(){return gcErrorMessage(this.audit.error())}
 protected refreshActivity(){
  this.activityIndex.set(0);
  void this.loadActivity();void this.loadOverview();
 }
 private async loadActivity(){
  await this.activity.load(()=>firstValueFrom(this.api.activity(this.id,{
    from:this.from()||undefined,to:this.to()||undefined,kind:this.kind()||undefined,
    sucursalId:this.scope(),
    page:this.activityIndex()+1,limit:10})));
 }
 private async loadOverview(){
  this.overviewError.set(null);
  try{this.overview.set(await firstValueFrom(this.api.overview(this.id,{
    from:this.from()||undefined,to:this.to()||undefined,sucursalId:this.scope()})))}
  catch(e){this.overviewError.set(gcErrorMessage(e))}
 }
 protected changeActivity(e:GcPageChange){this.activityIndex.set(e.index);void this.loadActivity()}
 protected changeAudit(e:GcPageChange){this.auditIndex.set(e.index);void this.loadAudit()}
 protected reloadAudit(){void this.loadAudit()}
 private async loadAudit(){await this.audit.load(()=>firstValueFrom(this.api.audit(this.id,{
  page:this.auditIndex()+1,limit:10,sucursalId:this.scope()})))}
}
