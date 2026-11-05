import {DatePipe} from '@angular/common';
import {Component,inject,OnInit,signal} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {PurchasesApi} from '../data-access/purchases.api';
import {PurchasesAccess} from '../data-access/purchases-access';
import type {PurchaseReceipt} from '../data-access/purchases.models';
import {canConfirmReceipt,canEditReceipt,money,newKey} from '../data-access/purchases.helpers';
import {GcPurchasesNav} from '../purchases-nav';
@Component({
 selector:'gc-purchases-receipt-detail-page',
 imports:[DatePipe,RouterLink,GcPurchasesNav],
 template:`<main class="pur-page"><gc-purchases-nav/>
  <header class="pur-heading"><div>
   <a routerLink="/purchases/receipts" class="pur-link">← Recepciones</a>
   <h1>Recepción {{row()?.numero??''}}</h1></div>
   <button type="button" (click)="load()" [disabled]="busy()">Actualizar</button>
  </header>
  @if(error()){<p role="alert" class="pur-alert">{{error()}}</p>}
  @if(busy()){<p role="status" class="pur-muted">Cargando recepción…</p>}
  @if(row();as receipt){
   <section class="pur-card">
    <div class="pur-heading"><h2>Datos de la recepción</h2><span class="pur-badge">{{status(receipt.estado)}}</span></div>
    <div class="pur-grid-3">
     <div><small class="pur-muted">Proveedor</small><p>{{receipt.proveedor.nombre}}</p></div>
     <div><small class="pur-muted">Almacén</small><p>{{receipt.almacen.nombre}}</p></div>
     <div><small class="pur-muted">Creada</small><p>{{receipt.creadoEn|date:'dd/MM/yyyy HH:mm'}}</p></div>
    </div>
    @if(receipt.referenciaProveedor){<p class="pur-muted">Referencia: {{receipt.referenciaProveedor}}</p>}
    @if(receipt.observaciones){<p>{{receipt.observaciones}}</p>}
    <div class="pur-actions">
     @if(canEditReceipt(receipt.estado,access.canReceiptsCreate())){
      <a class="pur-button" [routerLink]="['/purchases/receipts',receipt.id,'edit']">Editar borrador</a>
     }
     @if(canConfirmReceipt(receipt.estado,access.canReceiptsConfirm())){
      <button type="button" class="pur-primary" [disabled]="actionBusy()"
       (click)="confirmReceipt()">Confirmar e ingresar stock</button>
     }
     @if(receipt.estado==='BORRADOR'&&access.canReceiptsCreate()){
      <button type="button" [disabled]="actionBusy()" (click)="cancel()">Cancelar borrador</button>
     }
     @if(receipt.estado==='CONFIRMADO'){
      <a class="pur-button" routerLink="/inventory/operations/movements">Ver Kardex</a>
     }
    </div>
   </section>
   <section class="pur-card">
    <h2>Artículos recibidos</h2>
    <div class="pur-table-scroll"><table class="pur-table">
     <thead><tr><th>Artículo</th><th>Cantidad aceptada</th><th>Ubicación</th><th>Costo total</th></tr></thead>
     <tbody>
      @for(line of receipt.recepcionCompraLineasComoRecepcion??[];track line.id){
       <tr class="pur-data-row">
        <td data-label="Artículo"><strong>{{line.articulo.nombre}}</strong></td>
        <td data-label="Cantidad">{{line.cantidadBase}}</td>
        <td data-label="Ubicación">{{line.ubicacion.nombre}}</td>
        <td data-label="Costo">{{money(line.costoTotal)}}</td>
       </tr>
      } @empty {<tr><td colspan="4">No hay artículos.</td></tr>}
     </tbody>
    </table></div>
    @if(receipt.estado==='CONFIRMADO'){
     <p class="pur-note">La confirmación ya generó entradas de stock. Este documento no se puede editar ni cancelar.</p>
    }
   </section>
  }
 </main>`,
 styleUrl:'../purchases.scss'
})
export class GcPurchasesReceiptDetailPage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 private readonly api=inject(PurchasesApi);
 protected readonly access=inject(PurchasesAccess);
 private readonly confirmDialog=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 protected readonly money=money;protected readonly canConfirmReceipt=canConfirmReceipt;
 protected readonly canEditReceipt=canEditReceipt;
 protected readonly row=signal<PurchaseReceipt|null>(null);
 protected readonly busy=signal(false);protected readonly actionBusy=signal(false);
 protected readonly error=signal('');
 private key=newKey();private operation='';
 ngOnInit(){void this.load()}
 protected status(value:string){return value==='CONFIRMADO'?'Stock ingresado':value==='BORRADOR'?'Borrador':'Cancelada'}
 protected async load(){
  const id=this.route.snapshot.paramMap.get('id');if(!id)return;
  this.busy.set(true);this.error.set('');
  try{this.row.set(await firstValueFrom(this.api.receipt(id)))}
  catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
 protected async confirmReceipt(){
  const row=this.row();if(!row||!canConfirmReceipt(row.estado,this.access.canReceiptsConfirm())||this.actionBusy())return;
  if(!await this.confirmDialog.confirm({
   title:'Ingresar mercancía al inventario',
   message:'La recepción se confirmará y sus artículos aumentarán las existencias. No se podrá editar después.',
   confirmText:'Confirmar ingreso'
  }))return;
  await this.action('confirm',()=>firstValueFrom(this.api.confirmReceipt(row.id,this.key)),
   'Recepción confirmada. Stock ingresado.');
 }
 protected async cancel(){
  const row=this.row();if(!row||row.estado!=='BORRADOR'||!this.access.canReceiptsCreate()||this.actionBusy())return;
  if(!await this.confirmDialog.confirm({
   title:'Cancelar borrador',message:'Se descartará la recepción. No afecta al inventario.',
   confirmText:'Cancelar recepción',danger:true
  }))return;
  await this.action('cancel',()=>firstValueFrom(this.api.cancelReceipt(row.id,this.key)),
   'Borrador cancelado.');
 }
 private async action(kind:string,call:()=>Promise<unknown>,success:string){
  if(this.actionBusy())return;
  if(this.operation!==kind){this.operation=kind;this.key=newKey()}
  this.actionBusy.set(true);this.error.set('');
  try{await call();this.key=newKey();this.operation='';this.notices.show(success,'success');await this.load()}
  catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
}
