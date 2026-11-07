
import {Component,inject,OnInit,signal} from '@angular/core';
import {Subject,debounceTime,distinctUntilChanged,firstValueFrom} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute} from '@angular/router';
import {GcSessionService} from '../../../core/auth/gc-session.service';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcSearchSelect,type GcSelectOption} from '../../../design-system/forms/gc-search-select';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {gcErrorMessage} from '../../../core/http/api-error';
import {formatInstant} from '../../../shared/formatting';
import {UsersApi} from '../../users/data-access/users.api';
import {DeliveryApi} from '../data-access/delivery.api';
import {DeliveryAccess} from '../data-access/delivery-access';
import type {DeliveryRecord,DeliveryEvent,ClosureReadiness} from '../data-access/delivery.models';
import {DELIVERY_STATE_LABEL,CLOSURE_BLOCKER_LABEL} from '../data-access/delivery.models';

const BADGE_CLASS:Record<string,string>={PENDIENTE:'del-state-badge--pending',
 EN_REPARTO:'del-state-badge--progress',ENTREGADA:'del-state-badge--done',
 CANCELADA:'del-state-badge--cancelled'};
const EVENT_LABEL:Record<string,string>={DELIVERY_CREATED:'Entrega creada',
 DELIVERY_ASSIGNED:'Repartidor asignado',DELIVERY_DESTINATION_CHANGED:'Destino actualizado',
 DELIVERY_DISPATCHED:'Salió a reparto',DELIVERY_COMPLETED:'Entregada',
 DELIVERY_CANCELLED:'Entrega cancelada'};

