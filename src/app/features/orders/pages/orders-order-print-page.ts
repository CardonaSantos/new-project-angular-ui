import {Component,computed,effect,inject,signal,untracked} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBrandingService} from '../../../core/branding/gc-branding.service';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {formatInstant} from '../../../shared/formatting';
import {OrdersAccess} from '../data-access/orders-access';
import {OrdersApi} from '../data-access/orders.api';
import type {OrderDetail} from '../data-access/orders.models';
import {qtyText,orderFriendlyError} from '../data-access/orders.helpers';
import {printableOrderLines,kitchenModifierNames} from '../printing/thermal-print.helpers';
import {canShareFiles,sharePdf} from '../printing/share-pdf.helpers';

/** Complete non-fiscal service slip. Unlike kitchen tickets, includes INVENTARIABLE/SERVICIO. */
@Component({
 selector:'gc-orders-order-print-page',
 imports:[RouterLink],
 template:`
 <main class="gc-thermal-page">
  <header class="gc-thermal-controls">
   <a [routerLink]="['/orders/list',order()?.id??'']">← Detalle del pedido</a>
   <div class="gc-thermal-toolbar gc-print-toolbar">
    <nav class="gc-print-modes" aria-label="Tipo de comanda">
     @if(access.canKitchenRead()&&primaryTicket();as ticket){
      <a class="gc-print-mode" [routerLink]="['/orders/kitchen/tickets',ticket.id,'print']"
       title="Solo productos que requieren preparación">Comanda de preparación</a>
     }@else{
      <span class="gc-print-mode gc-print-mode--disabled" aria-disabled="true"
       title="No hay comanda de preparación disponible">Comanda de preparación</span>
     }
     <span class="gc-print-mode gc-print-mode--active" aria-current="page"
      title="Comprobante para el cliente, con todos los productos">Pedido</span>
    </nav>
    <button type="button" [disabled]="busy()||!order()" (click)="print()">Imprimir pedido</button>
    <button type="button" [disabled]="busy()||!order()||sharing()" (click)="share()">
     {{sharing()?'Enviando…':shareLabel()}}</button>
   </div>
   @if(shareError()){<p role="alert" class="gc-thermal-error">{{shareError()}}</p>}
  </header>
  @if(busy()){<p role="status">Cargando pedido completo…</p>}
  @if(error()){<p role="alert" class="gc-thermal-error">{{error()}}</p>}
  @if(order();as data){
   <article class="gc-thermal-paper" aria-label="Pedido completo con todos los productos">
    <header class="gc-thermal-head">
     <strong class="gc-thermal-brand">{{branding.name()}}</strong>
     <strong>PEDIDO</strong>
     <strong class="gc-thermal-number">{{data.numero}}</strong>
     <span class="gc-thermal-muted">{{time(data.abiertaEn)}}</span>
    </header>
    <section class="gc-thermal-divider">
     @if(data.ocupacionMesa?.mesa?.numero){
      <div><span>Mesa</span><strong>{{data.ocupacionMesa?.mesa?.numero}}</strong></div>
      @if(data.ocupacionMesa?.mesa?.sala?.nombre){
       <div><span>Sala</span><span>{{data.ocupacionMesa?.mesa?.sala?.nombre}}</span></div>
      }
     }
     @if(data.cliente){
      <div><span>Cliente</span><strong>{{data.cliente.nombre}}</strong></div>
     }
    </section>
    @if(data.observaciones){
     <section class="gc-thermal-note"><strong>Observaciones</strong>
      <p>{{data.observaciones}}</p></section>
    }
    <section class="gc-thermal-lines">
     @for(line of printable(data);track line.id){
      <article class="gc-thermal-line">
       <strong>{{quantity(line.cantidad)}} × {{line.nombreSnapshot}}</strong>
       @for(mod of modifiers(line.ordenLineaModificadoresComoOrdenLinea);track $index){
        <span class="gc-thermal-mod">+ {{mod}}</span>
       }
       @if(line.notasCocina){<p class="gc-thermal-line-note">Nota: {{line.notasCocina}}</p>}
      </article>
     }@empty{<p>No hay productos activos en esta orden.</p>}
    </section>
    <footer class="gc-thermal-foot">
     <p>¡Gracias por tu visita! Esperamos verte pronto.</p>
    </footer>
   </article>
  }
 </main>`
})
export class GcOrdersOrderPrintPage{
 private readonly route=inject(ActivatedRoute);
 private readonly api=inject(OrdersApi);
 private readonly branch=inject(GcBranchContext);
 protected readonly access=inject(OrdersAccess);
 protected readonly branding=inject(GcBrandingService);
 protected readonly order=signal<OrderDetail|null>(null);
 protected readonly primaryTicket=computed(()=>
  (this.order()?.comandasComoOrden??[])
   .filter(ticket=>ticket.estado!=='CANCELADA')
   .sort((a,b)=>b.enviadaEn.localeCompare(a.enviadaEn))[0]??null);
 protected readonly busy=signal(false);
 protected readonly error=signal('');
 protected readonly sharing=signal(false);
 protected readonly shareError=signal('');
 protected readonly shareLabel=computed(()=>canShareFiles()?'Enviar por WhatsApp':'Descargar PDF');
 protected readonly printable=printableOrderLines;
 protected readonly modifiers=kitchenModifierNames;
 protected readonly quantity=qtyText;
 private generation=0;
 constructor(){
  effect(()=>{
   const branchId=this.branch.branchId();
   untracked(()=>{
    this.generation++;this.order.set(null);
    if(branchId)void this.load(branchId);
   });
  });
 }
 protected time(instant:string){
  try{return formatInstant(instant,this.branch.active()?.zonaHoraria??'America/Guatemala')}
  catch{return instant}
 }
 protected async load(branchId:string){
  if(!this.access.canViewDetail()){
   this.error.set('No tienes acceso a los pedidos.');return;
  }
  const id=this.route.snapshot.paramMap.get('id');
  if(!id){this.error.set('Pedido no especificado.');return}
  const gen=++this.generation;
  this.busy.set(true);this.error.set('');
  try{
   const data=await firstValueFrom(this.api.detail(id));
   if(gen!==this.generation||this.branch.branchId()!==branchId)return;
   if(data.sucursalId!==branchId){this.error.set('La orden pertenece a otra sucursal.');return}
   this.order.set(data);
  }catch(e){
   if(gen===this.generation)this.error.set(orderFriendlyError(e));
  }finally{
   if(gen===this.generation)this.busy.set(false);
  }
 }
 protected print(){if(this.order())window.print()}
 protected async share(){
  const data=this.order();
  if(!data||this.sharing())return;
  this.sharing.set(true);this.shareError.set('');
  try{
   const blob=await firstValueFrom(this.api.receiptPdf(data.id));
   const outcome=await sharePdf(blob,'pedido-'+data.numero+'.pdf','Pedido '+data.numero,
    'Comprobante de '+this.branding.name()+' — pedido '+data.numero+'.');
   if(outcome==='downloaded')
    this.shareError.set('Se descargó el PDF — adjúntalo manualmente en WhatsApp.');
  }catch(e){
   this.shareError.set(orderFriendlyError(e));
  }finally{
   this.sharing.set(false);
  }
 }
}
