import {Component,effect,inject,signal} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPaymentsNav} from '../payments-nav';
import {PaymentsApi} from '../data-access/payments.api';
import {PaymentsAccess} from '../data-access/payments-access';
import {money,paymentError} from '../data-access/payments.helpers';
import type {PaymentSummary} from '../data-access/payments.models';
import {methodLabel} from '../data-access/payments.models';
@Component({
 selector:'gc-payments-report-page',imports:[GcPaymentsNav],
 template:`
 <main class="ord-page pay-page"><gc-payments-nav/>
  <div class="ord-heading"><h1>Resumen de cobros</h1>
   <button type="button" (click)="load()" [disabled]="busy()">Actualizar</button></div>
  @if(error()){<p class="ord-alert" role="alert">{{error()}}</p>}
  @if(busy()){<p role="status">Consultando resumen…</p>}
  @if(summary();as data){
   <section class="ord-card">
    <div class="pay-summary">
     <div><small>Cobrado neto</small><strong>{{money(data.cobradoNeto)}}</strong></div>
     <div><small>Ventas</small><strong>{{data.cantidadVentas}}</strong></div>
     <div><small>Total de ventas</small><strong>{{money(data.ventasInternas)}}</strong></div>
     <div><small>Devoluciones</small><strong>{{money(data.reembolsado)}}</strong></div>
    </div>
   </section>
   <section class="ord-card">
    <h2>Cobros por método</h2>
    @for(item of data.porMetodo;track item.metodo){
     <div class="pay-history-row">
      <div><strong>{{methodLabel(item.metodo)}}</strong>
       <small>{{item.cantidad}} operaciones</small></div>
      <strong>{{money(item.total)}}</strong>
     </div>
    } @empty {<p class="ord-empty">Sin cobros registrados.</p>}
   </section>
   <section class="ord-card">
    <h2>Control de caja</h2>
    <div class="pay-summary">
     <div><small>Turnos cerrados</small><strong>{{data.turnosCerrados}}</strong></div>
     <div><small>Diferencia acumulada</small><strong>{{money(data.cajaDiferenciaAcumulada)}}</strong></div>
     <div><small>Cobrado bruto</small><strong>{{money(data.cobradoBruto)}}</strong></div>
    </div>
   </section>
  }
 </main>`
})
export class GcPaymentsReportPage{
 private readonly api=inject(PaymentsApi);private readonly branch=inject(GcBranchContext);
 private readonly access=inject(PaymentsAccess);
 protected readonly money=money;protected readonly methodLabel=methodLabel;
 protected readonly summary=signal<PaymentSummary|null>(null);
 protected readonly busy=signal(false);protected readonly error=signal('');
 private generation=0;
 constructor(){effect(()=>{if(this.branch.branchId())void this.load()})}
 protected async load(){
  const branch=this.branch.branchId();if(!branch||!this.access.canCashRead())return;
  const gen=++this.generation;this.busy.set(true);this.error.set('');
  try{const r=await firstValueFrom(this.api.summary(branch));
   if(gen!==this.generation||branch!==this.branch.branchId())return;this.summary.set(r);
  }catch(e){if(gen===this.generation)this.error.set(paymentError(e))}
  finally{if(gen===this.generation)this.busy.set(false)}
 }
}
