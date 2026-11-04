import {Component,inject,OnInit,signal} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {InventoryApi} from '../../inventory/data-access/inventory.api';
import type {Article} from '../../inventory/data-access/inventory.models';
import {PurchasesApi} from '../data-access/purchases.api';
import {PurchasesAccess} from '../data-access/purchases-access';
import type {SupplyRequisition,SupplyAvailability} from '../data-access/purchases.models';
import {decimal,newKey} from '../data-access/purchases.helpers';
import {GcPurchasesNav} from '../purchases-nav';
interface ShippingLine {
 articuloId:string;article:Article|null;cantidad:string;
 ubicacionOrigenId:string;ubicacionDestinoId:string;loteId:string;
}
@Component({
 selector:'gc-purchases-requisition-detail-page',
 imports:[RouterLink,GcPurchasesNav,GcInventoryPicker],
 template:`<main class="pur-page"><gc-purchases-nav/>
  <header class="pur-heading">
   <div><a class="pur-link" routerLink="/purchases/requisitions">← Requisiciones</a>
    <h1>Solicitud {{row()?.numero??''}}</h1></div>
   <button type="button" [disabled]="busy()" (click)="load()">Actualizar</button>
  </header>
  @if(error()){<p role="alert" class="pur-alert">{{error()}}</p>}
  @if(busy()){<p class="pur-muted" role="status">Cargando solicitud…</p>}
  @if(row();as r){
   <section class="pur-card">
    <div class="pur-heading"><h2>Detalle de requisición</h2>
     <span class="pur-badge">{{r.estadoVisible??r.estado}}</span>
    </div>
    @if(r.nota){<p>{{r.nota}}</p>}
    <div class="pur-table-scroll">
     <table class="pur-table"><thead><tr><th>Artículo</th><th>Solicitado</th><th>Recibido</th><th>En tránsito</th><th>Pendiente</th></tr></thead>
      <tbody>
       @for(l of r.lineas;track l.id){
        <tr class="pur-data-row">
         <td data-label="Artículo"><strong>{{l.articulo.nombre}}</strong></td>
         <td data-label="Solicitado">{{l.solicitado}}</td>
         <td data-label="Recibido">{{l.recibido}}</td>
         <td data-label="En tránsito">{{l.enTransito}}</td>
         <td data-label="Pendiente">{{l.pendiente}}</td>
        </tr>
       }
      </tbody>
     </table>
    </div>
    @if(r.estado==='ABIERTA'){
     <div class="pur-actions">
      @if(access.canOrdersCreate()&&access.canSupplyRequest()){
       <a class="pur-button" routerLink="/purchases/orders/new"
        [queryParams]="{requisitionId:r.id}">Comprar lo que falta</a>
      }
      @if(access.canSupplyCancel()){
       <button type="button" [disabled]="actionBusy()" (click)="showCancel.update(v=>!v)">
        Cancelar requisición</button>
      }
     </div>
    }
   </section>
   @if(showCancel()){
    <section class="pur-card">
     <h2>Cancelar requisición</h2>
     <div class="pur-field"><label for="pur-req-cancel">Motivo (mínimo 5 caracteres)</label>
      <textarea id="pur-req-cancel" rows="2" [value]="cancelReason()"
       (input)="cancelReason.set($any($event.target).value)" maxlength="500"></textarea>
     </div>
     <div class="pur-actions">
      <button type="button" [disabled]="actionBusy()||cancelReason().trim().length<5"
       (click)="cancel()">Confirmar cancelación</button>
      <button type="button" (click)="showCancel.set(false)">Volver</button>
     </div>
    </section>
   }
   @if(r.transferencias.length){
    <section class="pur-card">
     <h2>Traslados</h2>
     <div class="pur-lines">
      @for(t of r.transferencias;track t.id){
       <div class="pur-line pur-inline">
        <div><strong>{{t.numero}}</strong>
         <p class="pur-muted">{{t.estado==='EN_TRANSITO'?'Pendiente de recibir':t.estado}}</p>
        </div>
        <a class="pur-link" [routerLink]="['/purchases/transfers',t.id]">
         {{t.estado==='EN_TRANSITO'?'Recibir traslado':'Ver traslado'}}</a>
       </div>
      }
     </div>
    </section>
   }
   @if(r.estado==='ABIERTA'&&access.canSupplySend()){
    <section class="pur-card">
     <h2>Atender desde otro almacén</h2>
     <gc-inventory-picker id="pur-req-origin" kind="warehouse" label="Almacén de origen"
      [branchId]="context.branchId()??''" [value]="originId()"
      (valueChange)="setOrigin($event)"/>
     @if(originId()){
      <button type="button" [disabled]="availabilityBusy()" (click)="loadAvailability()">
       Consultar disponibilidad
      </button>
     }
     @if(availabilityBusy()){<p class="pur-muted" role="status">Consultando existencias…</p>}
     @if(availability();as data){
      <p class="pur-muted">El servidor calcula cuánto se puede enviar; la consulta no reserva existencias.</p>
      <div class="pur-lines">
       @for(l of data.lineas;track l.articuloId){
        <div class="pur-line">
         <div class="pur-heading">
          <strong>{{l.articulo.nombre}}</strong>
          <span class="pur-muted">Disponible: {{l.disponibleOrigen}} · Sugerido: {{l.sugeridoEnviar}}</span>
         </div>
         @for(s of shipping();track s.articuloId){
          @if(s.articuloId===l.articuloId){
           <div class="pur-grid">
            <div class="pur-field"><label [for]="'pur-send-qty-'+s.articuloId">Cantidad a enviar</label>
             <input [id]="'pur-send-qty-'+s.articuloId" inputmode="decimal" [value]="s.cantidad"
              (input)="patchShip(s.articuloId,'cantidad',$any($event.target).value)"/>
            </div>
            <gc-inventory-picker [id]="'pur-send-from-'+s.articuloId" kind="location"
             label="Ubicación de origen" [branchId]="context.branchId()??''"
             [warehouseId]="originId()" [value]="s.ubicacionOrigenId"
             (valueChange)="patchShip(s.articuloId,'ubicacionOrigenId',$event)"/>
            <gc-inventory-picker [id]="'pur-send-to-'+s.articuloId" kind="location"
             label="Ubicación de destino" [branchId]="context.branchId()??''"
             [warehouseId]="r.almacenDestinoId" [value]="s.ubicacionDestinoId"
             (valueChange)="patchShip(s.articuloId,'ubicacionDestinoId',$event)"/>
            @if(s.article?.requiereLote){
             <gc-inventory-picker [id]="'pur-send-lot-'+s.articuloId" kind="lot"
              label="Lote" [branchId]="context.branchId()??''"
              [articleId]="s.articuloId" [value]="s.loteId"
              (valueChange)="patchShip(s.articuloId,'loteId',$event)"/>
            }
           </div>
          }
         }
        </div>
       }
      </div>
      @if(access.canSupplyReceive()){
       <label><input type="checkbox" [checked]="immediate()"
        (change)="immediate.set($any($event.target).checked)"/>
        Recibir inmediatamente en destino</label>
      }
      <div class="pur-actions">
       <button type="button" class="pur-primary" [disabled]="actionBusy()||!canSend()"
        (click)="send()">{{actionBusy()?'Enviando…':immediate()?'Trasladar y recibir':'Enviar insumos'}}</button>
      </div>
     }
    </section>
   }
  }
 </main>`,
 styleUrl:'../purchases.scss'
})
export class GcPurchasesRequisitionDetailPage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 protected readonly context=inject(GcBranchContext);
 protected readonly access=inject(PurchasesAccess);
 private readonly api=inject(PurchasesApi);
 private readonly inv=inject(InventoryApi);
 private readonly notice=inject(GcNotificationService);
 private readonly dialogs=inject(ConfirmDialogService);
 protected readonly row=signal<SupplyRequisition|null>(null);
 protected readonly availability=signal<SupplyAvailability|null>(null);
 protected readonly originId=signal('');
 protected readonly shipping=signal<ShippingLine[]>([]);
 protected readonly immediate=signal(false);
 protected readonly busy=signal(false);protected readonly availabilityBusy=signal(false);
 protected readonly actionBusy=signal(false);protected readonly error=signal('');
 protected readonly showCancel=signal(false);protected readonly cancelReason=signal('');
 private shipKey=newKey();private cancelKey=newKey();private generation=0;
 protected readonly canSend=()=>Boolean(this.originId()&&this.shipping().some(s=>decimal(s.cantidad)&&
  s.ubicacionOrigenId&&s.ubicacionDestinoId&&(!s.article?.requiereLote||s.loteId))&&
  this.shipping().every(s=>!decimal(s.cantidad,true)||decimal(s.cantidad,true)==='0'||(
   s.ubicacionOrigenId&&s.ubicacionDestinoId&&(!s.article?.requiereLote||s.loteId))));
 ngOnInit(){void this.load()}
 protected async load(){
  const id=this.route.snapshot.paramMap.get('id');if(!id)return;
  this.busy.set(true);this.error.set('');
  try{this.row.set(await firstValueFrom(this.api.requisition(id)))}
  catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
 protected setOrigin(id:string){
  this.originId.set(id);this.availability.set(null);this.shipping.set([]);this.shipKey=newKey();
 }
 protected patchShip<K extends keyof ShippingLine>(id:string,field:K,value:ShippingLine[K]){
  this.shipping.update(ls=>ls.map(l=>l.articuloId===id?{...l,[field]:value}:l));this.shipKey=newKey();
 }
 protected async loadAvailability(){
  const r=this.row();if(!r||!this.originId()||!this.access.canSupplyRead()||this.availabilityBusy())return;
  const gen=++this.generation,origin=this.originId();
  this.availabilityBusy.set(true);this.error.set('');
  try{
   const a=await firstValueFrom(this.api.availability(r.id,origin));
   if(gen!==this.generation||origin!==this.originId())return;
   this.availability.set(a);
   this.shipping.set(a.lineas.map(l=>({
    articuloId:l.articuloId,article:null,cantidad:l.sugeridoEnviar,
    ubicacionOrigenId:'',ubicacionDestinoId:'',loteId:''
   })));
   await Promise.all(a.lineas.map(async l=>{
    try{
     const article=await firstValueFrom(this.inv.article(l.articuloId));
     if(gen===this.generation)
      this.shipping.update(ls=>ls.map(s=>s.articuloId===l.articuloId?{...s,article}:s));
    }catch{/* Server will validate any lot requirement. */}
   }));
  }catch(e){if(gen===this.generation)this.error.set(gcErrorMessage(e))}
  finally{if(gen===this.generation)this.availabilityBusy.set(false)}
 }
 protected async send(){
  const r=this.row(),a=this.availability();
  if(!r||!a||!this.canSend()||this.actionBusy()||!this.access.canSupplySend())return;
  const chosen=this.shipping().filter(s=>decimal(s.cantidad));
  if(chosen.some(s=>{
   const result=a.lineas.find(l=>l.articuloId===s.articuloId);
   return !result||Number(s.cantidad)>Number(result.sugeridoEnviar);
  })){this.error.set('La cantidad excede lo sugerido por disponibilidad.');return}
  if(!await this.dialogs.confirm({title: this.immediate()?'Trasladar y recibir':'Enviar mercancía',
   message:this.immediate()?'Se descontará del origen y se sumará al destino en una operación.':
    'Se descontará del origen y quedará en tránsito hasta confirmar recepción.',
   confirmText:this.immediate()?'Trasladar y recibir':'Enviar'}))return;
  this.actionBusy.set(true);this.error.set('');
  try{
   const response=await firstValueFrom(this.api.sendRequisition(r.id,{
    almacenOrigenId:this.originId(),inmediato:this.immediate()&&this.access.canSupplyReceive(),
    claveOperacion:this.shipKey,
    lineas:chosen.map(s=>({articuloId:s.articuloId,ubicacionOrigenId:s.ubicacionOrigenId,
     ubicacionDestinoId:s.ubicacionDestinoId,...(s.loteId?{loteId:s.loteId}:{}),
     cantidad:decimal(s.cantidad)!}))
   }));
   this.notice.show(this.immediate()?'Insumos transferidos y recibidos.':'Traslado enviado. Pendiente de recepción.','success');
   this.shipKey=newKey();this.availability.set(null);this.shipping.set([]);
   await this.load();
   if(response.estado==='EN_TRANSITO')this.notice.show('Puedes recibir el traslado en la sección Traslados.','info');
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
 protected async cancel(){
  const r=this.row();if(!r||r.estado!=='ABIERTA'||this.actionBusy()||
   !this.access.canSupplyCancel()||this.cancelReason().trim().length<5)return;
  if(!await this.dialogs.confirm({title:'Cancelar requisición',
   message:'La requisición no debe tener entregas en tránsito ni compras activas.',
   confirmText:'Cancelar',danger:true}))return;
  this.actionBusy.set(true);this.error.set('');
  try{
   await firstValueFrom(this.api.cancelRequisition(r.id,{
    motivo:this.cancelReason().trim(),claveOperacion:this.cancelKey
   }));
   this.notice.show('Requisición cancelada.','success');this.cancelKey=newKey();
   this.showCancel.set(false);await this.load();
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
}
