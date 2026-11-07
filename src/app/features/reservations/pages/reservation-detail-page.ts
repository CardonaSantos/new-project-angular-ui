
import {Component,inject,OnInit,signal} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {formatInstant} from '../../../shared/formatting';
import {ReservationsApi} from '../data-access/reservations.api';
import {ReservationsAccess} from '../data-access/reservations-access';
import type {ReservationDetail,ReservationState} from '../data-access/reservations.models';

const ESTADO_LABEL:Record<ReservationState,string>={
 PENDIENTE:'Pendiente',CONFIRMADA:'Confirmada',CANCELADA:'Cancelada',
 COMPLETADA:'Completada',NO_ASISTIO:'No asistió',
};

@Component({
 selector:'gc-reservation-detail-page',
 imports:[RouterLink,GcPageHeader,GcButtonDirective,GcErrorState],
 template:`
 <div class="rsv-page rsv-narrow">
  <gc-page-header [title]="reservation()?.nombreContacto??'Reservación'"/>
  @if(loadError()){<gc-error-state [message]="loadError()!" (retry)="load()"/>}
  @else if(reservation();as r){
   <section class="rsv-card">
    <div class="rsv-row"><h2>Detalle</h2>
     <span class="rsv-state-badge" [class]="badgeClass(r.estado)">{{estadoLabel(r.estado)}}</span></div>
    <dl class="rsv-kv">
     <div><dt>Teléfono</dt><dd>{{r.telefonoContacto??'—'}}</dd></div>
     <div><dt>Email</dt><dd>{{r.emailContacto??'—'}}</dd></div>
     <div><dt>Personas</dt><dd>{{r.personas}}</dd></div>
     <div><dt>Inicio</dt><dd>{{formatInstant(r.inicio,zone())}}</dd></div>
     <div><dt>Fin</dt><dd>{{formatInstant(r.fin,zone())}}</dd></div>
     <div><dt>Fase</dt><dd>{{r.faseAtencion}}</dd></div>
     @if(r.clienteId){<div><dt>Cliente</dt><dd><a [routerLink]="['/customers',r.clienteId]">Ver cliente</a></dd></div>}
    </dl>
    <p class="rsv-muted">{{r.notas??'Sin notas.'}}</p>
    @if(error()){<p class="rsv-alert" role="alert">{{error()}}</p>}
    @if(canManage()){
     <div class="rsv-actions">
      @if(isEditable(r.estado)){
       <a gcButton variant="outline" [routerLink]="['/reservations',r.id,'edit']">Editar</a>
      }
      @if(r.estado==='PENDIENTE'){
       <button type="button" gcButton [disabled]="action.busy()" (click)="confirm()">
        {{action.busy()?'Confirmando…':'Confirmar'}}</button>
      }
      @if(canCheckIn(r)){
       <button type="button" gcButton [disabled]="action.busy()" (click)="checkIn()">
        {{action.busy()?'Registrando…':'Registrar llegada'}}</button>
      }
      @if(isEditable(r.estado)&&!cancelling()&&!markingNoShow()){
       <button type="button" gcButton variant="outline" (click)="startCancel()">Cancelar</button>
       <button type="button" gcButton variant="outline" (click)="startNoShow()">No asistió</button>
      }
     </div>
    }
    @if(cancelling()){
     <div class="rsv-field"><label for="rd-cancel-motivo">Motivo de cancelación (mínimo 5 caracteres)</label>
      <input id="rd-cancel-motivo" [value]="motivo()" (input)="motivo.set($any($event.target).value)" maxlength="500"/>
     </div>
     <div class="rsv-actions">
      <button type="button" gcButton [disabled]="motivo().trim().length<5||action.busy()" (click)="confirmCancel()">
       {{action.busy()?'Cancelando…':'Confirmar cancelación'}}</button>
      <button type="button" gcButton variant="outline" (click)="cancelDialogState()">Cerrar</button>
     </div>
    }
    @if(markingNoShow()){
     <div class="rsv-field"><label for="rd-noshow-motivo">Motivo (mínimo 5 caracteres)</label>
      <input id="rd-noshow-motivo" [value]="motivo()" (input)="motivo.set($any($event.target).value)" maxlength="500"/>
     </div>
     <div class="rsv-actions">
      <button type="button" gcButton [disabled]="motivo().trim().length<5||action.busy()" (click)="confirmNoShow()">
       {{action.busy()?'Guardando…':'Confirmar no asistió'}}</button>
      <button type="button" gcButton variant="outline" (click)="cancelDialogState()">Cerrar</button>
     </div>
    }
   </section>

   @if(r.mesas.length){
    <section class="rsv-card">
     <h2>Mesas asignadas</h2>
     <p class="rsv-muted">Capacidad asignada: {{r.capacidadAsignada}}</p>
     <ul class="rsv-timeline">
      @for(m of r.mesas;track m.id){<li>{{m.sala.nombre}} · Mesa {{m.numero}} ({{m.capacidad}})</li>}
     </ul>
    </section>
   }

   <section class="rsv-card">
    <h2>Historial</h2>
    @if(r.eventos.length===0){<p class="rsv-muted">Sin eventos registrados.</p>}
    @else{
     <ul class="rsv-timeline">
      @for(ev of r.eventos;track ev.id){
       <li><strong>{{ev.tipo}}</strong> — {{formatInstant(ev.creadoEn,zone())}}
        @if(ev.detalle){<p class="rsv-muted">{{ev.detalle}}</p>}
       </li>
      }
     </ul>
    }
   </section>
  }
 </div>`,
 styleUrl:'../reservations.scss'
})
export class GcReservationDetailPage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 private readonly branch=inject(GcBranchContext);
 private readonly api=inject(ReservationsApi);
 private readonly access=inject(ReservationsAccess);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 protected readonly reservation=signal<ReservationDetail|null>(null);
 protected readonly loadError=signal<string|null>(null);
 protected readonly error=signal<string|null>(null);
 protected readonly action=new GcConfirmedAction();
 protected readonly cancelling=signal(false);
 protected readonly markingNoShow=signal(false);
 protected readonly motivo=signal('');
 protected readonly formatInstant=formatInstant;
 private get id(){return this.route.snapshot.paramMap.get('id')??''}

 protected canManage(){return this.access.canManage()}
 protected zone(){
  const r=this.reservation();
  return this.branch.branches().find(b=>b.id===r?.sucursalId)?.zonaHoraria??'America/Guatemala';
 }
 protected estadoLabel(estado:ReservationState){return ESTADO_LABEL[estado]}
 protected badgeClass(estado:ReservationState){
  return {
   PENDIENTE:'rsv-state-badge--pending',CONFIRMADA:'rsv-state-badge--confirmed',
   COMPLETADA:'rsv-state-badge--done',CANCELADA:'rsv-state-badge--cancelled',
   NO_ASISTIO:'rsv-state-badge--noshow',
  }[estado];
 }
 protected isEditable(estado:ReservationState){return estado==='PENDIENTE'||estado==='CONFIRMADA'}
 protected canCheckIn(r:ReservationDetail){
  if(r.estado!=='CONFIRMADA'&&r.estado!=='PENDIENTE')return false;
  const start=new Date(r.inicio).getTime(),end=new Date(r.fin).getTime(),now=Date.now();
  return now>=start-30*60000&&now<=end;
 }

 async ngOnInit(){await this.load()}
 protected async load(){
  this.loadError.set(null);
  try{
   const r=await firstValueFrom(this.api.detail(this.id));
   this.reservation.set(r);
  }catch(e){this.loadError.set(gcErrorMessage(e))}
 }

 protected async confirm(){
  const r=this.reservation();if(!r||this.action.busy())return;
  this.error.set(null);
  const res=await this.action.runConfirmed(this.dialog,{
   title:'Confirmar reservación',message:'¿Confirmar esta reservación?',confirmText:'Confirmar'},
   ()=>firstValueFrom(this.api.confirm(r.id)));
  if(!res)return;
  if(!res.ok){if(res.reason==='error')this.error.set(gcErrorMessage(res.error));return}
  this.reservation.set(res.value);
  this.notices.show('Reservación confirmada.','success');
 }
 protected async checkIn(){
  const r=this.reservation();if(!r||this.action.busy())return;
  this.error.set(null);
  const res=await this.action.runConfirmed(this.dialog,{
   title:'Registrar llegada',message:'¿Registrar la llegada de esta reservación?',confirmText:'Registrar'},
   ()=>firstValueFrom(this.api.checkIn(r.id)));
  if(!res)return;
  if(!res.ok){if(res.reason==='error')this.error.set(gcErrorMessage(res.error));return}
  this.reservation.set(res.value);
  this.notices.show('Llegada registrada.','success');
 }
 protected startCancel(){this.motivo.set('');this.error.set(null);this.cancelling.set(true);this.markingNoShow.set(false)}
 protected startNoShow(){this.motivo.set('');this.error.set(null);this.markingNoShow.set(true);this.cancelling.set(false)}
 protected cancelDialogState(){this.cancelling.set(false);this.markingNoShow.set(false);this.motivo.set('');this.error.set(null)}
 protected async confirmCancel(){
  const r=this.reservation();if(!r||this.motivo().trim().length<5||this.action.busy())return;
  this.error.set(null);
  const res=await this.action.runConfirmed(this.dialog,{
   title:'Cancelar reservación',message:'¿Cancelar esta reservación?',confirmText:'Cancelar',danger:true},
   ()=>firstValueFrom(this.api.cancel(r.id,{motivo:this.motivo().trim()})));
  if(!res)return;
  if(!res.ok){if(res.reason==='error')this.error.set(gcErrorMessage(res.error));return}
  this.reservation.set(res.value);this.cancelling.set(false);
  this.notices.show('Reservación cancelada.','success');
 }
 protected async confirmNoShow(){
  const r=this.reservation();if(!r||this.motivo().trim().length<5||this.action.busy())return;
  this.error.set(null);
  const res=await this.action.runConfirmed(this.dialog,{
   title:'Marcar no asistió',message:'¿Marcar esta reservación como no asistió?',confirmText:'Confirmar',danger:true},
   ()=>firstValueFrom(this.api.noShow(r.id,{motivo:this.motivo().trim()})));
  if(!res)return;
  if(!res.ok){if(res.reason==='error')this.error.set(gcErrorMessage(res.error));return}
  this.reservation.set(res.value);this.markingNoShow.set(false);
  this.notices.show('Reservación marcada como no asistió.','success');
 }
 hasUnsavedChanges(){return (this.cancelling()||this.markingNoShow())&&!this.action.busy()}
}
