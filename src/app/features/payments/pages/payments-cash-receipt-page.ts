import {DatePipe} from '@angular/common';
import {Component,computed,inject,OnInit,signal} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPaymentsNav} from '../payments-nav';
import {PaymentsApi} from '../data-access/payments.api';
import {PaymentsAccess} from '../data-access/payments-access';
import {cashBreakdown} from '../data-access/cash-presentation';
import {money,paymentError} from '../data-access/payments.helpers';
import type {CashShift} from '../data-access/payments.models';
import {parseApiDecimal} from '../../../shared/formatting';

@Component({
 selector:'gc-payments-cash-receipt-page',
 imports:[DatePipe,RouterLink,GcPaymentsNav],
 template:`
 <main class="ord-page pay-page pay-cash-task pay-cash-receipt-page">
  <gc-payments-nav/>
  <div class="ord-heading pay-cash-receipt-controls">
   <a routerLink="/payments/cash/history">← Historial de turnos</a>
   @if(receipt()){<button type="button" (click)="print()">Imprimir comprobante</button>}
  </div>
  @if(error()){<p class="ord-alert" role="alert">{{error()}}</p>}
  @if(busy()){<p role="status">Consultando comprobante…</p>}
  @if(receipt();as shift){
   <article class="ord-card pay-cash-receipt" aria-label="Comprobante interno de cierre de caja">
    <header>
     <span class="pay-sale-caption">Gastro Core · Control de efectivo</span>
     <h1>Comprobante de cierre</h1>
     <p>{{branch.active()?.nombre??'Sucursal'}} · {{shift.caja?.nombre??'Caja'}}</p>
     <p>Turno finalizado el {{shift.cerradaEn|date:'dd/MM/yyyy HH:mm'}}</p>
    </header>
    <div class="pay-cash-balance">
     <small>Efectivo esperado</small>
     <strong>{{money(shift.efectivoEsperado??shift.efectivoCalculado??'0')}}</strong>
    </div>
    <section class="pay-cash-receipt-values" aria-label="Conciliación del turno">
     <div><span>Fondo inicial</span><strong>{{money(shift.fondoInicial)}}</strong></div>
     <div><span>Entradas registradas</span><strong>{{money(breakdown().income)}}</strong></div>
     <div><span>Salidas registradas</span><strong>{{money(breakdown().outflow)}}</strong></div>
     <div class="pay-cash-receipt-total">
      <span>Contado físicamente</span><strong>{{money(shift.efectivoContado??'0')}}</strong>
     </div>
     <div class="pay-cash-receipt-total">
      <span>Diferencia</span>
      <strong>{{money(shift.diferencia??'0')}}</strong>
     </div>
    </section>
    @if(parseApiDecimalSafe(shift.diferencia)){
     <p class="pay-warn">
      @if(parseApiDecimalPositive(shift.diferencia)){Sobró efectivo en el arqueo.}
      @else {Faltó efectivo en el arqueo.}
     </p>
    } @else {
     <p class="pay-success">El dinero contado coincide con el saldo esperado.</p>
    }
    @if(shift.notaCierre){<div class="pay-cash-receipt-note">
     <strong>Observación</strong><p>{{shift.notaCierre}}</p>
    </div>}
    <footer>
     <p>Comprobante interno de control de caja. No es factura ni documento tributario.</p>
     <p>El efectivo contado no se transfiere automáticamente al turno siguiente.</p>
    </footer>
   </article>
   <div class="ord-actions pay-cash-receipt-controls">
    <a [routerLink]="['/payments/cash/shift',shift.id]">Ver movimientos</a>
    <a class="ord-primary" routerLink="/payments/cash">Volver a mi caja</a>
   </div>
  } @else if(!busy()&&!error()){
   <section class="ord-card">
    <p>El comprobante estará disponible cuando se cierre el turno.</p>
    <a routerLink="/payments/cash">Volver a mi caja</a>
   </section>
  }
 </main>`
})
export class GcPaymentsCashReceiptPage implements OnInit{
 private readonly route=inject(ActivatedRoute);
 private readonly api=inject(PaymentsApi);
 protected readonly branch=inject(GcBranchContext);
 private readonly access=inject(PaymentsAccess);
 protected readonly money=money;
 protected readonly receipt=signal<CashShift|null>(null);
 protected readonly busy=signal(false);
 protected readonly error=signal('');
 protected readonly breakdown=computed(()=>cashBreakdown(
  this.receipt()?.movimientoCajasComoTurno??[]));
 protected readonly parseApiDecimalSafe=(v:string|null|undefined)=>
  !!v&&!parseApiDecimal(v).isZero();
 protected readonly parseApiDecimalPositive=(v:string|null|undefined)=>
  !!v&&parseApiDecimal(v).gt(0);
 ngOnInit(){void this.load()}
 private async load(){
  if(!this.access.canCashRead())return;
  const id=this.route.snapshot.paramMap.get('id');if(!id)return;
  this.busy.set(true);this.error.set('');
  try{
   const value=await firstValueFrom(this.api.shift(id));
   if(value.caja?.sucursalId!==this.branch.branchId()){
    this.error.set('El turno pertenece a otra sucursal.');return;
   }
   if(value.cerradaEn)this.receipt.set(value);
  }catch(e){this.error.set(paymentError(e))}
  finally{this.busy.set(false)}
 }
 protected print(){window.print()}
}
