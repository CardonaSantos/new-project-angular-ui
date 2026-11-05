import {Component,computed,input,output} from '@angular/core';
import {DatePipe} from '@angular/common';
import type {CatalogProjectedItem} from '../../catalog/data-access/catalog.models';
import type {KitchenTicket,OrderLineModifier,OrderState,TicketState} from '../data-access/orders.models';
import {kitchenReadyAt,kitchenStage,money,qtyText,statusText} from '../data-access/orders.helpers';
import type {PosCartEntry} from './pos-cart.models';
import {parseApiDecimal} from '../../../shared/formatting';

/** Modifier snapshots are saved with each order line; render them without any catalog lookups. */
@Component({
 selector:'gc-kitchen-modifiers',
 template:`
 @if(modifiers()?.length){
  <div class="ord-kitchen-modifiers">
   <span class="ord-kitchen-modifiers-title">Personalización</span>
   <ul>
    @for(mod of modifiers()??[];track mod.id){
     <li>@if(mod.cantidad>1){<strong>{{mod.cantidad}} × </strong>}{{mod.nombreSnapshot}}</li>
    }
   </ul>
  </div>
 }`
})
export class GcKitchenModifiers {
 readonly modifiers=input<readonly OrderLineModifier[]|undefined>([]);
}

/** Interactive product choice, optimized for mouse and touch. */
@Component({
 selector:'gc-pos-product',template:`
 <button class="ord-product" type="button" [class.ord-product--compact]="compact()"
  [title]="item().variante.producto?.nombre??item().variante.nombre"
  (click)="choose.emit(item())">
  @if(!compact()){
   @if(item().variante.imagenPrincipalUrl){<img [src]="item().variante.imagenPrincipalUrl" alt="" loading="lazy"/>}
   @else {<span class="ord-photo-empty" aria-hidden="true">☕</span>}
  }
  <span class="ord-product-name">{{item().variante.producto?.nombre??item().variante.nombre}}</span>
  <small>{{item().variante.nombre}}</small>
  <strong>{{money(item().precio,item().moneda)}}</strong>
 </button>`
})
export class GcPosProduct {
 readonly item=input.required<CatalogProjectedItem>();
 readonly compact=input(false);
 readonly choose=output<CatalogProjectedItem>();
 protected readonly money=money;
}

@Component({
 selector:'gc-pos-cart',template:`
 <section class="ord-cart" aria-label="Productos por agregar">
  <h2>Pedido actual <small>{{units()}} unidades · {{items().length}} líneas</small></h2>
  <div class="ord-cart-lines">
   @for(item of items();track item.key){
    <div class="ord-cart-item">
     <div class="ord-cart-line">
      <strong [title]="item.name">{{item.name}}</strong>
      <span>{{lineTotal(item)}}</span>
     </div>
     <small>{{item.variant}}</small>
     @if(item.extras.length){<small class="ord-cart-modifiers">{{item.extras.join(', ')}}</small>}
     @if(item.notes){<small>Nota: {{item.notes}}</small>}
     <div class="ord-cart-buttons">
      <button type="button" [attr.aria-label]="'Quitar una unidad de '+item.name"
       [disabled]="disabled()" (click)="quantity.emit({key:item.key,delta:-1})">−</button>
      <span aria-live="polite">{{item.quantity}}</span>
      <button type="button" [attr.aria-label]="'Agregar una unidad de '+item.name"
       [disabled]="disabled()||item.quantity>=999" (click)="quantity.emit({key:item.key,delta:1})">+</button>
      <button type="button" class="ord-link" [disabled]="disabled()"
       [attr.aria-label]="'Quitar línea de '+item.name" (click)="remove.emit(item.key)">Quitar</button>
     </div>
    </div>
   } @empty {<p class="ord-muted">Elige productos para empezar.</p>}
  </div>
 </section>`
})
export class GcPosCart{
 readonly items=input.required<PosCartEntry[]>();
 readonly disabled=input(false);
 readonly quantity=output<{key:string;delta:number}>();
 readonly remove=output<string>();
 protected readonly units=computed(()=>this.items().reduce((sum,item)=>sum+item.quantity,0));
 protected readonly lineTotal=(item:PosCartEntry)=>money(
  parseApiDecimal(item.price).mul(item.quantity).minus(parseApiDecimal(item.discount||'0')).toFixed(2),
  item.currency);
}

