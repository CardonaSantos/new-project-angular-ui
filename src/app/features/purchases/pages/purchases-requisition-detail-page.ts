
import {Component,inject,OnInit,signal} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {InventoryApi} from '../../inventory/data-access/inventory.api';
import type {Article} from '../../inventory/data-access/inventory.models';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {PurchasesApi} from '../data-access/purchases.api';
import {PurchasesAccess} from '../data-access/purchases-access';
import type {SupplyRequisition,SupplyAvailability} from '../data-access/purchases.models';
import {parseApiDecimal} from '../../../shared/formatting';
import {GcPurchasesNav} from '../purchases-nav';

interface ShippingLine {
 articuloId:string;article:Article|null;cantidad:string;
 ubicacionOrigenId:string;ubicacionDestinoId:string;loteId:string;
}
const decimal=(v:string,allowZero=false):string|null=>{
 const n=v.trim();
 const re=allowZero?/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/:/^(?=.*[1-9])(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/;
 return re.test(n)?n:null;
};
const ESTADO_LABEL:Record<string,string>={ABIERTA:'Abierta',ATENDIDA:'Atendida',CANCELADA:'Cancelada',
 SOLICITADA:'Solicitada',EN_PROCESO:'En proceso',PARCIAL:'Parcial'};
const BADGE_CLASS:Record<string,string>={ABIERTA:'req-state-badge--open',SOLICITADA:'req-state-badge--open',
 EN_PROCESO:'req-state-badge--progress',PARCIAL:'req-state-badge--progress',
 ATENDIDA:'req-state-badge--done',CANCELADA:'req-state-badge--cancelled'};

@Component({
 selector:'gc-purchases-requisition-detail-page',
 imports:[RouterLink,GcPurchasesNav,GcPageHeader,GcButtonDirective,GcErrorState,GcInventoryPicker],
 template:`
 <main class="req-page req-narrow"><gc-purchases-nav/>
  <gc-page-header [title]="'Requisición '+(row()?.numero??'')"/>
  @if(loadError()){<gc-error-state [message]="loadError()!" (retry)="load()"/>}
  @else if(row();as r){
   <section class="req-card">
    <div class="req-row"><h2>Detalle</h2>
     <span class="req-state-badge" [class]="badgeClass(r)">{{estadoLabel(r)}}</span></div>
    @if(r.nota){<p class="req-muted">{{r.nota}}</p>}
    <div class="req-kv">
     @for(l of r.lineas;track l.id){
      <div><dt>{{l.articulo.nombre}}</dt>
       <dd>Solicitado {{l.solicitado}} · Recibido {{l.recibido}} · En tránsito {{l.enTransito}} · Pendiente {{l.pendiente}}</dd>
      </div>
     }
    </div>
    @if(error()){<p class="req-alert" role="alert">{{error()}}</p>}
    @if(r.estado==='ABIERTA'){
     <div class="req-actions">
      @if(access.canOrdersCreate()&&access.canSupplyRequest()){
       <a gcButton variant="outline" routerLink="/purchases/orders/new" [queryParams]="{requisitionId:r.id}">
        Comprar lo que falta</a>
      }
      @if(access.canSupplyCancel()&&!showCancel()){
       <button type="button" gcButton variant="outline" (click)="showCancel.set(true)">Cancelar requisición</button>
      }
     </div>
    }
   </section>

   @if(showCancel()){
    <section class="req-card">
     <h2>Cancelar requisición</h2>
     <div class="req-field"><label for="req-cancel-motivo">Motivo (mínimo 5 caracteres)</label>
      <input id="req-cancel-motivo" [value]="cancelReason()" maxlength="500"
       (input)="cancelReason.set($any($event.target).value)"/>
     </div>
     <div class="req-actions">
      <button type="button" gcButton [disabled]="actionBusy()||cancelReason().trim().length<5"
       (click)="cancel()">{{actionBusy()?'Cancelando…':'Confirmar cancelación'}}</button>
      <button type="button" gcButton variant="outline" (click)="showCancel.set(false);cancelReason.set('')">Cerrar</button>
     </div>
    </section>
   }

   @if(r.transferencias.length){
    <section class="req-card">
     <h2>Traslados</h2>
     @for(t of r.transferencias;track t.id){
      <div class="req-row">
       <div><strong>{{t.numero}}</strong>
        <p class="req-muted">{{t.estado==='EN_TRANSITO'?'Pendiente de recibir':t.estado}}</p></div>
       <a gcButton variant="outline" [routerLink]="['/purchases/transfers',t.id]">
        {{t.estado==='EN_TRANSITO'?'Recibir traslado':'Ver traslado'}}</a>
      </div>
     }
    </section>
   }

   @if(r.estado==='ABIERTA'&&access.canSupplySend()){
    <section class="req-card">
     <h2>Atender desde otro almacén</h2>
     <gc-inventory-picker id="req-origin" kind="warehouse" label="Almacén de origen"
      [branchId]="context.branchId()??''" [value]="originId()" (valueChange)="setOrigin($event)"/>
     @if(originId()){
      <div class="req-actions">
       <button type="button" gcButton variant="outline" [disabled]="availabilityBusy()" (click)="loadAvailability()">
        {{availabilityBusy()?'Consultando…':'Consultar disponibilidad'}}</button>
      </div>
     }
     @if(availability();as data){
      <p class="req-muted">El servidor calcula cuánto se puede enviar; la consulta no reserva existencias.</p>
      @for(l of data.lineas;track l.articuloId){
       <div class="req-line">
        <div class="req-row"><strong>{{l.articulo.nombre}}</strong>
         <span class="req-muted">Disponible: {{l.disponibleOrigen}} · Sugerido: {{l.sugeridoEnviar}}</span></div>
        @for(s of shipping();track s.articuloId){
         @if(s.articuloId===l.articuloId){
          <div class="req-grid">
           <div class="req-field"><label [for]="'req-send-qty-'+s.articuloId">Cantidad a enviar</label>
            <input [id]="'req-send-qty-'+s.articuloId" inputmode="decimal" [value]="s.cantidad"
             (input)="patchShip(s.articuloId,'cantidad',$any($event.target).value)"/>
           </div>
           <gc-inventory-picker [id]="'req-send-from-'+s.articuloId" kind="location" label="Ubicación de origen"
            [branchId]="context.branchId()??''" [warehouseId]="originId()" [value]="s.ubicacionOrigenId"
            (valueChange)="patchShip(s.articuloId,'ubicacionOrigenId',$event)"/>
           <gc-inventory-picker [id]="'req-send-to-'+s.articuloId" kind="location" label="Ubicación de destino"
            [branchId]="context.branchId()??''" [warehouseId]="r.almacenDestinoId" [value]="s.ubicacionDestinoId"
            (valueChange)="patchShip(s.articuloId,'ubicacionDestinoId',$event)"/>
           @if(s.article?.requiereLote){
            <gc-inventory-picker [id]="'req-send-lot-'+s.articuloId" kind="lot" label="Lote"
             [branchId]="context.branchId()??''" [articleId]="s.articuloId" [value]="s.loteId"
             (valueChange)="patchShip(s.articuloId,'loteId',$event)"/>
           }
          </div>
         }
        }
       </div>
      }
      @if(access.canSupplyReceive()){
       <label class="req-row"><input type="checkbox" [checked]="immediate()"
        (change)="immediate.set($any($event.target).checked)"/> Recibir inmediatamente en destino</label>
      }
      <div class="req-actions">
       <button type="button" gcButton [disabled]="actionBusy()||!canSend()" (click)="send()">
        {{actionBusy()?'Enviando…':immediate()?'Trasladar y recibir':'Enviar insumos'}}</button>
      </div>
     }
    </section>
   }
  }
 </main>`,
 styleUrl:'../requisitions.scss'
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
 protected readonly loadError=signal<string|null>(null);
 protected readonly availability=signal<SupplyAvailability|null>(null);
 protected readonly originId=signal('');
 protected readonly shipping=signal<ShippingLine[]>([]);
 protected readonly immediate=signal(false);
 protected readonly availabilityBusy=signal(false);
 protected readonly actionBusy=signal(false);protected readonly error=signal('');
 protected readonly showCancel=signal(false);protected readonly cancelReason=signal('');
 private shipKey=crypto.randomUUID();private cancelKey=crypto.randomUUID();private generation=0;
 protected readonly canSend=()=>Boolean(this.originId()&&this.shipping().some(s=>decimal(s.cantidad)&&
  s.ubicacionOrigenId&&s.ubicacionDestinoId&&(!s.article?.requiereLote||s.loteId))&&
  this.shipping().every(s=>!decimal(s.cantidad,true)||decimal(s.cantidad,true)==='0'||(
   s.ubicacionOrigenId&&s.ubicacionDestinoId&&(!s.article?.requiereLote||s.loteId))));
 protected estadoLabel(r:SupplyRequisition){return ESTADO_LABEL[r.estadoVisible??r.estado]??r.estado}
 protected badgeClass(r:SupplyRequisition){return BADGE_CLASS[r.estadoVisible??r.estado]??'req-state-badge--open'}
 ngOnInit(){void this.load()}
 protected async load(){
  const id=this.route.snapshot.paramMap.get('id');if(!id)return;
  this.loadError.set(null);
  try{this.row.set(await firstValueFrom(this.api.requisition(id)))}
  catch(e){this.loadError.set(gcErrorMessage(e))}
 }
 protected setOrigin(id:string){
  this.originId.set(id);this.availability.set(null);this.shipping.set([]);this.shipKey=crypto.randomUUID();
 }
 protected patchShip<K extends keyof ShippingLine>(id:string,field:K,value:ShippingLine[K]){
  this.shipping.update(ls=>ls.map(l=>l.articuloId===id?{...l,[field]:value}:l));this.shipKey=crypto.randomUUID();
 }
 protected async loadAvailability(){
  const r=this.row();if(!r||!this.originId()||this.availabilityBusy())return;
  const gen=++this.generation,origin=this.originId();
  this.availabilityBusy.set(true);this.error.set('');
  try{
   const a=await firstValueFrom(this.api.availability(r.id,origin));
   if(gen!==this.generation||origin!==this.originId())return;
   this.availability.set(a);
   this.shipping.set(a.lineas.map(l=>({
    articuloId:l.articuloId,article:null,cantidad:l.sugeridoEnviar,
    ubicacionOrigenId:'',ubicacionDestinoId:'',loteId:''})));
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
  if(!r||!a||!this.canSend()||this.actionBusy())return;
  const chosen=this.shipping().filter(s=>decimal(s.cantidad));
  if(chosen.some(s=>{
   const result=a.lineas.find(l=>l.articuloId===s.articuloId);
   return !result||parseApiDecimal(decimal(s.cantidad)!).gt(parseApiDecimal(result.sugeridoEnviar));
  })){this.error.set('La cantidad excede lo sugerido por disponibilidad.');return}
  const postImmediate=this.immediate()&&this.access.canSupplyReceive();
  if(!await this.dialogs.confirm({title:postImmediate?'Trasladar y recibir':'Enviar mercancía',
   message:postImmediate?'Se descontará del origen y se sumará al destino en una operación.':
    'Se descontará del origen y quedará en tránsito hasta confirmar recepción.',
   confirmText:postImmediate?'Trasladar y recibir':'Enviar'}))return;
  this.actionBusy.set(true);this.error.set('');
  try{
   const response=await firstValueFrom(this.api.sendRequisition(r.id,{
    almacenOrigenId:this.originId(),inmediato:postImmediate,claveOperacion:this.shipKey,
    lineas:chosen.map(s=>({articuloId:s.articuloId,ubicacionOrigenId:s.ubicacionOrigenId,
     ubicacionDestinoId:s.ubicacionDestinoId,...(s.loteId?{loteId:s.loteId}:{}),
     cantidad:decimal(s.cantidad)!}))}));
   this.notice.show(postImmediate?'Insumos transferidos y recibidos.':'Traslado enviado. Pendiente de recepción.','success');
   this.shipKey=crypto.randomUUID();this.availability.set(null);this.shipping.set([]);this.originId.set('');
   await this.load();
   if(response.estado==='EN_TRANSITO')this.notice.show('Puedes recibir el traslado en la sección Traslados.','info');
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
 protected async cancel(){
  const r=this.row();if(!r||r.estado!=='ABIERTA'||this.actionBusy()||this.cancelReason().trim().length<5)return;
  if(!await this.dialogs.confirm({title:'Cancelar requisición',
   message:'La requisición no debe tener entregas en tránsito ni compras activas.',
   confirmText:'Cancelar',danger:true}))return;
  this.actionBusy.set(true);this.error.set('');
  try{
   await firstValueFrom(this.api.cancelRequisition(r.id,{
    motivo:this.cancelReason().trim(),claveOperacion:this.cancelKey}));
   this.notice.show('Requisición cancelada.','success');this.cancelKey=crypto.randomUUID();
   this.showCancel.set(false);this.cancelReason.set('');await this.load();
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
 hasUnsavedChanges(){
  return (this.showCancel()||this.shipping().some(s=>decimal(s.cantidad)))&&!this.actionBusy();
 }
}
