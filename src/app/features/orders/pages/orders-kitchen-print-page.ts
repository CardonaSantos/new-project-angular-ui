import {Component,effect,inject,signal,untracked} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBrandingService} from '../../../core/branding/gc-branding.service';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {formatInstant} from '../../../shared/formatting';
import {OrdersAccess} from '../data-access/orders-access';
import {OrdersApi} from '../data-access/orders.api';
import type {KitchenTicket} from '../data-access/orders.models';
import {modeText,qtyText,orderFriendlyError} from '../data-access/orders.helpers';
import {printableKitchenLines,kitchenModifierNames} from '../printing/thermal-print.helpers';
@Component({
 selector:'gc-orders-kitchen-print-page',
 imports:[RouterLink],
 template:`
 <main class="gc-thermal-page">
  <header class="gc-thermal-controls">
   <a routerLink="/orders/kitchen">← Cocina</a>
   <div class="gc-thermal-toolbar">
    <span>Comanda · 80 mm</span>
    <button type="button" [disabled]="busy()||!ticket()" (click)="print()">Imprimir comanda</button>
   </div>
  </header>
  @if(busy()){<p role="status">Cargando comanda…</p>}
  @if(error()){<p role="alert" class="gc-thermal-error">{{error()}}</p>}
  @if(ticket();as data){
   <article class="gc-thermal-paper" aria-label="Comanda interna para preparar">
    <header class="gc-thermal-head">
     <strong class="gc-thermal-brand">{{branding.name()}}</strong>
     <strong>COMANDA DE PREPARACIÓN</strong>
     <strong class="gc-thermal-number">{{data.numero}}</strong>
    </header>
    <section class="gc-thermal-divider">
     <div><span>Orden</span><strong>{{data.orden?.numero??'—'}}</strong></div>
     <div><span>Estación</span><span>{{data.estacion?.nombre??'—'}}</span></div>
     <div><span>Atención</span><span>{{data.orden?mode(data.orden.modalidad):'—'}}</span></div>
     @if(data.orden?.ocupacionMesa?.mesa?.numero){
      <div><span>Mesa</span><strong>{{data.orden?.ocupacionMesa?.mesa?.numero}}</strong></div>
     }
     <div><span>Recibida</span><span>{{time(data.enviadaEn)}}</span></div>
     <div><span>Estado</span><strong>{{data.estado}}</strong></div>
    </section>
    @if(data.orden?.observaciones){
     <section class="gc-thermal-note"><strong>Nota de pedido</strong>
      <p>{{data.orden?.observaciones}}</p></section>
    }
    <section class="gc-thermal-lines">
     @for(line of activeLines(data);track line.id){
      <article class="gc-thermal-line">
       <strong>{{quantity(line.cantidad)}} × {{line.ordenLinea?.nombreSnapshot??
        line.ordenLinea?.variante?.producto?.nombre??'Producto'}}</strong>
       @for(modifier of modifiers(line.ordenLinea?.ordenLineaModificadoresComoOrdenLinea);track $index){
        <span class="gc-thermal-mod">+ {{modifier}}</span>
       }
       @if(line.ordenLinea?.notasCocina||line.ordenLinea?.notasSnapshot){
        <p class="gc-thermal-line-note">Nota: {{line.ordenLinea?.notasCocina??line.ordenLinea?.notasSnapshot}}</p>
       }
      </article>
     }@empty{<p>No hay líneas activas en esta comanda.</p>}
    </section>
    <footer class="gc-thermal-foot">
     <p>Documento interno para cocina. No es comprobante de pago ni factura.</p>
    </footer>
   </article>
  }
 </main>`
})
export class GcOrdersKitchenPrintPage{
 private readonly route=inject(ActivatedRoute);
 private readonly api=inject(OrdersApi);
 protected readonly access=inject(OrdersAccess);
 private readonly branch=inject(GcBranchContext);
 protected readonly branding=inject(GcBrandingService);
 protected readonly ticket=signal<KitchenTicket|null>(null);
 protected readonly busy=signal(false);
 protected readonly error=signal('');
 protected readonly activeLines=printableKitchenLines;
 protected readonly modifiers=kitchenModifierNames;
 protected readonly quantity=qtyText;
 protected readonly mode=modeText;
 private generation=0;
 constructor(){
  effect(()=>{
   const branchId=this.branch.branchId();
   untracked(()=>{this.generation++;this.ticket.set(null);
    if(branchId)void this.load(branchId);
   });
  });
 }
 protected time(date:string){
  try{return formatInstant(date,this.branch.active()?.zonaHoraria??'America/Guatemala')}
  catch{return date}
 }
 protected async load(branchId:string){
  if(!this.access.canKitchenRead()){
   this.error.set('Se necesita permiso para leer comandas.');return;
  }
  const id=this.route.snapshot.paramMap.get('id');
  if(!id)return;
  const gen=++this.generation;this.busy.set(true);this.error.set('');
  try{
   const data=await firstValueFrom(this.api.ticket(id));
   if(gen===this.generation&&branchId===this.branch.branchId())this.ticket.set(data);
  }catch(e){if(gen===this.generation)this.error.set(orderFriendlyError(e))}
  finally{if(gen===this.generation)this.busy.set(false)}
 }
 protected print(){if(this.ticket())window.print()}
}
