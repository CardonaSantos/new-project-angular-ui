import {DatePipe} from '@angular/common';
import {Component,computed,inject,OnInit,signal} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPaymentsNav} from '../payments-nav';
import {GcPaymentsCashNav} from '../payments-cash-nav';
import {CashContext} from '../data-access/cash-context';
import {PaymentsApi} from '../data-access/payments.api';
import {PaymentsAccess} from '../data-access/payments-access';
import {cashBreakdown,cashMovementName} from '../data-access/cash-presentation';
import {money,paymentError} from '../data-access/payments.helpers';
import type {CashShift} from '../data-access/payments.models';
@Component({
 selector:'gc-payments-cash-shift-page',
 imports:[DatePipe,RouterLink,GcPaymentsNav,GcPaymentsCashNav],
 template:`<main class="ord-page pay-page pay-cash-page">
  <gc-payments-nav/><gc-payments-cash-nav/>
  <div class="ord-heading">
   <div><a routerLink="/payments/cash/history">← Historial de turnos</a>
    <h1>Movimientos del turno</h1></div>
   <button type="button" (click)="load()" [disabled]="busy()">Actualizar</button>
  </div>
  @if(error()){<p role="alert" class="ord-alert">{{error()}}</p>}
  @if(busy()){<p role="status">Consultando movimientos…</p>}
  @if(detail();as shift){
   <section class="ord-card">
    <div class="ord-heading">
     <div><h2>{{shift.caja?.nombre??'Caja'}}</h2>
      <p class="ord-muted">Desde {{shift.abiertaEn|date:'dd/MM/yyyy HH:mm'}}</p></div>
     <span class="ord-status">{{shift.cerradaEn?'Cerrado':'Abierto'}}</span>
    </div>
    <div class="pay-cash-balance">
     <small>{{shift.cerradaEn?'Saldo calculado al cierre':'Efectivo esperado en caja'}}</small>
     <strong>{{money(shift.efectivoCalculado??'0')}}</strong>
     <span>Fondo inicial + ingresos de efectivo − salidas de efectivo</span>
    </div>
    <div class="pay-cash-totals">
     <div><span>Fondo inicial</span><strong>{{money(shift.fondoInicial)}}</strong></div>
     <div><span>Entradas</span><strong>{{money(breakdown().income)}}</strong></div>
     <div><span>Salidas</span><strong>{{money(breakdown().outflow)}}</strong></div>
    </div>
    @if(shift.cerradaEn){
     <div class="pay-cash-reconciliation">
      <div><span>Contado al cierre</span><strong>{{money(shift.efectivoContado??'0')}}</strong></div>
      <div><span>Diferencia</span><strong>{{money(shift.diferencia??'0')}}</strong></div>
     </div>
    } @else if(isOwnShift()&&access.canCashManage()){
     <div class="ord-actions">
      <a class="ord-primary" routerLink="/payments/cash/movement">Registrar entrada o salida</a>
      @if(access.canClose()){<a routerLink="/payments/cash/close">Cerrar turno</a>}
     </div>
    }
   </section>
   <section class="ord-card">
    <div class="ord-heading"><h2>Entradas y salidas</h2>
     <span class="ord-muted">{{(shift.movimientoCajasComoTurno??[]).length}} movimientos</span></div>
    <div class="pay-cash-ledger">
     @for(m of shift.movimientoCajasComoTurno??[];track m.id){
      <div class="pay-cash-ledger-row">
       <div><strong>{{movementTitle(m)}}</strong>
        <small>{{m.motivo}}</small>
        <small>{{m.creadoEn|date:'dd/MM/yyyy HH:mm'}}</small>
       </div>
       <strong [class.pay-cash-out]="m.tipo==='EGRESO'">
        {{m.tipo==='EGRESO'?'−':'+'}}{{money(m.monto)}}
       </strong>
      </div>
     } @empty {<p class="ord-muted">Este turno todavía no tiene movimientos.</p>}
    </div>
   </section>
  }
 </main>`
})
export class GcPaymentsCashShiftPage implements OnInit{
 private readonly route=inject(ActivatedRoute);
 private readonly api=inject(PaymentsApi);
 private readonly branch=inject(GcBranchContext);
 protected readonly cash=inject(CashContext);
 protected readonly access=inject(PaymentsAccess);
 protected readonly money=money;protected readonly movementTitle=cashMovementName;
 protected readonly detail=signal<CashShift|null>(null);
 protected readonly busy=signal(false);protected readonly error=signal('');
 protected readonly breakdown=computed(()=>cashBreakdown(this.detail()?.movimientoCajasComoTurno??[]));
 protected readonly isOwnShift=computed(()=>this.detail()?.id===this.cash.ownShiftId());
 ngOnInit(){void this.load()}
 protected async load(){
  const id=this.route.snapshot.paramMap.get('id');
  if(!id||!this.access.canCashRead())return;
  this.error.set('');this.busy.set(true);this.detail.set(null);
  try{
   await this.cash.refresh(true);
   const value=await firstValueFrom(this.api.shift(id));
   if(value.caja?.sucursalId!==this.branch.branchId()){
    this.error.set('El turno seleccionado pertenece a otra sucursal.');return;
   }
   this.detail.set(value);
  }catch(e){this.error.set(paymentError(e))}
  finally{this.busy.set(false)}
 }
}
