import {DatePipe} from '@angular/common';
import {Component,effect,inject,signal,untracked} from '@angular/core';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPaymentsNav} from '../payments-nav';
import {GcPaymentsCashNav} from '../payments-cash-nav';
import {PaymentsApi} from '../data-access/payments.api';
import {PaymentsAccess} from '../data-access/payments-access';
import {money,paymentError} from '../data-access/payments.helpers';
import type {CashShift} from '../data-access/payments.models';
@Component({
 selector:'gc-payments-cash-history-page',
 imports:[DatePipe,RouterLink,GcPaymentsNav,GcPaymentsCashNav],
 template:`<main class="ord-page pay-page pay-cash-page">
  <gc-payments-nav/><gc-payments-cash-nav/>
  <div class="ord-heading"><h1>Historial de turnos</h1>
   <button type="button" (click)="load()" [disabled]="busy()">Actualizar</button>
  </div>
  <section class="ord-card">
   @if(error()){<p role="alert" class="ord-alert">{{error()}}</p>}
   @if(busy()){<p role="status">Consultando turnos…</p>}
   <div class="pay-cash-history">
    @for(s of shifts();track s.id){
     <div class="pay-cash-ledger-row">
      <div><strong>{{s.caja?.nombre??'Caja'}}</strong>
       <small>{{s.abiertaEn|date:'dd/MM/yyyy HH:mm'}} · {{s.cerradaEn?'Cerrado':'Abierto'}}</small>
       <small>Fondo inicial: {{money(s.fondoInicial)}}</small></div>
      <a [routerLink]="['/payments/cash/shift',s.id]">Ver movimientos</a>
     </div>
    } @empty {
     @if(!busy()){<p class="ord-muted">No hay turnos registrados.</p>}
    }
   </div>
   <div class="ord-pagination">
    <span>{{total()}} turnos · Página {{page()}} de {{pages()||1}}</span>
    <div class="ord-actions">
     <button type="button" (click)="change(-1)" [disabled]="page()<=1||busy()">Anterior</button>
     <button type="button" (click)="change(1)" [disabled]="page()>=pages()||busy()">Siguiente</button>
    </div>
   </div>
  </section>
 </main>`
})
export class GcPaymentsCashHistoryPage{
 private readonly branch=inject(GcBranchContext);
 private readonly api=inject(PaymentsApi);
 protected readonly access=inject(PaymentsAccess);
 protected readonly money=money;
 protected readonly shifts=signal<CashShift[]>([]);
 protected readonly page=signal(1);protected readonly pages=signal(0);protected readonly total=signal(0);
 protected readonly busy=signal(false);protected readonly error=signal('');
 private generation=0;
 constructor(){effect(()=>{if(this.branch.branchId()){this.page.set(1);void untracked(()=>this.load())}})}
 protected change(n:number){this.page.update(v=>v+n);void this.load()}
 protected async load(){
  const branch=this.branch.branchId();if(!branch||!this.access.canCashRead())return;
  const gen=++this.generation;
  this.busy.set(true);this.error.set('');
  try{
   const result=await firstValueFrom(this.api.shifts(branch,this.page(),20));
   if(gen!==this.generation||branch!==this.branch.branchId())return;
   this.shifts.set(result.data);this.total.set(result.meta.total);this.pages.set(result.meta.totalPages);
  }catch(e){if(gen===this.generation)this.error.set(paymentError(e))}
  finally{if(gen===this.generation)this.busy.set(false)}
 }
}
