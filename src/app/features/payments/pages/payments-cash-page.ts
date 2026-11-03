import {Component,computed,effect,inject,signal} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcSessionService} from '../../../core/auth/gc-session.service';
import {GcPaymentsNav} from '../payments-nav';
import {CashContext} from '../data-access/cash-context';
import {PaymentsAccess} from '../data-access/payments-access';
import {PaymentsApi} from '../data-access/payments.api';
import {money,amount,positive,operationKey,paymentError} from '../data-access/payments.helpers';
import type {CashRegister,CashShift} from '../data-access/payments.models';
import {parseApiDecimal} from '../../../shared/formatting';
import {DatePipe} from '@angular/common';
@Component({
 selector:'gc-payments-cash-page',
 imports:[RouterLink,GcSearchSelect,GcPaymentsNav,DatePipe],
 template:`
 <main class="ord-page pay-page"><gc-payments-nav/>
 <div class="ord-heading"><h1>Caja y turnos</h1>
  <button type="button" (click)="refresh()" [disabled]="busy()||cash.loading()">Actualizar</button>
 </div>
 @if(error()||cash.error()){<p class="ord-alert" role="alert">{{error()||cash.error()}}</p>}
 @if(notice()){<p class="pay-success" role="status">{{notice()}}</p>}
 <section class="ord-card">
  <div class="ord-heading"><h2>Mi turno de caja</h2>
   <span class="ord-status">{{cash.ownShift()?'Turno abierto':'Sin turno abierto'}}</span>
  </div>
  @if(cash.loading()){<p role="status">Consultando cajas…</p>}
  @if(cash.ownShift();as shift){
   <div class="pay-summary">
    <div><small>Caja</small><strong>{{shift.caja?.nombre??registerName(shift.cajaId)}}</strong></div>
    <div><small>Fondo inicial</small><strong>{{money(shift.fondoInicial)}}</strong></div>
    <div><small>Desde</small><strong>{{shift.abiertaEn|date:'dd/MM/yyyy HH:mm'}}</strong></div>
   </div>
   <div class="ord-actions">
    <button type="button" (click)="viewShift(shift.id)" [disabled]="busy()">Ver movimientos</button>
    @if(access.canClose()){
     <button type="button" (click)="showClose.update(x=>!x)" [disabled]="busy()">Cerrar turno</button>
    }
   </div>
   @if(access.canCashManage()){
    <fieldset class="ord-section">
     <legend>Movimiento de efectivo</legend>
     <div class="pay-cash-form">
      <gc-search-select id="cash-movement-type" label="Operación" [items]="movementTypes"
       [value]="movementType()" [clearable]="false" [searchable]="false"
       (valueChange)="movementType.set($event==='EGRESO'?'EGRESO':'INGRESO')"/>
      <label>Importe
       <input inputmode="decimal" [value]="movementAmount()" placeholder="Ej. 20.00"
        (input)="movementAmount.set($any($event.target).value)"/>
      </label>
      <label>Motivo
       <input maxlength="500" [value]="movementReason()" placeholder="Ej. Cambio para caja"
        (input)="movementReason.set($any($event.target).value)"/>
      </label>
     </div>
     <button type="button" [disabled]="busy()||!positive(movementAmount())||movementReason().trim().length<5"
      (click)="moveCash()">Registrar movimiento</button>
    </fieldset>
   }
   @if(showClose()&&access.canClose()){
    <fieldset class="ord-section pay-cash-close">
     <legend>Arqueo y cierre</legend>
     <label>Efectivo contado físicamente
      <input inputmode="decimal" [value]="counted()" (input)="counted.set($any($event.target).value)"
       placeholder="Ej. 135.00"/>
     </label>
     <label>Nota del cierre (opcional)
      <textarea rows="2" maxlength="500" [value]="closingNote()"
       (input)="closingNote.set($any($event.target).value)"></textarea>
     </label>
     @if(detail()?.efectivoCalculado){
      <div class="pay-balance">
       <span>Esperado según caja</span><strong>{{money(detail()!.efectivoCalculado!)}}</strong>
      </div>
      @if(countedDifference();as diff){
       <p class="ord-note">Diferencia declarada: {{money(diff)}}</p>
      }
     }
     <p class="pay-warn">Cuenta el efectivo antes de cerrar. Al finalizar no podrás cobrar con este turno.</p>
     <div class="ord-actions">
      <button type="button" class="ord-primary" (click)="close()" [disabled]="busy()||amount(counted())===null">
       Confirmar cierre</button>
      <button type="button" (click)="showClose.set(false)">Volver</button>
     </div>
    </fieldset>
   }
  } @else if(access.canOpen()){
   <fieldset class="ord-section"><legend>Abrir mi caja</legend>
    <div class="pay-cash-form">
     <gc-search-select id="cash-select-register" label="Caja" [items]="availableRegisters()"
      [value]="registerId()" [clearable]="false" placeholder="Selecciona la caja"
      (valueChange)="registerId.set($event)"/>
     <label>Fondo inicial en efectivo
      <input inputmode="decimal" [value]="openingAmount()" placeholder="Ej. 100.00"
       (input)="openingAmount.set($any($event.target).value)"/>
     </label>
    </div>
    <button type="button" class="ord-primary" [disabled]="busy()||!registerId()||amount(openingAmount())===null"
     (click)="open()">Abrir turno</button>
    @if(!availableRegisters().length){<p class="ord-note">No hay cajas activas disponibles en esta sucursal.</p>}
   </fieldset>
  } @else {<p>No tienes un turno abierto. Solicita al responsable que habilite tu caja.</p>}
 </section>
 @if(detail();as shift){
  <section class="ord-card">
   <div class="ord-heading"><h2>Movimientos del turno</h2>
    <button type="button" (click)="viewShift(shift.id)" [disabled]="busy()">Actualizar</button>
   </div>
   <div class="pay-summary">
    <div><small>Fondo inicial</small><strong>{{money(shift.fondoInicial)}}</strong></div>
    <div><small>Efectivo calculado</small><strong>{{money(shift.efectivoCalculado??shift.fondoInicial)}}</strong></div>
   </div>
   <div class="pay-history">
    @for(move of shift.movimientoCajasComoTurno??[];track move.id){
     <div class="pay-history-row">
      <div><strong>{{move.tipo==='INGRESO'?'Entrada':'Salida'}} · {{move.motivo}}</strong>
       <small>{{move.creadoEn|date:'dd/MM/yyyy HH:mm'}}</small></div>
      <strong>{{money(move.monto)}}</strong>
     </div>
    } @empty {<p class="ord-muted">No hay movimientos registrados.</p>}
   </div>
  </section>
 }
 @if(access.canCashRead()){
 <section class="ord-card">
  <h2>Turnos recientes</h2>
  <div class="pay-history">
   @for(shift of cash.shifts();track shift.id){
    <div class="pay-history-row">
     <div><strong>{{shift.caja?.nombre??registerName(shift.cajaId)}}</strong>
      <small>{{shift.abiertaEn|date:'dd/MM/yyyy HH:mm'}} · {{shift.cerradaEn?'Cerrado':'Abierto'}}</small></div>
     <button type="button" (click)="viewShift(shift.id)" [disabled]="busy()">Ver turno</button>
    </div>
   } @empty {<p class="ord-muted">Aún no hay turnos.</p>}
  </div>
 </section>
 }
 @if(access.canCashManage()){
  <details class="ord-card pay-details">
   <summary>Administrar cajas</summary>
   @for(r of cash.registers();track r.id){
    <div class="pay-history-row">
     <div><strong>{{r.nombre}}</strong><small>{{r.codigo}} · {{r.activa?'Activa':'Inactiva'}}</small></div>
     <div class="ord-actions">
      <button type="button" (click)="editRegister(r)">Editar</button>
      <button type="button" [disabled]="busy()" (click)="toggleRegister(r)">
       {{r.activa?'Desactivar':'Activar'}}</button>
     </div>
    </div>
   }
   <fieldset class="ord-section">
    <legend>{{editingRegister()?'Editar caja':'Nueva caja'}}</legend>
    <div class="pay-cash-form">
     @if(!editingRegister()){
      <label>Código
       <input [value]="registerCode()" maxlength="40" placeholder="Ej. CAJA01"
        (input)="registerCode.set($any($event.target).value)"/>
      </label>
     }
     <label>Nombre
      <input [value]="registerNameValue()" maxlength="120" placeholder="Ej. Caja principal"
       (input)="registerNameValue.set($any($event.target).value)"/>
     </label>
    </div>
    <div class="ord-actions">
     <button type="button" [disabled]="busy()||registerNameValue().trim().length<2" (click)="saveRegister()">
      {{editingRegister()?'Guardar caja':'Crear caja'}}</button>
     @if(editingRegister()){
      <button type="button" (click)="editingRegister.set('');registerNameValue.set('')">Cancelar</button>
     }
    </div>
   </fieldset>
  </details>
 }
 @if(returnTo()){
  <div class="ord-actions pay-return"><a [routerLink]="returnTo()"
   class="ord-primary">Volver al cobro del pedido</a></div>
 }
 </main>`
})
export class GcPaymentsCashPage{
 private readonly api=inject(PaymentsApi);
 private readonly branch=inject(GcBranchContext);
 private readonly session=inject(GcSessionService);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly route=inject(ActivatedRoute);
 protected readonly cash=inject(CashContext);
 protected readonly access=inject(PaymentsAccess);
 protected readonly money=money;protected readonly amount=amount;protected readonly positive=positive;
 protected readonly returnTo=computed(()=>{
  const path=this.route.snapshot.queryParamMap.get('volver');
  return path?.startsWith('/payments/order/')?path:'';
 });
 protected readonly busy=signal(false);protected readonly error=signal('');protected readonly notice=signal('');
 protected readonly detail=signal<CashShift|null>(null);protected readonly showClose=signal(false);
 protected readonly counted=signal('');protected readonly closingNote=signal('');
 protected readonly registerId=signal('');protected readonly openingAmount=signal('0.00');
 protected readonly movementType=signal<'INGRESO'|'EGRESO'>('INGRESO');
 protected readonly movementTypes=[{id:'INGRESO',label:'Entrada de efectivo'},{id:'EGRESO',label:'Salida de efectivo'}];
 protected readonly movementAmount=signal('');protected readonly movementReason=signal('');
 protected readonly editingRegister=signal('');protected readonly registerCode=signal('');
 protected readonly registerNameValue=signal('');
 protected readonly availableRegisters=computed(()=>this.cash.registers().filter(x=>x.activa)
  .map(x=>({id:x.id,label:x.nombre})));
 protected readonly countedDifference=computed(()=>{
  const n=amount(this.counted()),expected=this.detail()?.efectivoCalculado;
  return n&&expected?parseApiDecimal(n).minus(parseApiDecimal(expected)).toFixed(2):'';
 });
 private key:{signature:string;value:string}|null=null;
 constructor(){
  effect(()=>{const b=this.branch.branchId();if(b)void this.refresh()});
 }
 private idem(action:string,payload:unknown){
  const signature=action+':'+JSON.stringify(payload);
  if(this.key?.signature!==signature)this.key={signature,value:operationKey(action)};
  return this.key.value;
 }
 protected registerName(id:string){return this.cash.registers().find(x=>x.id===id)?.nombre??'Caja'}
 protected async refresh(){
  this.error.set('');
  await this.cash.refresh(true);
  const id=this.cash.ownShiftId();
  if(id)await this.viewShift(id);
  else this.detail.set(null);
 }
 protected async viewShift(id:string){
  try{this.detail.set(await firstValueFrom(this.api.shift(id)))}
  catch(e){this.error.set(paymentError(e))}
 }
 private async work(action:()=>Promise<unknown>,message:string){
  if(this.busy())return false;
  this.busy.set(true);this.error.set('');this.notice.set('');
  try{await action();this.key=null;await this.refresh();this.notice.set(message);return true}
  catch(e){this.error.set(paymentError(e));return false}
  finally{this.busy.set(false)}
 }
 protected async open(){
  if(!this.registerId()||amount(this.openingAmount())===null)return;
  const body={cajaId:this.registerId(),fondoInicial:amount(this.openingAmount())!};
  if(!await this.dialog.confirm({title:'Abrir turno de caja',
   message:'¿Empezar a trabajar con '+money(body.fondoInicial)+' de fondo?',confirmText:'Abrir'}))return;
  const key=this.idem('shift-open',body);
  await this.work(()=>firstValueFrom(this.api.openShift({...body,claveOperacion:key})),'Tu turno de caja está abierto.');
 }
 protected async moveCash(){
  const shift=this.cash.ownShift(),n=positive(this.movementAmount()),reason=this.movementReason().trim();
  if(!shift||!n||reason.length<5)return;
  const body={tipo:this.movementType(),monto:n,motivo:reason};
  if(!await this.dialog.confirm({title:body.tipo==='INGRESO'?'Registrar entrada':'Registrar salida',
   message:'¿Registrar '+money(n)+' en movimientos de caja?',confirmText:'Registrar'}))return;
  const key=this.idem('cash-movement',{shiftId:shift.id,...body});
  const ok=await this.work(()=>firstValueFrom(this.api.movement(shift.id,{...body,claveOperacion:key})),
   'Movimiento registrado.');
  if(ok){this.movementAmount.set('');this.movementReason.set('')}
 }
 protected async close(){
  const shift=this.cash.ownShift(),counted=amount(this.counted());if(!shift||!counted)return;
  const body={efectivoContado:counted,...(this.closingNote().trim()?{notaCierre:this.closingNote().trim()}:{})};
  if(!await this.dialog.confirm({title:'Cerrar turno',
   message:'El turno terminará y el efectivo contado quedará registrado. ¿Confirmar?',
   confirmText:'Cerrar turno'}))return;
  const key=this.idem('shift-close',{shiftId:shift.id,...body});
  const ok=await this.work(()=>firstValueFrom(this.api.closeShift(shift.id,{...body,claveOperacion:key})),
   'Turno cerrado. El arqueo quedó registrado.');
  if(ok){this.showClose.set(false);this.counted.set('');await this.viewShift(shift.id)}
 }
 protected editRegister(r:CashRegister){this.editingRegister.set(r.id);this.registerNameValue.set(r.nombre)}
 protected async toggleRegister(r:CashRegister){
  if(r.activa&&!await this.dialog.confirm({title:'Desactivar caja',
   message:'Una caja con turno abierto no puede desactivarse.',confirmText:'Desactivar',danger:true}))return;
  await this.work(()=>firstValueFrom(this.api.updateRegister(r.id,{activa:!r.activa})),
   'Estado de caja actualizado.');
 }
 protected async saveRegister(){
  const name=this.registerNameValue().trim(),branch=this.branch.branchId();
  if(!branch||name.length<2)return;
  const id=this.editingRegister();
  if(!id&&!/^[A-Z0-9_-]{2,40}$/.test(this.registerCode().trim().toUpperCase())){
   this.error.set('El código debe tener de 2 a 40 letras, números, guiones o guion bajo.');return;
  }
  const ok=await this.work(()=>firstValueFrom(id
   ?this.api.updateRegister(id,{nombre:name})
   :this.api.createRegister({sucursalId:branch,codigo:this.registerCode().trim().toUpperCase(),nombre:name})),
   'Caja guardada.');
  if(ok){this.editingRegister.set('');this.registerNameValue.set('');this.registerCode.set('')}
 }
}
