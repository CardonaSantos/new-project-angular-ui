import {Component,input,output} from '@angular/core';
import type {CatalogProjectedItem} from '../../catalog/data-access/catalog.models';
import type {KitchenTicket,OrderState,TicketState} from '../data-access/orders.models';
import {money,qtyText,statusText} from '../data-access/orders.helpers';
import type {PosCartEntry} from './pos-cart.models';

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
 <section class="ord-cart" aria-label="Pedido actual">
  <h2>Pedido actual <small>{{items().length}} productos</small></h2>
  @for(item of items();track item.key){
   <div class="ord-cart-item">
    <div class="ord-cart-line">
     <strong [title]="item.name">{{item.name}}</strong>
     <span>{{money(item.price,item.currency)}}</span>
    </div>
    <small>{{item.variant}}</small>
    @if(item.extras.length){<small>{{item.extras.join(', ')}}</small>}
    @if(item.notes){<small>Nota: {{item.notes}}</small>}
    <div class="ord-cart-buttons">
     <button type="button" [attr.aria-label]="'Quitar una unidad de '+item.name"
      (click)="quantity.emit({key:item.key,delta:-1})">−</button>
     <span aria-live="polite">{{item.quantity}}</span>
     <button type="button" [attr.aria-label]="'Agregar una unidad de '+item.name"
      (click)="quantity.emit({key:item.key,delta:1})">+</button>
     <button type="button" class="ord-link" (click)="remove.emit(item.key)">Quitar</button>
    </div>
   </div>
  } @empty {<p class="ord-muted">Elige productos para empezar.</p>}
  <div class="ord-cart-footer">
   <div><span>Importe estimado</span><strong>{{money(total(),currency())}}</strong></div>
   <small>El total definitivo lo confirma el servidor.</small>
  </div>
 </section>`
})
export class GcPosCart{
 readonly items=input.required<PosCartEntry[]>();
 readonly total=input.required<string>();
 readonly currency=input('GTQ');
 readonly quantity=output<{key:string;delta:number}>();
 readonly remove=output<string>();
 protected readonly money=money;
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
 selector:'gc-kitchen-ticket',imports:[GcOrderStatus],template:`
 <article class="ord-ticket">
  <div class="ord-ticket-head">
   <div><strong>Comanda {{ticket().numero}}</strong><small>Orden {{ticket().orden?.numero}}</small></div>
   <gc-order-status [state]="ticket().estado"/>
  </div>
  <small>{{ticket().estacion?.nombre??'Cocina'}} · {{ticket().orden?.ocupacionMesa?.mesa?.numero??'Sin mesa'}}</small>
  @for(line of ticket().comandaLineasComoComanda;track line.id){
   <div class="ord-kitchen-line">
    <strong>{{qtyText(line.cantidad)}} × {{line.ordenLinea?.nombreSnapshot??line.ordenLinea?.variante?.producto?.nombre??'Producto'}}</strong>
    @if(line.ordenLinea?.notasCocina){<small>{{line.ordenLinea?.notasCocina}}</small>}
    @if(line.listaEn){<small>Lista</small>}
    @else if(line.cantidadPreparada!=='0'){<small>En preparación: {{qtyText(line.cantidadPreparada)}}</small>}
   </div>
  }
  <ng-content/>
 </article>`
})
export class GcKitchenTicket{
 readonly ticket=input.required<KitchenTicket>();
 protected readonly qtyText=qtyText;
}