@Component({
 selector:'gc-order-status',template:`
  <span class="ord-status" [class.ord-status--ready]="state()==='LISTA'||state()==='CERRADA'"
   [class.ord-status--warning]="state()==='PENDIENTE'||state()==='ABIERTA'"
   [class.ord-status--cancel]="state()==='CANCELADA'">
   {{label()||statusText(state())}}
  </span>`
})
export class GcOrderStatus{
 readonly state=input.required<OrderState|TicketState>();
 readonly label=input('');
 protected readonly statusText=statusText;
}

@Component({
 selector:'gc-kitchen-ticket',imports:[DatePipe,GcKitchenModifiers],template:`
 <article class="ord-ticket" [class.ord-ticket--delivered]="stage().kind==='delivered'"
   [class.ord-ticket--cancelled]="stage().kind==='cancelled'">
  <button class="ord-ticket-open" type="button" (click)="open.emit()"
   [attr.aria-label]="'Ver detalle de comanda '+ticket().numero"></button>
  <div class="ord-ticket-head">
   <div><strong>Comanda {{ticket().numero}}</strong>
    <small>Pedido {{ticket().orden?.numero}}</small></div>
   <span class="ord-ticket-badge" [class.ord-ticket-badge--ready]="stage().kind==='ready'"
     [class.ord-ticket-badge--delivered]="stage().kind==='delivered'"
     [class.ord-ticket-badge--cancelled]="stage().kind==='cancelled'"
     [class.ord-ticket-badge--working]="stage().kind==='working'">{{stage().label}}</span>
  </div>
  <small>{{ticket().estacion?.nombre??'Cocina'}} · {{ticket().orden?.ocupacionMesa?.mesa?.numero?
    'Mesa '+ticket().orden?.ocupacionMesa?.mesa?.numero:'Sin mesa'}}</small>
  <small class="ord-ticket-time">
   @if(ticket().estado==='LISTA'){Lista desde {{readyAt()|date:'HH:mm'}}}
   @else {Pedido recibido {{ticket().enviadaEn|date:'HH:mm'}}}
   · Hace {{ageMinutes()}} min
  </small>
  <div class="ord-ticket-items">
   @for(line of ticket().comandaLineasComoComanda;track line.id){
    @if(!line.canceladaEn){
     <div class="ord-kitchen-line">
      <strong>{{qtyText(line.cantidad)}} × {{line.ordenLinea?.nombreSnapshot??
       line.ordenLinea?.variante?.producto?.nombre??'Producto'}}</strong>
      <gc-kitchen-modifiers [modifiers]="line.ordenLinea?.ordenLineaModificadoresComoOrdenLinea"/>
      @if(line.ordenLinea?.notasCocina){<small>Nota: {{line.ordenLinea?.notasCocina}}</small>}
      @if(line.entregadaEn){<small>Entregada</small>}
      @else if(line.listaEn){<small>Lista para entregar</small>}
     </div>
    }
   }
  </div>
  <div class="ord-ticket-actions"><ng-content/></div>
 </article>`
})
export class GcKitchenTicket{
 readonly ticket=input.required<KitchenTicket>();
 readonly now=input(Date.now());
 protected readonly ageMinutes=computed(()=>{
  const ts=Date.parse(this.ticket().enviadaEn);
  return Number.isFinite(ts)?Math.max(0,Math.floor((this.now()-ts)/60000)):0;
 });
 readonly open=output<void>();
 protected readonly qtyText=qtyText;
 protected readonly stage=computed(()=>kitchenStage(this.ticket()));
 protected readonly readyAt=computed(()=>kitchenReadyAt(this.ticket()));
}