@Component({
 selector:'gc-delivery-detail-page',
 imports:[GcPageHeader,GcButtonDirective,GcErrorState,GcSearchSelect],
 template:`
 <main class="del-page del-narrow">
  <gc-page-header [title]="'Entrega — orden '+(row()?.orden?.numero??'')"/>
  @if(loadError()){<gc-error-state [message]="loadError()!" (retry)="load()"/>}
  @else if(row();as r){
   <section class="del-card">
    <div class="del-row"><h2>Detalle</h2>
     <span class="del-state-badge" [class]="badgeClass(r.estado)">{{estadoLabel(r.estado)}}</span></div>
    <dl class="del-kv">
     <div><dt>Canal</dt><dd>{{r.canalExterno?r.canalExterno.nombre:'Entrega propia'}}</dd></div>
     <div><dt>Dirección</dt><dd>{{r.direccionTexto}}</dd></div>
     @if(r.referenciaDireccion){<div><dt>Referencia</dt><dd>{{r.referenciaDireccion}}</dd></div>}
     @if(r.telefonoContacto){<div><dt>Teléfono</dt><dd>{{r.telefonoContacto}}</dd></div>}
     <div><dt>Repartidor</dt><dd>{{r.repartidor?.nombre??'Sin asignar'}}</dd></div>
    </dl>
    @if(actionError()){<p class="del-alert" role="alert">{{actionError()}}</p>}

    @if(access.canManage()&&(r.estado==='PENDIENTE'||r.estado==='EN_REPARTO')){
     <div class="del-field">
      <gc-search-select id="del-courier" label="Repartidor" [items]="courierChoices()"
       [value]="r.repartidorId??''" [remote]="true" [loading]="courierBusy()"
       placeholder="Buscar repartidor por nombre…"
       (valueChange)="assignCourier($event)" (searchChange)="searchCouriers($event)" (opened)="searchCouriers('')"/>
      @if(r.estado==='EN_REPARTO'){
       <small>Reasignar bloquea si ya se cobró efectivo en esta entrega.</small>
      }
     </div>
    }

    <div class="del-actions">
     @if(canDispatch(r)){
      <button type="button" gcButton [disabled]="actionBusy()" (click)="dispatch()">
       {{actionBusy()?'Enviando…':'Marcar salida a reparto'}}</button>
     }
     @if(canComplete(r)){
      <button type="button" gcButton [disabled]="actionBusy()" (click)="complete()">
       {{actionBusy()?'Guardando…':'Marcar entregada'}}</button>
     }
     @if(access.canManage()&&(r.estado==='PENDIENTE'||r.estado==='EN_REPARTO')&&!showCancel()){
      <button type="button" gcButton variant="outline" (click)="showCancel.set(true)">Cancelar entrega</button>
     }
    </div>
   </section>

   @if(showCancel()){
    <section class="del-card">
     <h2>Cancelar entrega</h2>
     <div class="del-field"><label for="del-cancel-motivo">Motivo (mínimo 5 caracteres)</label>
      <input id="del-cancel-motivo" [value]="cancelReason()" maxlength="500"
       (input)="cancelReason.set($any($event.target).value)"/>
     </div>
     <div class="del-actions">
      <button type="button" gcButton [disabled]="actionBusy()||cancelReason().trim().length<5"
       (click)="cancel()">{{actionBusy()?'Cancelando…':'Confirmar cancelación'}}</button>
      <button type="button" gcButton variant="outline" (click)="showCancel.set(false);cancelReason.set('')">Cerrar</button>
     </div>
    </section>
   }

   @if(access.canManage()&&r.estado==='ENTREGADA'&&readiness();as rdy){
    <section class="del-card">
     <h2>Cierre de la orden</h2>
     @if(rdy.alreadyClosed){<p class="del-muted">La orden ya está cerrada.</p>}
     @else if(rdy.canFinalize){
      <p class="del-muted">La entrega está completa y lista para cerrarse.</p>
      <div class="del-actions">
       <button type="button" gcButton [disabled]="actionBusy()" (click)="finalizeOrder()">
        {{actionBusy()?'Cerrando…':'Cerrar orden'}}</button>
      </div>
     }
     @else{
      <p class="del-muted">Faltan estos puntos antes de poder cerrar la orden:</p>
      <ul class="del-blockers">
       @for(b of rdy.blockers;track b){<li>{{blockerLabel(b)}}</li>}
      </ul>
     }
    </section>
   }

   @if(events().length){
    <section class="del-card">
     <h2>Historial</h2>
     <div class="del-timeline">
      @for(ev of events();track ev.id){
       <div class="del-timeline-item">
        <strong>{{eventLabel(ev.accion)}}</strong>
        <span class="del-muted">{{formatDate(ev.creadoEn)}}</span>
        @if(ev.motivo){<span class="del-muted">{{ev.motivo}}</span>}
       </div>
      }
     </div>
    </section>
   }
  }
 </main>`,
 styleUrl:'../delivery.scss'
})
export class GcDeliveryDetailPage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 protected readonly access=inject(DeliveryAccess);
 private readonly session=inject(GcSessionService);
 private readonly api=inject(DeliveryApi);
 private readonly users=inject(UsersApi);
 private readonly notice=inject(GcNotificationService);
 private readonly dialogs=inject(ConfirmDialogService);
 protected readonly row=signal<DeliveryRecord|null>(null);
 protected readonly loadError=signal<string|null>(null);
 protected readonly readiness=signal<ClosureReadiness|null>(null);
 protected readonly events=signal<DeliveryEvent[]>([]);
 protected readonly courierChoices=signal<GcSelectOption[]>([]);
 protected readonly courierBusy=signal(false);
 protected readonly actionBusy=signal(false);protected readonly actionError=signal('');
 protected readonly showCancel=signal(false);protected readonly cancelReason=signal('');
 private assignKey=crypto.randomUUID();private actionKey=crypto.randomUUID();private cancelKey=crypto.randomUUID();
 private readonly courierSearch=new Subject<string>();
 constructor(){
  this.courierSearch.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed()).subscribe(term=>{
   void this.loadCouriers(term);
  });
 }
 ngOnInit(){void this.load()}
 protected estadoLabel(estado:string){return DELIVERY_STATE_LABEL[estado as keyof typeof DELIVERY_STATE_LABEL]??estado}
 protected badgeClass(estado:string){return BADGE_CLASS[estado]??'del-state-badge--pending'}
 protected eventLabel(accion:string){return EVENT_LABEL[accion]??accion}
 protected blockerLabel(b:string){return CLOSURE_BLOCKER_LABEL[b as keyof typeof CLOSURE_BLOCKER_LABEL]??b}
 protected formatDate(value:string){return formatInstant(value,'America/Guatemala')}
 protected canDispatch(r:DeliveryRecord){
  return r.estado==='PENDIENTE'&&!!r.repartidorId&&this.canProgress(r);
 }
 protected canComplete(r:DeliveryRecord){
  return r.estado==='EN_REPARTO'&&this.canProgress(r);
 }
 private canProgress(r:DeliveryRecord){
  if(this.access.canManage())return true;
  return this.access.canCourier()&&r.repartidorId===this.session.user()?.id;
 }
 protected async load(){
  const id=this.route.snapshot.paramMap.get('id');if(!id)return;
  this.loadError.set(null);
  try{
   const r=await firstValueFrom(this.api.detail(id));
   this.row.set(r);
   const [events,readiness]=await Promise.all([
    firstValueFrom(this.api.events(id)).catch(()=>({data:[]})),
    this.access.canManage()&&r.estado==='ENTREGADA'?
     firstValueFrom(this.api.closureReadiness(id)).catch(()=>null):Promise.resolve(null),
   ]);
   this.events.set(events.data);this.readiness.set(readiness);
  }catch(e){this.loadError.set(gcErrorMessage(e))}
 }
 protected searchCouriers(term:string){this.courierSearch.next(term)}
 private async loadCouriers(term:string){
  const r=this.row();if(!r)return;
  this.courierBusy.set(true);
  try{
   const result=await firstValueFrom(this.users.options(
    {sucursalId:r.orden.sucursalId,purpose:'delivery.courier',search:term||undefined,limit:20}));
   this.courierChoices.set(result.data.map(u=>({id:u.id,label:u.label})));
  }catch{/* Leave previous choices; the select shows none found. */}
  finally{this.courierBusy.set(false)}
 }
 protected async assignCourier(repartidorId:string){
  const r=this.row();if(!r||!repartidorId||this.actionBusy())return;
  this.actionBusy.set(true);this.actionError.set('');
  try{
   const updated=await firstValueFrom(this.api.assign(r.id,{claveOperacion:this.assignKey,repartidorId}));
   this.row.set(updated);this.assignKey=crypto.randomUUID();
   this.notice.show('Repartidor asignado.','success');
  }catch(e){this.actionError.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
 protected async dispatch(){
  const r=this.row();if(!r||!this.canDispatch(r)||this.actionBusy())return;
  this.actionBusy.set(true);this.actionError.set('');
  try{
   const updated=await firstValueFrom(this.api.dispatch(r.id,{claveOperacion:this.actionKey}));
   this.row.set(updated);this.actionKey=crypto.randomUUID();
   this.notice.show('Entrega en camino.','success');
  }catch(e){this.actionError.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
 protected async complete(){
  const r=this.row();if(!r||!this.canComplete(r)||this.actionBusy())return;
  this.actionBusy.set(true);this.actionError.set('');
  try{
   const updated=await firstValueFrom(this.api.complete(r.id,{claveOperacion:this.actionKey}));
   this.row.set(updated);this.actionKey=crypto.randomUUID();
   this.notice.show('Entrega marcada como entregada.','success');
   if(this.access.canManage()){
    const readiness=await firstValueFrom(this.api.closureReadiness(r.id)).catch(()=>null);
    this.readiness.set(readiness);
    if(readiness?.canFinalize&&!readiness.alreadyClosed)
     this.notice.show('La orden ya puede cerrarse desde esta pantalla.','info');
   }
  }catch(e){this.actionError.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
 protected async finalizeOrder(){
  const r=this.row();if(!r||this.actionBusy())return;
  if(!await this.dialogs.confirm({title:'Cerrar orden',
   message:'Se liquidará la venta y se cerrarán las cuentas de la orden.',confirmText:'Cerrar orden'}))return;
  this.actionBusy.set(true);this.actionError.set('');
  try{
   const readiness=await firstValueFrom(this.api.finalizeOrder(r.id));
   this.readiness.set(readiness);
   this.notice.show('Orden cerrada.','success');
  }catch(e){this.actionError.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
 protected async cancel(){
  const r=this.row();
  if(!r||(r.estado!=='PENDIENTE'&&r.estado!=='EN_REPARTO')||this.actionBusy()||this.cancelReason().trim().length<5)return;
  if(!await this.dialogs.confirm({title:'Cancelar entrega',
   message:'La orden no debe tener pagos registrados.',confirmText:'Cancelar',danger:true}))return;
  this.actionBusy.set(true);this.actionError.set('');
  try{
   const updated=await firstValueFrom(this.api.cancel(r.id,
    {claveOperacion:this.cancelKey,motivo:this.cancelReason().trim()}));
   this.row.set(updated);this.cancelKey=crypto.randomUUID();
   this.notice.show('Entrega cancelada.','success');
   this.showCancel.set(false);this.cancelReason.set('');
  }catch(e){this.actionError.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
 hasUnsavedChanges(){return this.showCancel()&&!this.actionBusy()}
}
