import {DatePipe} from '@angular/common';
import {Component,effect,inject,signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPaymentsNav} from '../payments-nav';
import {PaymentsApi} from '../data-access/payments.api';
import {PaymentsAccess} from '../data-access/payments-access';
import {money,paymentError} from '../data-access/payments.helpers';
import type {SaleRecord} from '../data-access/payments.models';
@Component({
 selector:'gc-payments-sales-page',imports:[DatePipe,RouterLink,GcPaymentsNav],
 template:`
 <main class="ord-page pay-page"><gc-payments-nav/>
 <div class="ord-heading"><h1>Ventas</h1>
  <button type="button" (click)="load()" [disabled]="busy()">Actualizar</button>
 </div>
 <section class="ord-card">
  @if(error()){<p class="ord-alert" role="alert">{{error()}}</p>}
  @if(busy()){<p role="status">Consultando ventas…</p>}
  <div class="ord-table-wrap">
   <table class="ord-table">
    <thead><tr><th>Venta</th><th>Fecha</th><th>Total</th><th>Acción</th></tr></thead>
    <tbody>
     @for(s of sales();track s.id){
      <tr><td><strong>{{s.numero}}</strong></td>
       <td>{{s.cerradaEn|date:'dd/MM/yyyy HH:mm'}}</td>
       <td>{{money(s.total)}}</td>
       <td><button type="button" (click)="inspect(s.id)" [disabled]="busy()">Ver detalle</button></td>
      </tr>
     } @empty {<tr><td colspan="4">No hay ventas finalizadas en esta sucursal.</td></tr>}
    </tbody>
   </table>
  </div>
  <div class="ord-pagination">
   <span>{{total()}} ventas · Página {{page()}} de {{pages()||1}}</span>
   <div class="ord-actions">
    <button type="button" [disabled]="page()<=1||busy()" (click)="change(-1)">Anterior</button>
    <button type="button" [disabled]="page()>=pages()||busy()" (click)="change(1)">Siguiente</button>
   </div>
  </div>
 </section>
 @if(selected();as sale){
  <section class="ord-card">
   <div class="ord-heading"><h2>Venta {{sale.numero}}</h2>
    <button type="button" (click)="selected.set(null)">Cerrar detalle</button></div>
   <div class="pay-summary">
    <div><small>Fecha</small><strong>{{sale.cerradaEn|date:'dd/MM/yyyy HH:mm'}}</strong></div>
    <div><small>Total</small><strong>{{money(sale.total)}}</strong></div>
    <div><small>Descuento</small><strong>{{money(sale.descuentoTotal)}}</strong></div>
   </div>
   @for(line of sale.ventaLineasComoVenta??[];track line.id){
    <div class="pay-detail-row"><span>{{line.nombreSnapshot??'Producto'}} · {{line.cantidad}}</span>
     <strong>{{money(line.subtotal)}}</strong>
    </div>
   }
   @if(sale.cuenta?.orden?.id){<a [routerLink]="['/orders/list',sale.cuenta?.orden?.id]">
    Ver pedido original</a>}
  </section>
 }
 </main>`
})
export class GcPaymentsSalesPage{
 private readonly api=inject(PaymentsApi);private readonly branch=inject(GcBranchContext);
 private readonly access=inject(PaymentsAccess);
 protected readonly money=money;
 protected readonly sales=signal<SaleRecord[]>([]);
 protected readonly selected=signal<SaleRecord|null>(null);
 protected readonly page=signal(1);protected readonly total=signal(0);protected readonly pages=signal(0);
 protected readonly busy=signal(false);protected readonly error=signal('');
 private generation=0;
 constructor(){effect(()=>{if(this.branch.branchId()){this.page.set(1);this.selected.set(null);void this.load()}})}
 protected change(d:number){this.page.update(v=>v+d);void this.load()}
 protected async load(){
  const branch=this.branch.branchId();if(!branch||!this.access.canSalesRead())return;
  const gen=++this.generation;this.busy.set(true);this.error.set('');
  try{const data=await firstValueFrom(this.api.sales(branch,this.page(),20));
   if(gen!==this.generation||branch!==this.branch.branchId())return;
   this.sales.set(data.data);this.total.set(data.meta.total);this.pages.set(data.meta.totalPages);
  }catch(e){if(gen===this.generation)this.error.set(paymentError(e))}
  finally{if(gen===this.generation)this.busy.set(false)}
 }
 protected async inspect(id:string){
  this.error.set('');
  try{this.selected.set(await firstValueFrom(this.api.sale(id)))}
  catch(e){this.error.set(paymentError(e))}
 }
}
