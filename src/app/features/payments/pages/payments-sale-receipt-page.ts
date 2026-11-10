import {Component,inject,signal,effect,untracked} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcBrandingService} from '../../../core/branding/gc-branding.service';
import {BranchesApi} from '../../organization/data-access/organization-api';
import {PaymentsApi} from '../data-access/payments.api';
import {PaymentsAccess} from '../data-access/payments-access';
import {paymentError} from '../data-access/payments.helpers';
import type {SaleRecord} from '../data-access/payments.models';
import {formatInstant} from '../../../shared/formatting';
import {thermalAmount,saleForBranch} from '../../orders/printing/thermal-print.helpers';
@Component({
 selector:'gc-payments-sale-receipt-page',
 imports:[RouterLink],
 template:`
 <main class="gc-thermal-page">
  <header class="gc-thermal-controls">
   <a routerLink="/payments/sales">← Ventas</a>
   <div class="gc-thermal-toolbar">
    <span>Rollo térmico · 80 mm</span>
    <button type="button" [disabled]="busy()||!sale()"
     (click)="print()">Imprimir comprobante</button>
   </div>
  </header>
  @if(busy()){<p role="status">Cargando venta cerrada…</p>}
  @if(error()){<p role="alert" class="gc-thermal-error">{{error()}}</p>}
  @if(sale();as item){
   <article class="gc-thermal-paper" aria-label="Comprobante interno de venta">
    <header class="gc-thermal-head">
     <strong class="gc-thermal-brand">{{branding.name()}}</strong>
     <span>{{branch.active()?.nombre??'Sucursal'}}</span>
     <span>COMPROBANTE DE VENTA</span>
     <span class="gc-thermal-muted">Documento interno · No fiscal</span>
    </header>
    <section class="gc-thermal-divider">
     <div><span>Venta</span><strong>{{item.numero}}</strong></div>
     @if(item.cuenta?.orden?.numero){
      <div><span>Orden</span><span>{{item.cuenta?.orden?.numero}}</span></div>
     }
     @if(item.cuenta?.orden?.cliente){
      <div><span>Cliente</span><strong>{{item.cuenta?.orden?.cliente?.nombre}}</strong></div>
     }
     <div><span>Fecha</span><span>{{time(item.cerradaEn)}}</span></div>
     @if(!currency()){
      <p class="gc-thermal-notice">No se pudo verificar la moneda de la sucursal. Valores sin símbolo.</p>
     }
    </section>
    <section class="gc-thermal-lines" aria-label="Productos vendidos">
     @for(line of item.ventaLineasComoVenta??[];track line.id){
      <div class="gc-thermal-line">
       <strong>{{line.descripcion}}</strong>
       <div><span>{{line.cantidad}} × {{money(line.precioUnitario)}}</span>
        <strong>{{money(line.subtotal)}}</strong></div>
       @if(line.descuento&&line.descuento!=='0.00'){
        <small>Descuento: {{money(line.descuento)}}</small>
       }
      </div>
     }@empty{<p>No se encontraron líneas de venta.</p>}
    </section>
    <section class="gc-thermal-total gc-thermal-divider">
     @if(item.descuentoTotal!=='0.00'){
      <div><span>Descuentos</span><strong>{{money(item.descuentoTotal)}}</strong></div>
     }
     <div class="gc-thermal-big"><strong>TOTAL</strong><strong>{{money(item.total)}}</strong></div>
    </section>
    <footer class="gc-thermal-foot">
     <p>Gracias por su compra.</p>
     <p>Este comprobante interno no es factura electrónica ni documento tributario.</p>
     <p>Para devoluciones, indique el número de venta.</p>
    </footer>
   </article>
  }@else if(!busy()&&!error()){
   <p class="gc-thermal-error">No se encontró una venta cerrada para imprimir.</p>
  }
 </main>`
})
export class GcPaymentsSaleReceiptPage{
 private readonly route=inject(ActivatedRoute);
 private readonly api=inject(PaymentsApi);
 private readonly branchesApi=inject(BranchesApi);
 protected readonly branch=inject(GcBranchContext);
 protected readonly branding=inject(GcBrandingService);
 private readonly access=inject(PaymentsAccess);
 protected readonly sale=signal<SaleRecord|null>(null);
 protected readonly currency=signal<string|null>(null);
 protected readonly busy=signal(false);
 protected readonly error=signal('');
 protected readonly money=(amount:string)=>thermalAmount(amount,this.currency());
 private generation=0;
 constructor(){
  effect(()=>{
   const branchId=this.branch.branchId();
   untracked(()=>{this.generation++;this.sale.set(null);this.currency.set(null);
    if(branchId)void this.load(branchId);
   });
  });
 }
 protected time(instant:string):string{
  try{return formatInstant(instant,this.branch.active()?.zonaHoraria??'America/Guatemala')}
  catch{return instant}
 }
 protected async load(branchId:string){
  if(!this.access.canSalesRead()){
   this.error.set('Se requiere permiso para consultar ventas cerradas.');return;
  }
  const id=this.route.snapshot.paramMap.get('id');
  if(!id)return;
  const gen=++this.generation;this.busy.set(true);this.error.set('');
  try{
   const result=await firstValueFrom(this.api.sale(id));
   if(gen!==this.generation||branchId!==this.branch.branchId())return;
   if(!saleForBranch(result,branchId)){
    this.error.set('La venta pertenece a otra sucursal.');return;
   }
   this.sale.set(result);
   try{
    const config=await firstValueFrom(this.branchesApi.config(branchId));
    if(gen===this.generation)this.currency.set(config.moneda);
   }catch{
    // Sale remains printable as a documented non-fiscal record without guessing currency.
   }
  }catch(e){if(gen===this.generation)this.error.set(paymentError(e))}
  finally{if(gen===this.generation)this.busy.set(false)}
 }
 protected print(){if(this.sale())window.print()}
}
