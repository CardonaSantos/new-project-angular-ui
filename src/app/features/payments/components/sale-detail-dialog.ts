import {DatePipe} from '@angular/common';
import {Component,inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {MAT_DIALOG_DATA,MatDialogModule} from '@angular/material/dialog';
import {money} from '../data-access/payments.helpers';
import type {SaleRecord} from '../data-access/payments.models';

@Component({
 selector:'gc-sale-detail-dialog',
 imports:[DatePipe,MatDialogModule,RouterLink],
 template:`
 <div class="pay-sale-detail" role="document">
  <div class="pay-sale-detail-head">
   <div><p class="pay-sale-caption">Detalle de venta</p>
    <h2 mat-dialog-title>{{data.numero}}</h2>
   </div>
   <button type="button" aria-label="Cerrar detalle de venta" mat-dialog-close>✕</button>
  </div>
  <mat-dialog-content class="pay-sale-dialog-content">
   <div class="pay-summary">
    <div><small>Fecha</small><strong>{{data.cerradaEn|date:'dd/MM/yyyy HH:mm'}}</strong></div>
    <div><small>Total cobrado</small><strong>{{money(data.total)}}</strong></div>
    <div><small>Descuento aplicado</small><strong>{{money(data.descuentoTotal)}}</strong></div>
   </div>
   @if(data.cuenta?.orden?.numero){
    <p class="pay-sale-order">Pedido asociado: <strong>{{data.cuenta?.orden?.numero}}</strong></p>
   }
   <h3>Productos vendidos</h3>
   <div class="pay-sale-lines">
    @for(line of data.ventaLineasComoVenta??[];track line.id){
     <div class="pay-sale-line">
      <div><strong>{{line.descripcion}}</strong>
       <small>{{line.cantidad}} × {{money(line.precioUnitario)}}</small>
       @if(line.descuento&&line.descuento!=='0.00'){
        <small>Descuento: {{money(line.descuento)}}</small>
       }
      </div>
      <strong>{{money(line.subtotal)}}</strong>
     </div>
    } @empty {<p>No hay productos para mostrar.</p>}
   </div>
   <div class="pay-total-row"><span>Total</span><strong>{{money(data.total)}}</strong></div>
  </mat-dialog-content>
  <mat-dialog-actions align="end">
   @if(data.cuenta?.orden?.id){
    <a [routerLink]="['/orders/list',data.cuenta?.orden?.id]"
      mat-dialog-close>Ver pedido</a>
   }
   <button type="button" mat-dialog-close>Volver a ventas</button>
  </mat-dialog-actions>
 </div>`
})
export class GcSaleDetailDialog{
 protected readonly data=inject<SaleRecord>(MAT_DIALOG_DATA);
 protected readonly money=money;
}
