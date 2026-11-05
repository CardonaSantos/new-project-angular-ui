import {DatePipe} from '@angular/common';
import {Component,inject,OnInit,signal} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {PurchasesApi} from '../data-access/purchases.api';
import {PurchasesAccess} from '../data-access/purchases-access';
import {money,newKey} from '../data-access/purchases.helpers';
import type {PurchaseOrder} from '../data-access/purchases.models';
import {GcPurchasesNav} from '../purchases-nav';
@Component({
 selector:'gc-purchases-order-detail-page',imports:[DatePipe,RouterLink,GcPurchasesNav],
 template:`<main class="pur-page"><gc-purchases-nav/>
  <header class="pur-heading">
   <div><a class="pur-link" routerLink="/purchases/orders">← Órdenes de compra</a>
    <h1>Orden {{order()?.numero??''}}</h1></div>
   <button type="button" (click)="load()" [disabled]="busy()">Actualizar</button>
  </header>
  @if(error()){<p role="alert" class="pur-alert">{{error()}}</p>}
  @if(busy()){<p role="status" class="pur-muted">Cargando orden…</p>}
  @if(order();as o){
   <section class="pur-card">
    <div class="pur-heading"><h2>Datos de la compra</h2><span class="pur-badge">{{status(o.estado)}}</span></div>
    <div class="pur-grid-3">
     <div><small class="pur-muted">Proveedor</small><p>{{o.proveedor.nombre}}</p></div>
     <div><small class="pur-muted">Estimado</small><p>{{money(o.totalEstimado)}}</p></div>
     <div><small class="pur-muted">Fecha</small><p>{{o.creadaEn|date:'dd/MM/yyyy HH:mm'}}</p></div>
    </div>
    <p class="pur-muted">Recepción: {{o.recepcionEstado??'Consultar detalle'}}</p>
    <div class="pur-actions">
     @if(o.estado==='BORRADOR'&&access.canOrdersApprove()){
      <button type="button" class="pur-primary" [disabled]="actionBusy()"
       (click)="confirmOrder()">Confirmar orden</button>
     }
     @if(o.estado==='CONFIRMADA'&&access.canReceiptsCreate()&&hasPending()){
      <a class="pur-button pur-primary" [routerLink]="['/purchases/receipts/new']"
       [queryParams]="{orderId:o.id}">Registrar recepción</a>
     }
     @if((o.estado==='BORRADOR'||o.estado==='CONFIRMADA')&&access.canOrdersApprove()){
      <button type="button" [disabled]="actionBusy()" (click)="reasonAction('cancel')">Cancelar orden</button>
     }
     @if(o.estado==='CONFIRMADA'&&access.canOrdersApprove()){
      <button type="button" [disabled]="actionBusy()" (click)="reasonAction('close')">Cerrar administrativamente</button>
     }
    </div>
   </section>
   <section class="pur-card">
    <h2>Productos solicitados</h2>
    <div class="pur-table-scroll"><table class="pur-table">
     <thead><tr><th>Artículo</th><th>Solicitado</th><th>Recibido</th><th>Pendiente</th><th>Precio unitario</th></tr></thead>
     <tbody>
      @for(l of o.lineas??[];track l.id){
       <tr class="pur-data-row">
        <td data-label="Artículo"><strong>{{l.articulo.nombre}}</strong></td>
        <td data-label="Solicitado">{{l.cantidadCompra}}</td>
        <td data-label="Recibido">{{l.recibido??'0'}}</td>
        <td data-label="Pendiente">{{l.pendiente??'—'}}</td>
        <td data-label="Precio">{{money(l.precioUnitarioCompra)}}</td>
       </tr>
      } @empty {<tr><td colspan="5">Sin líneas.</td></tr>}
     </tbody>
    </table></div>
   </section>
   @if(showReason()){
    <section class="pur-card" aria-label="Motivo de cambio de estado">
     <h2>{{reasonKind()==='cancel'?'Cancelar orden':'Cerrar orden'}}</h2>
     <div class="pur-field"><label for="pur-order-reason">Motivo (mínimo 5 caracteres)</label>
      <textarea id="pur-order-reason" rows="2" [value]="reason()" maxlength="500"
       (input)="reason.set($any($event.target).value)"></textarea>
     </div>
     <div class="pur-actions">
      <button type="button" class="pur-primary" [disabled]="actionBusy()||reason().trim().length<5"
       (click)="runReasonAction()">Confirmar</button>
      <button type="button" (click)="showReason.set(false)">Cancelar</button>
     </div>
    </section>
   }
  }
 </main>`,
 styleUrl:'../purchases.scss'
})
export class GcPurchasesOrderDetailPage implements OnInit {
 private readonly route=inject(ActivatedRoute);private readonly api=inject(PurchasesApi);
 protected readonly access=inject(PurchasesAccess);private readonly notice=inject(GcNotificationService);
 private readonly dialogs=inject(ConfirmDialogService);
 protected readonly order=signal<PurchaseOrder|null>(null);
 protected readonly busy=signal(false);protected readonly actionBusy=signal(false);
 protected readonly error=signal('');protected readonly money=money;
 protected readonly showReason=signal(false);protected readonly reason=signal('');
 protected readonly reasonKind=signal<'cancel'|'close'>('cancel');
 private op='';private key=newKey();
 ngOnInit(){void this.load()}
 protected status(state:string){return state==='CONFIRMADA'?'Confirmada':state==='BORRADOR'?'Borrador':state==='CERRADA'?'Cerrada':'Cancelada'}
 protected hasPending(){return (this.order()?.lineas??[]).some(l=>Number(l.pendiente??'0')>0)}
 protected async load(){
  const id=this.route.snapshot.paramMap.get('id');if(!id)return;
  this.busy.set(true);this.error.set('');
  try{this.order.set(await firstValueFrom(this.api.order(id)))}
  catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
 protected async confirmOrder(){
  const order=this.order();if(!order||order.estado!=='BORRADOR'||!this.access.canOrdersApprove()||this.actionBusy())return;
  if(!await this.dialogs.confirm({title:'Confirmar orden de compra',
   message:'La orden quedará lista para recibir mercancía. Confirmarla todavía no suma stock.',
   confirmText:'Confirmar orden'}))return;
  await this.apply('confirm',()=>firstValueFrom(this.api.confirmOrder(order.id,this.key)),
   'Orden de compra confirmada.');
 }
 protected reasonAction(kind:'cancel'|'close'){this.reasonKind.set(kind);this.reason.set('');this.showReason.set(true)}
 protected async runReasonAction(){
  const o=this.order();if(!o||this.actionBusy()||this.reason().trim().length<5||!this.access.canOrdersApprove())return;
  const kind=this.reasonKind();
  if(!await this.dialogs.confirm({title:kind==='cancel'?'Cancelar orden':'Cerrar orden',
   message:'Se registrará el motivo de la operación.',confirmText:kind==='cancel'?'Cancelar orden':'Cerrar orden',
   danger:kind==='cancel'}))return;
  await this.apply(kind,()=>firstValueFrom(kind==='cancel'?
   this.api.cancelOrder(o.id,this.key,this.reason().trim()):
   this.api.closeOrder(o.id,this.key,this.reason().trim())),
   'Estado de la orden actualizado.');
  this.showReason.set(false);
 }
 private async apply(kind:string,call:()=>Promise<unknown>,message:string){
  if(this.actionBusy())return;
  if(this.op!==kind){this.op=kind;this.key=newKey()}
  this.actionBusy.set(true);this.error.set('');
  try{
   await call();this.op='';this.key=newKey();this.notice.show(message,'success');await this.load();
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
}
