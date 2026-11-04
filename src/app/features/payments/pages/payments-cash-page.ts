import {DatePipe} from '@angular/common';
import {Component,computed,effect,inject,signal,untracked} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPaymentsNav} from '../payments-nav';
import {GcPaymentsCashNav} from '../payments-cash-nav';
import {CashContext} from '../data-access/cash-context';
import {PaymentsApi} from '../data-access/payments.api';
import {PaymentsAccess} from '../data-access/payments-access';
import {cashBreakdown,cashMovementName,oldShiftWarning} from '../data-access/cash-presentation';
import {money,paymentError} from '../data-access/payments.helpers';
import type {CashShift} from '../data-access/payments.models';

@Component({
 selector:'gc-payments-cash-page',
 imports:[DatePipe,RouterLink,GcPaymentsNav,GcPaymentsCashNav],
 template:`
 <main class="ord-page pay-page pay-cash-page">
  <gc-payments-nav/>
  <gc-payments-cash-nav/>
  <div class="ord-heading">
   <h1>Mi caja</h1>
   <button type="button" (click)="reload()" [disabled]="busy()||cash.loading()">Actualizar</button>
  </div>
  @if(error()||cash.error()){<p class="ord-alert" role="alert">{{error()||cash.error()}}</p>}
  @if(busy()||cash.loading()){<p class="ord-note" role="status">Consultando tu caja…</p>}
  @if(cash.ownShift();as shift){
   <section class="ord-card pay-cash-hero">
    <div class="ord-heading">
     <div><h2>{{shift.caja?.nombre??registerName(shift.cajaId)}}</h2>
      <p class="ord-muted">Abierta desde {{shift.abiertaEn|date:'dd/MM/yyyy HH:mm'}}</p>
     </div>
     <span class="ord-status">Turno abierto</span>
    </div>
    @if(ownDetail();as detail){
     <div class="pay-cash-balance">
      <small>Efectivo que debe haber en caja</small>
      <strong>{{money(detail.efectivoCalculado??'0')}}</strong>
      <span>Calculado con las entradas y salidas registradas</span>
     </div>
     <div class="pay-cash-totals" aria-label="Detalle del efectivo">
      <div><span>Fondo inicial</span><strong>{{money(detail.fondoInicial)}}</strong></div>
      <div><span>Entradas de efectivo</span><strong>{{money(breakdown().income)}}</strong></div>
      <div><span>Salidas de efectivo</span><strong>{{money(breakdown().outflow)}}</strong></div>
     </div>
    } @else if(!busy()){
     <p class="ord-note">No se pudo consultar el saldo actual. Actualiza para obtener el importe real.</p>
    }
    @if(outdated()){
     <p class="pay-warn" role="status">
      Este turno corresponde a una fecha anterior. Antes de registrar nuevos cobros,
      revisa si debes cerrarlo y abrir uno nuevo.
     </p>
    }
    <div class="pay-cash-actions">
     <a class="ord-primary" [routerLink]="['/payments/cash/shift',shift.id]">Ver movimientos</a>
     @if(access.canClose()){
      <a [routerLink]="['/payments/cash/close']">Cerrar mi turno</a>
     }
     @if(access.canCashManage()){
      <a [routerLink]="['/payments/cash/movement']">Registrar entrada o salida</a>
     }
     @if(access.canCollect()){<a routerLink="/orders/list">Cobrar un pedido</a>}
    </div>
   </section>
  } @else if(!cash.loading()&&!busy()){
   <section class="ord-card pay-cash-empty">
    <h2>No tienes una caja abierta</h2>
    <p>Para cobrar pedidos, abre un turno en una caja disponible.</p>
    @if(access.canOpen()){
     <a class="ord-primary" routerLink="/payments/cash/open"
      [queryParams]="returnTo()?{volver:returnTo()}:{}">Abrir mi caja</a>
    } @else {<p>Solicita a un encargado que habilite tu turno.</p>}
   </section>
  }
  @if(returnTo()){
   <p><a [routerLink]="returnTo()">Volver al pedido pendiente de cobro</a></p>
  }
 </main>`
})
export class GcPaymentsCashPage{
 protected readonly cash=inject(CashContext);
 protected readonly access=inject(PaymentsAccess);
 private readonly api=inject(PaymentsApi);
 private readonly branch=inject(GcBranchContext);
 private readonly route=inject(ActivatedRoute);
 protected readonly money=money;
 protected readonly detail=signal<CashShift|null>(null);
 protected readonly busy=signal(false);
 protected readonly error=signal('');
 private generation=0;
 protected readonly ownDetail=computed(()=>{
  const d=this.detail();return d?.id===this.cash.ownShiftId()?d:null;
 });
 protected readonly breakdown=computed(()=>cashBreakdown(this.ownDetail()?.movimientoCajasComoTurno??[]));
 protected readonly outdated=computed(()=>oldShiftWarning(
  this.ownDetail()??this.cash.ownShift(),
  this.branch.active()?.zonaHoraria??'America/Guatemala'));
 protected readonly returnTo=computed(()=>{
  const path=this.route.snapshot.queryParamMap.get('volver')??'';
  return /^\/payments\/order\/[\w-]+$/.test(path)?path:'';
 });
 constructor(){
  effect(()=>{const id=this.branch.branchId();if(id)void untracked(()=>this.reload())});
 }
 protected registerName(id:string){return this.cash.registers().find(r=>r.id===id)?.nombre??'Caja'}
 protected async reload(){
  const gen=++this.generation;
  const branchId=this.branch.branchId();
  this.busy.set(true);this.error.set('');this.detail.set(null);
  try{
   await this.cash.refresh(true);
   if(gen!==this.generation||branchId!==this.branch.branchId())return;
   const id=this.cash.ownShiftId();
   if(id){
    const result=await firstValueFrom(this.api.shift(id));
    if(gen===this.generation&&branchId===this.branch.branchId())this.detail.set(result);
   }
  }catch(e){if(gen===this.generation)this.error.set(paymentError(e))}
  finally{if(gen===this.generation)this.busy.set(false)}
 }
}
