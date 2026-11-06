import {Component,effect,inject,signal,untracked} from '@angular/core';
import {Router,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcPaymentsNav} from '../payments-nav';
import {CashContext} from '../data-access/cash-context';
import {PaymentsApi} from '../data-access/payments.api';
import {PaymentsAccess} from '../data-access/payments-access';
import {money,positive,operationKey,paymentError} from '../data-access/payments.helpers';
@Component({
 selector:'gc-payments-cash-movement-page',
 imports:[RouterLink,GcSearchSelect,GcPaymentsNav],
 template:`<main class="ord-page pay-page pay-cash-task">
  <gc-payments-nav/>
  <a routerLink="/payments/cash">← Mi caja</a>
  <section class="ord-card pay-cash-task-card">
   <h1>Registrar efectivo</h1>
   @if(error()||cash.error()){<p class="ord-alert" role="alert">{{error()||cash.error()}}</p>}
   @if(cash.ownShift();as shift){
    <p class="ord-muted">{{shift.caja?.nombre??'Caja activa'}}</p>
    @if(access.canCashManage()){
     <fieldset class="ord-section">
      <legend>Movimiento de caja</legend>
      <gc-search-select id="cash-operation" label="Operación"
       [items]="types" [value]="kind()" [clearable]="false" [searchable]="false"
       (valueChange)="setKind($event)"/>
      <label>Importe en efectivo
       <input inputmode="decimal" [value]="value()" placeholder="Ej. 10.00"
        [disabled]="busy()" (input)="value.set($any($event.target).value)"/>
      </label>
      <label>¿Por qué se {{kind()==='EGRESO'?'retira':'ingresa'}}?
       <input [value]="reason()" maxlength="500"
        [placeholder]="kind()==='EGRESO'?'Ej. Compra menor de insumos':'Ej. Cambio inicial adicional'"
        [disabled]="busy()" (input)="reason.set($any($event.target).value)"/>
      </label>
     </fieldset>
     <p class="ord-note">
      Este registro mueve efectivo físicamente. Las ventas cobradas ya se registran al cobrar;
      no vuelvas a ingresarlas aquí.
     </p>
     <div class="ord-actions">
      <button type="button" class="ord-primary" [disabled]="busy()||!positive(value())||reason().trim().length<5"
       (click)="save()">Registrar {{kind()==='EGRESO'?'salida':'entrada'}}</button>
      <a routerLink="/payments/cash">Cancelar</a>
     </div>
    } @else {<p>No tienes permiso para registrar movimientos manuales.</p>}
   } @else {
    <p>Abre tu turno de caja antes de registrar movimientos.</p>
    <a routerLink="/payments/cash">Volver a mi caja</a>
   }
  </section>
 </main>`
})
export class GcPaymentsCashMovementPage{
 private readonly branch=inject(GcBranchContext);
 private readonly api=inject(PaymentsApi);
 private readonly router=inject(Router);
 private readonly dialog=inject(ConfirmDialogService);
 protected readonly cash=inject(CashContext);
 protected readonly access=inject(PaymentsAccess);
 protected readonly positive=positive;
 protected readonly types=[{id:'INGRESO',label:'Entrada de efectivo'},
  {id:'EGRESO',label:'Salida de efectivo'}];
 protected readonly kind=signal<'INGRESO'|'EGRESO'>('INGRESO');
 protected readonly value=signal('');
 protected readonly reason=signal('');
 protected readonly busy=signal(false);
 protected readonly error=signal('');
 private signature='';private key='';
 constructor(){effect(()=>{if(this.branch.branchId())void untracked(()=>this.cash.refresh(true))})}
 protected setKind(v:string){this.kind.set(v==='INGRESO'?'INGRESO':'EGRESO')}
 protected async save(){
  const shift=this.cash.ownShift(),a=positive(this.value()),why=this.reason().trim();
  if(!this.access.canCashManage()||!shift||this.busy()||!a||why.length<5)return;
  if(!await this.dialog.confirm({title:'Confirmar movimiento',
   message:(this.kind()==='EGRESO'?'¿Registrar una salida de ':'¿Registrar una entrada de ')+money(a)+'?',
   confirmText:'Registrar'}))return;
  const body={tipo:this.kind(),monto:a,motivo:why};
  const sig=JSON.stringify({shiftId:shift.id,...body});
  if(sig!==this.signature){this.signature=sig;this.key=operationKey('cash-movement')}
  this.busy.set(true);this.error.set('');
  try{
   await firstValueFrom(this.api.movement(shift.id,{...body,claveOperacion:this.key}));
   this.key='';this.signature='';await this.router.navigate(['/payments/cash/shift',shift.id]);
  }catch(e){this.error.set(paymentError(e))}
  finally{this.busy.set(false)}
 }
}
