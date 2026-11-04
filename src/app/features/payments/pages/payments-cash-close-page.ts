import {DatePipe} from '@angular/common';
import {Component,computed,effect,inject,signal,untracked} from '@angular/core';
import {Router,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcPaymentsNav} from '../payments-nav';
import {CashContext} from '../data-access/cash-context';
import {PaymentsAccess} from '../data-access/payments-access';
import {PaymentsApi} from '../data-access/payments.api';
import {money,amount,operationKey,paymentError} from '../data-access/payments.helpers';
import {cashBreakdown,oldShiftWarning} from '../data-access/cash-presentation';
import type {CashShift} from '../data-access/payments.models';
import {parseApiDecimal} from '../../../shared/formatting';

@Component({
 selector:'gc-payments-cash-close-page',
 imports:[DatePipe,RouterLink,GcPaymentsNav],
 template:`<main class="ord-page pay-page pay-cash-task">
  <gc-payments-nav/>
  <a routerLink="/payments/cash">← Mi caja</a>
  <section class="ord-card pay-cash-task-card">
   <h1>Cerrar turno</h1>
   @if(error()||cash.error()){<p role="alert" class="ord-alert">{{error()||cash.error()}}</p>}
   @if(busy()||cash.loading()){<p role="status">Calculando el cierre…</p>}
   @if(!access.canClose()){<p>No tienes autorización para cerrar turnos.</p>}
   @else if(cash.ownShift();as current){
    @if(shift();as s){
     <div class="ord-heading">
      <div><h2>{{s.caja?.nombre??'Caja'}}</h2>
       <p class="ord-muted">Abierta el {{s.abiertaEn|date:'dd/MM/yyyy HH:mm'}}</p></div>
      <span class="ord-status">Turno abierto</span>
     </div>
     <div class="pay-cash-balance">
      <small>Efectivo esperado al cerrar</small>
      <strong>{{money(s.efectivoCalculado!)}}</strong>
      <span>Calculado automáticamente según los movimientos del turno</span>
     </div>
     <div class="pay-cash-totals">
      <div><span>Fondo inicial</span><strong>{{money(s.fondoInicial)}}</strong></div>
      <div><span>Entradas</span><strong>{{money(breakdown().income)}}</strong></div>
      <div><span>Salidas</span><strong>{{money(breakdown().outflow)}}</strong></div>
     </div>
     @if(outdated()){
      <p class="pay-warn">Este turno corresponde a una fecha anterior. Puedes cerrarlo,
       pero podrían existir restricciones para realizar cobros nuevos.</p>
     }
     <fieldset class="ord-section">
      <legend>Verificar el efectivo</legend>
      <label>¿Cuánto efectivo contaste físicamente?
       <input inputmode="decimal" autocomplete="off" [value]="counted()"
        [disabled]="working()" placeholder="Importe contado, en quetzales"
        (input)="counted.set($any($event.target).value)"/>
      </label>
      @if(difference();as d){
       <p class="pay-cash-difference" role="status">
        @if(d==='0.00'){El efectivo coincide con el saldo esperado.}
        @else if(parseDiff(d)>0){Sobran {{money(d)}} respecto al saldo esperado.}
        @else {Faltan {{money(absDiff(d))}} respecto al saldo esperado.}
       </p>
      }
      <label>Observación del cierre (opcional)
       <textarea rows="2" maxlength="500" [value]="notes()"
        (input)="notes.set($any($event.target).value)"
        placeholder="Ej. Se comprobó el efectivo con el encargado"></textarea>
      </label>
     </fieldset>
     <p class="ord-note">El importe esperado es fijo. La cantidad contada sirve
      para registrar faltantes o sobrantes, no para cambiar ventas ni salidas.</p>
     <div class="ord-actions">
      <button type="button" class="ord-primary" [disabled]="working()||busy()||amount(counted())===null"
       (click)="close()">Confirmar cierre</button>
      <a routerLink="/payments/cash">Cancelar</a>
     </div>
    } @else if(!busy()){
     <p>El saldo de caja no está disponible. Actualiza antes de cerrar el turno.</p>
     <button type="button" (click)="refresh()">Actualizar saldo</button>
    }
   } @else if(!busy()&&!cash.loading()){
    <p>No tienes un turno abierto que debas cerrar.</p>
    <a routerLink="/payments/cash">Ir a Mi caja</a>
   }
  </section>
 </main>`
})
export class GcPaymentsCashClosePage{
 private readonly branch=inject(GcBranchContext);
 private readonly api=inject(PaymentsApi);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly router=inject(Router);
 protected readonly cash=inject(CashContext);
 protected readonly access=inject(PaymentsAccess);
 protected readonly money=money;protected readonly amount=amount;
 protected readonly shift=signal<CashShift|null>(null);
 protected readonly counted=signal('');
 protected readonly notes=signal('');
 protected readonly working=signal(false);
 protected readonly busy=signal(false);
 protected readonly error=signal('');
 private generation=0;
 private signature='';private key='';
 protected readonly breakdown=computed(()=>cashBreakdown(this.shift()?.movimientoCajasComoTurno??[]));
 protected readonly outdated=computed(()=>oldShiftWarning(
  this.shift(),this.branch.active()?.zonaHoraria??'America/Guatemala'));
 protected readonly difference=computed(()=>{
  const a=amount(this.counted()),expected=this.shift()?.efectivoCalculado;
  return a!==null&&expected!==undefined&&expected!==null
   ?parseApiDecimal(a).minus(parseApiDecimal(expected)).toFixed(2):'';
 });
 protected readonly parseDiff=(v:string)=>Number(v);
 protected readonly absDiff=(v:string)=>parseApiDecimal(v).abs().toFixed(2);
 constructor(){effect(()=>{if(this.branch.branchId())void untracked(()=>this.refresh())})}
 protected async refresh(){
  const gen=++this.generation,branch=this.branch.branchId();
  this.busy.set(true);this.error.set('');this.shift.set(null);
  try{
   await this.cash.refresh(true);
   if(gen!==this.generation||branch!==this.branch.branchId())return;
   const id=this.cash.ownShiftId();
   if(id){
    const data=await firstValueFrom(this.api.shift(id));
    if(gen===this.generation&&branch===this.branch.branchId())this.shift.set(data);
   }
  }catch(e){if(gen===this.generation)this.error.set(paymentError(e))}
  finally{if(gen===this.generation)this.busy.set(false)}
 }
 protected async close(){
  if(this.working()||!this.access.canClose())return;
  const current=this.cash.ownShift(),s=this.shift(),a=amount(this.counted());
  if(!current||!s||current.id!==s.id||!a||!s.efectivoCalculado)return;
  const diff=this.difference();
  const message=diff==='0.00'
   ?'¿Cerrar el turno? El efectivo contado coincide con lo esperado.'
   : '¿Cerrar el turno con una diferencia de '+money(diff)+'? La diferencia quedará registrada.';
  if(!await this.dialog.confirm({title:'Confirmar cierre de caja',message,
   confirmText:'Cerrar turno',danger:diff!=='0.00'}))return;
  const body={efectivoContado:a,...(this.notes().trim()?{notaCierre:this.notes().trim()}:{})};
  const sig=JSON.stringify({shiftId:s.id,...body});
  if(sig!==this.signature){this.signature=sig;this.key=operationKey('cash-close')}
  this.working.set(true);this.error.set('');
  try{
   await firstValueFrom(this.api.closeShift(s.id,{...body,claveOperacion:this.key}));
   this.signature='';this.key='';
   await this.router.navigate(['/payments/cash/shift',s.id,'receipt']);
  }catch(e){this.error.set(paymentError(e))}
  finally{this.working.set(false)}
 }
}
