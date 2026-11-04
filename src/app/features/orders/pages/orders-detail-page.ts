import {Component,computed,HostListener,inject,OnInit,signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {CdkTrapFocus} from '@angular/cdk/a11y';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {parseApiDecimal} from '../../../shared/formatting';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {CatalogApi} from '../../catalog/data-access/catalog.api';
import type {CatalogBranchMenu,CatalogProjectedGroup,CatalogProjectedItem} from '../../catalog/data-access/catalog.models';
import {GcOrdersNav} from '../orders-nav';
import {GcOrderStatus,GcKitchenModifiers} from '../components/orders-ui';
import {OrdersApi} from '../data-access/orders.api';
import {OrdersAccess} from '../data-access/orders-access';
import {PaymentsAccess} from '../../payments/data-access/payments-access';
import {CANCELLATION_CLASSES,type CancellationClass,type OrderDetail, type OrderLine} from '../data-access/orders.models';
import {money,operationKey,qtyText,safeQuantity,statusText,orderFriendlyError} from '../data-access/orders.helpers';

@Component({
 selector:'gc-orders-detail-page',
 imports:[RouterLink,DatePipe,CdkTrapFocus,GcOrdersNav,GcOrderStatus,GcSearchSelect,GcKitchenModifiers],
 template:`
 <main class="ord-page ord-detail-page"><gc-orders-nav/>
  <div class="ord-heading"><div><a routerLink="/orders/list">← Órdenes</a>
   <h1>Pedido {{order()?.numero??''}}</h1></div>
   <div class="ord-actions">
    @if(order();as o){<gc-order-status [state]="o.estado"/>}
    <button type="button" (click)="load()" [disabled]="busy()||actionBusy()">Actualizar</button>
   </div>
  </div>
  @if(busy()){<p role="status">Cargando pedido…</p>}
  @if(error()){<p role="alert" class="ord-alert">{{error()}}</p>
   <button type="button" (click)="load()">Reintentar</button>}
  @if(order();as o){
   <section class="ord-card">
    <div class="ord-stat-grid">
     <div><small>Tipo de pedido</small><strong>{{o.modalidad==='MESA'?'Para una mesa':o.modalidad==='MOSTRADOR'?'Mostrador':o.modalidad==='PARA_LLEVAR'?'Para llevar':'A domicilio'}}</strong></div>
     <div><small>Productos</small><strong>{{activeLines().length}}</strong></div>
     <div><small>Total</small><strong>{{money(o.total)}}</strong></div>
     <div><small>Fecha</small><strong>{{o.abiertaEn|date:'dd/MM/yyyy HH:mm'}}</strong></div>
    </div>
    @if(o.ocupacionMesa?.mesa){<p class="ord-muted">Mesa {{o.ocupacionMesa?.mesa?.numero}} · {{o.ocupacionMesa?.mesa?.sala?.nombre}}</p>}
    @if(o.cuentasComoOrden.length){
     <p class="ord-note">
      @if(hasPendingPayment()){<strong>Falta cobrar {{money(unpaidAmount())}}</strong>}
      @else {<strong>Cuenta pagada</strong>}
     </p>
    }
    @if(o.estado==='ABIERTA'&&paymentsAccess.canRead()&&paymentsAccess.canCollect()){
     <div class="ord-actions pay-order-actions">
      <a class="ord-primary" [routerLink]="['/payments/order',o.id]">
       {{hasPendingPayment()?'Cobrar cuenta':'Ver cobros'}}
      </a>
     </div>
    }
    @if(o.estado==='ABIERTA'&&access.canManage()){
     <div class="ord-actions">
      @if(hasPendingLines()){
       <button type="button" (click)="send()" [disabled]="actionBusy()">Enviar a cocina</button>
      }
      <button type="button" (click)="close()" [disabled]="actionBusy()||!readyToClose()">Cerrar pedido</button>
      <button class="ord-danger" type="button" (click)="beginCancel()" [disabled]="actionBusy()">Cancelar pedido</button>
     </div>
     @if(hasPendingPayment()){
      <p class="ord-note">Este pedido sigue pendiente de cobro.</p>
     } @else if(!readyToClose()){
      <p class="ord-note">Aún hay productos pendientes de enviar o preparar.</p>
     }
    }
   </section>
   <section class="ord-card">
    <div class="ord-heading"><h2>Productos del pedido</h2>
     @if(o.estado==='ABIERTA'&&access.canManage()){
      <button type="button" class="ord-primary" (click)="showAdd.update(v=>!v)">
       {{showAdd()?'Cerrar productos':'Agregar productos'}}
      </button>
     }
    </div>
    <div class="ord-order-lines">
     @for(line of o.ordenLineasComoOrden;track line.id){
      <article class="ord-order-line ord-detail-order-item" [class.ord-faded]="line.canceladaEn">
       <div class="ord-detail-line-photo">
        @if(imageForVariant(line.varianteId);as photo){
         <img [src]="photo" [alt]="'Imagen de '+line.nombreSnapshot" loading="lazy"/>
        }@else{<span aria-hidden="true">Sin imagen</span>}
       </div>
       <div class="ord-line-title"><strong>{{line.nombreSnapshot}}</strong>
        <strong>{{money(line.subtotal)}}</strong></div>
       <small>{{qtyText(line.cantidad)}} unidades · {{money(line.precioUnitario)}} c/u</small>
       <gc-kitchen-modifiers [modifiers]="line.ordenLineaModificadoresComoOrdenLinea"/>
       @if(line.notasCocina){<small>Para cocina: {{line.notasCocina}}</small>}
       @if(line.canceladaEn){<span>Cancelada</span>}
       @else if(o.estado==='ABIERTA'&&access.canManage()){
        <div class="ord-actions">
         @if(!sent(line)){
          <button type="button" [disabled]="actionBusy()" (click)="beginEditLine(line)">
           Editar
          </button>
         }
         <button type="button" [disabled]="actionBusy()" (click)="beginCancelLine(line)">Cancelar línea</button>
        </div>
       }
      </article>
     } @empty {<p>No hay productos registrados.</p>}
    </div>
    @if(o.comandasComoOrden?.length){
     <h3>Preparación</h3>
     <div class="ord-small-list">@for(ticket of o.comandasComoOrden??[];track ticket.id){
      <span>Comanda {{ticket.numero}} · {{ticketStatus(ticket.estado)}}</span>
     }</div>
     @if(access.canKitchenRead()){
      <div class="ord-actions"><a routerLink="/orders/kitchen">Ver preparación y entrega en Cocina</a></div>
     }
    }
   </section>
   @if(o.estado==='ABIERTA'&&access.canManage()){
    @if(showAdd()){
     <button type="button" class="ord-overlay" [disabled]="actionBusy()"
      aria-label="Cerrar selector de productos" (click)="showAdd.set(false)"></button>
    <section class="ord-customizer ord-detail-dialog ord-detail-add-dialog"
     role="dialog" aria-modal="true" cdkTrapFocus [cdkTrapFocusAutoCapture]="true"
     aria-labelledby="order-add-title" id="order-add-products">
     <div class="ord-heading"><h2 id="order-add-title">Agregar productos</h2>
      <button type="button" (click)="showAdd.set(false)" [disabled]="actionBusy()">Cerrar</button></div>
     <p class="ord-muted">Solo se enviarán a cocina los productos nuevos que no se hayan enviado antes.</p>
     <gc-search-select id="detail-menu-variant" label="Producto y presentación"
      [items]="variantChoices()" [value]="variantId()" placeholder="Buscar producto"
      (valueChange)="pickVariant($event)"/>
     @if(selectedItem();as item){
      <div class="ord-detail-add-preview">
       @if(item.variante.imagenPrincipalUrl;as preview){
        <img [src]="preview" [alt]="'Imagen de '+(item.variante.producto?.nombre??item.variante.nombre)" loading="lazy"/>
       }
       <div><strong>{{item.variante.producto?.nombre??item.variante.nombre}}</strong>
        <small>{{item.variante.nombre}} · {{money(item.precio,item.moneda)}}</small></div>
      </div>
      <div class="ord-form-grid">
       <label>Cantidad <input [value]="addQty()" inputmode="decimal"
        (input)="addQty.set($any($event.target).value)"/></label>
       @if(access.canDiscount()){<label>Descuento <input [value]="addDiscount()" inputmode="decimal"
        (input)="addDiscount.set($any($event.target).value)"/></label>}
      </div>
      @for(group of item.gruposModificadores;track group.grupoId){
       <fieldset class="ord-choice-group"><legend>{{group.grupo}} · mínimo {{group.minimo}}</legend>
        @for(extra of group.opciones;track extra.id){
         <label class="ord-extra">
          <input type="checkbox" [checked]="hasExtra(group.grupoId,extra.id)"
           (change)="selectExtra(group,extra.id,$any($event.target).checked)"/>
          <span>{{extra.nombre}}</span><small>+{{money(extra.recargo)}}</small>
         </label>
        }
       </fieldset>
      }
      <label>Nota para cocina <textarea rows="2" [value]="addNotes()" maxlength="300"
       (input)="addNotes.set($any($event.target).value)"></textarea></label>
      <label class="ord-check-row"><input type="checkbox" [checked]="sendAdded()"
       (change)="sendAdded.set($any($event.target).checked)"/> Enviar nuevos productos a cocina</label>
      <div class="ord-actions"><button class="ord-primary" type="button" [disabled]="actionBusy()"
       (click)="addLine()">Agregar al pedido</button></div>
     }
    </section>
    }
    <section class="ord-card ord-detail-notes">
     <div class="ord-heading"><h2>Notas del pedido</h2>
      <button type="button" (click)="showNotes.update(v=>!v)">
       {{showNotes()?'Ocultar edición':'Editar notas'}}
      </button>
     </div>
     @if(!showNotes()){<p class="ord-note">{{o.observaciones||'Sin observaciones adicionales.'}}</p>}
     @if(showNotes()){
     <label>Observaciones
      <textarea rows="2" maxlength="500" [value]="observations()"
       (input)="observations.set($any($event.target).value)"></textarea>
     </label>
     <div class="ord-actions"><button type="button" class="ord-primary" [disabled]="actionBusy()" (click)="saveNotes()">Guardar notas</button>
      <button type="button" (click)="showNotes.set(false);observations.set(o.observaciones??'')" [disabled]="actionBusy()">Descartar cambios</button>
     </div>
     }
    </section>
   }
   @if(editItem();as line){
    <button type="button" class="ord-overlay" (click)="closeEdit()"
     aria-label="Cerrar edición de producto" [disabled]="actionBusy()"></button>
    <section class="ord-customizer ord-detail-dialog" role="dialog" aria-modal="true"
     aria-labelledby="order-edit-title" cdkTrapFocus [cdkTrapFocusAutoCapture]="true">
     <div class="ord-heading"><h2 id="order-edit-title">Editar {{line.nombreSnapshot}}</h2>
      <button type="button" (click)="closeEdit()" [disabled]="actionBusy()">Cerrar</button>
     </div>
     <div class="ord-form-grid">
      <label>Cantidad <input [value]="editQty()" (input)="editQty.set($any($event.target).value)"
       inputmode="decimal"/></label>
      @if(access.canDiscount()){<label>Descuento
       <input inputmode="decimal" [value]="editDiscount()" (input)="editDiscount.set($any($event.target).value)"/>
      </label>}
     </div>
     <label>Nota para cocina <textarea rows="2" maxlength="300" [value]="editNotes()"
      (input)="editNotes.set($any($event.target).value)"></textarea></label>
     <div class="ord-actions"><button type="button" class="ord-primary" [disabled]="actionBusy()" (click)="saveLine()">Guardar cambios</button>
      <button type="button" (click)="closeEdit()" [disabled]="actionBusy()">Descartar</button></div>
    </section>
   }
   @if(cancelTarget()){
    <button type="button" class="ord-overlay" [disabled]="actionBusy()"
     (click)="closeCancel()" aria-label="Cerrar cancelación"></button>
    <section class="ord-customizer ord-detail-dialog" role="dialog" aria-modal="true"
     aria-labelledby="order-cancel-title" cdkTrapFocus [cdkTrapFocusAutoCapture]="true">
     <div class="ord-heading">
      <h2 id="order-cancel-title">{{cancelTarget()==='order'?'Cancelar pedido':'Cancelar producto'}}</h2>
      <button type="button" (click)="closeCancel()" [disabled]="actionBusy()">Cerrar</button>
     </div>
     <label>Motivo (al menos 5 caracteres)
      <textarea rows="2" maxlength="500" [value]="reason()"
       (input)="reason.set($any($event.target).value)"></textarea>
     </label>
     @if(cancelTarget()==='order'){
      <gc-search-select id="order-cancel-class" label="Clasificación de cancelación"
       [items]="cancellationChoices" [value]="classification()"
       placeholder="Seleccionar si hubo preparación" [searchable]="false"
       (valueChange)="setClassification($event)"/>
      <p class="ord-note">Los ingredientes ya utilizados no se devuelven automáticamente al inventario.</p>
     }
     <div class="ord-actions"><button class="ord-danger" type="button"
      [disabled]="reason().trim().length<5||actionBusy()" (click)="confirmCancel()">
      Confirmar cancelación</button>
      <button type="button" (click)="closeCancel()" [disabled]="actionBusy()">Volver</button></div>
    </section>
   }
  }
 </main>`
})
export class GcOrdersDetailPage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 private readonly api=inject(OrdersApi);
 private readonly catalog=inject(CatalogApi);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 protected readonly branch=inject(GcBranchContext);
 protected readonly access=inject(OrdersAccess);
 protected readonly paymentsAccess=inject(PaymentsAccess);
 protected readonly money=money;protected readonly qtyText=qtyText;
 protected readonly ticketStatus=(state:'PENDIENTE'|'PREPARANDO'|'LISTA'|'CANCELADA')=>
  state==='LISTA'?'Lista para entregar':statusText(state);
 protected readonly cancellationChoices=CANCELLATION_CLASSES;
 protected readonly order=signal<OrderDetail|null>(null);
 protected readonly busy=signal(false);protected readonly actionBusy=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly observations=signal('');
 protected readonly showAdd=signal(false);protected readonly showNotes=signal(false);
 protected readonly editItem=signal<OrderLine|null>(null);
 protected readonly editQty=signal('1');protected readonly editDiscount=signal('0');protected readonly editNotes=signal('');
 protected readonly cancelTarget=signal('');protected readonly reason=signal('');
 protected readonly classification=signal<CancellationClass|''>('');
 protected readonly menu=signal<CatalogBranchMenu|null>(null);
 protected readonly variantId=signal('');
 protected readonly addQty=signal('1');protected readonly addDiscount=signal('0');
 protected readonly addNotes=signal('');protected readonly sendAdded=signal(true);
 private readonly extras=signal<Record<string,string[]>>({});
 private pendingOperation:{signature:string;key:string}|null=null;
 private loadGeneration=0;
 /** Reuse the key only for the identical mutation; a different action or payload must get a new one. */
 private keyFor(action:string,payload:unknown):string{
  const signature=action+':'+JSON.stringify(payload);
  if(this.pendingOperation?.signature!==signature)
   this.pendingOperation={signature,key:operationKey(action)};
  return this.pendingOperation.key;
 }
 protected readonly activeLines=computed(()=>this.order()?.ordenLineasComoOrden.filter(x=>!x.canceladaEn)??[]);
 protected readonly unpaidAmount=computed(()=>{
  const accounts=this.order()?.cuentasComoOrden??[];
  const due=accounts.reduce((sum,a)=>sum.plus(
   parseApiDecimal(a.total).minus(parseApiDecimal(a.pagado))),parseApiDecimal('0'));
  return due.greaterThan(0)?due.toFixed(2):'0.00';
 });
 protected readonly hasPendingPayment=computed(()=>{
  const accounts=this.order()?.cuentasComoOrden??[];
  return !accounts.length||accounts.some(a=>!parseApiDecimal(a.pagado).equals(parseApiDecimal(a.total)));
 });
 protected readonly hasPendingLines=computed(()=>this.order()?.ordenLineasComoOrden.some(
  line=>!line.canceladaEn&&
   parseApiDecimal(line.cantidadEnviada).lessThan(parseApiDecimal(line.cantidad)))??false);
 protected readonly readyToClose=computed(()=>{
  const o=this.order();if(!o||o.estado!=='ABIERTA'||this.hasPendingPayment())return false;
  if(this.hasPendingLines())return false;
  return !(o.comandasComoOrden??[]).some(t=>t.estado==='PENDIENTE'||t.estado==='PREPARANDO');
 });
 protected readonly options=computed(()=>{
  const items:CatalogProjectedItem[]=[];
  for(const menu of this.menu()?.menus??[])for(const section of menu.secciones)items.push(...section.items);
  return items;
 });
 protected readonly variantChoices=computed(()=>this.options().map(x=>({
  id:x.variante.id,label:(x.variante.producto?.nombre??x.variante.nombre)+' · '+x.variante.nombre
 })));
 protected readonly selectedItem=computed(()=>this.options().find(x=>x.variante.id===this.variantId())??null);
 protected readonly imageMap=computed(()=>new Map(this.options().map(item=>[
  item.variante.id,item.variante.imagenPrincipalUrl??null
 ])));
 protected imageForVariant(id:string){return this.imageMap().get(id)??null;}
 ngOnInit(){void this.load()}
 @HostListener('document:keydown.escape')
 protected dismissDialog(){
  if(this.actionBusy())return;
  if(this.cancelTarget())this.closeCancel();
  else if(this.editItem())this.closeEdit();
  else if(this.showAdd())this.showAdd.set(false);
 }
 protected closeEdit(){if(!this.actionBusy())this.editItem.set(null)}
 protected closeCancel(){if(!this.actionBusy())this.cancelTarget.set('')}
 protected beginEditLine(line:OrderLine){
  if(this.actionBusy())return;
  this.cancelTarget.set('');
  this.editItem.set(line);this.editQty.set(line.cantidad);
  this.editNotes.set(line.notasCocina??'');this.editDiscount.set(line.descuento);
 }

 protected sent(line:OrderLine){return Number(line.cantidadEnviada)>0}
 protected async load(){
  const id=this.route.snapshot.paramMap.get('id');if(!id)return;
  const generation=++this.loadGeneration;
  this.busy.set(true);this.error.set(null);
  try{
   const o=await firstValueFrom(this.api.detail(id));
   if(generation!==this.loadGeneration)return;
   this.order.set(o);this.observations.set(o.observaciones??'');
   try{
    const menu=await firstValueFrom(this.catalog.branchMenu(o.sucursalId));
    if(generation===this.loadGeneration)this.menu.set(menu);
   }catch{if(generation===this.loadGeneration)this.menu.set(null)}
  }catch(e){if(generation===this.loadGeneration)this.error.set(orderFriendlyError(e))}
  finally{if(generation===this.loadGeneration)this.busy.set(false)}
 }
 private async perform(action:()=>Promise<OrderDetail>){
  if(this.actionBusy())return;
  this.actionBusy.set(true);this.error.set(null);
  try{const o=await action();this.order.set(o);this.observations.set(o.observaciones??'');this.pendingOperation=null}
  catch(e){this.error.set(orderFriendlyError(e))}
  finally{this.actionBusy.set(false)}
 }
 protected async send(){
  const o=this.order();if(!o)return;
  const approved=await this.dialog.confirm({title:'Enviar a cocina',message:'¿Enviar los productos pendientes a cocina?',confirmText:'Enviar'});
  if(!approved)return;
  const key=this.keyFor('send',{id:o.id});
  await this.perform(()=>firstValueFrom(this.api.send(o.id,key)));
 }
 protected async close(){
  const o=this.order();if(!o)return;
  if(!this.readyToClose())return;
  if(!await this.dialog.confirm({title:'Cerrar pedido',
   message:o.ocupacionMesa?.mesa
    ?'¿Finalizar este pedido y liberar la mesa?'
    :'¿Finalizar este pedido?',
   confirmText:'Cerrar pedido'}))return;
  await this.perform(()=>firstValueFrom(this.api.close(o.id)));
 }
 protected async saveNotes(){
  const o=this.order();if(!o)return;
  await this.perform(()=>firstValueFrom(this.api.edit(o.id,{
   version:o.version,observaciones:this.observations().trim()
  })));
  if(!this.error())this.showNotes.set(false);
 }
 protected hasExtra(group:string,id:string){return (this.extras()[group]??[]).includes(id)}
 protected selectExtra(group:CatalogProjectedGroup,id:string,checked:boolean){
  const current=this.extras()[group.grupoId]??[];
  if(checked&&group.maximo!==null&&current.length>=group.maximo){this.error.set('Límite de opciones alcanzado en '+group.grupo);return}
  this.extras.update(x=>({...x,[group.grupoId]:checked?[...current,id]:current.filter(v=>v!==id)}));
  this.pendingOperation=null;
 }
 protected pickVariant(id:string){
  this.variantId.set(id);this.extras.set({});this.pendingOperation=null;this.error.set(null);
 }
 protected async addLine(){
  const o=this.order(),item=this.selectedItem();if(!o||!item)return;
  const qty=safeQuantity(this.addQty());
  if(!qty){this.error.set('Introduce una cantidad positiva con hasta tres decimales.');return}
  const modifierIds:string[]=[];
  for(const g of item.gruposModificadores){
   const ids=this.extras()[g.grupoId]??[];
   if(ids.length<g.minimo||(g.maximo!==null&&ids.length>g.maximo)){
    this.error.set('Revisa las opciones obligatorias de '+g.grupo);return;
   }
   modifierIds.push(...ids);
  }
  const payload={
   lineas:[{varianteId:item.variante.id,cantidad:qty,modificadores:modifierIds.map(modificadorId=>({modificadorId})),
    ...(this.access.canDiscount()&&this.addDiscount().trim()?{descuento:this.addDiscount().trim()}:{}),
    ...(this.addNotes().trim()?{notasCocina:this.addNotes().trim()}:{} )}],
   enviarCocina:this.sendAdded()
  };
  const key=this.keyFor('line-add',{id:o.id,...payload});
  await this.perform(()=>firstValueFrom(this.api.addLines(o.id,{...payload,claveOperacion:key})));
  if(!this.error()){
   this.variantId.set('');this.extras.set({});this.addQty.set('1');
   this.addNotes.set('');this.addDiscount.set('0');
   this.notices.show('Producto agregado al pedido. Puedes agregar otro.','success',5500);
  }
 }
 protected async saveLine(){
  const o=this.order(),line=this.editItem();if(!o||!line)return;
  const qty=safeQuantity(this.editQty());if(!qty){this.error.set('La cantidad no es válida.');return}
  const payload={
   cantidad:qty,notasCocina:this.editNotes().trim(),
   ...(this.access.canDiscount()?{descuento:this.editDiscount().trim()}:{} )
  };
  const key=this.keyFor('line-edit',{id:o.id,lineId:line.id,...payload});
  await this.perform(()=>firstValueFrom(this.api.editLine(o.id,line.id,{...payload,claveOperacion:key})));
  if(!this.error())this.editItem.set(null);
 }
 protected setClassification(value:string){
  this.classification.set(CANCELLATION_CLASSES.find(x=>x.id===value)?.id??'');
 }
 protected beginCancel(){
  this.editItem.set(null);this.cancelTarget.set('order');this.reason.set('');this.classification.set('');
 }
 protected beginCancelLine(line:OrderLine){
  this.editItem.set(null);this.cancelTarget.set(line.id);this.reason.set('');
 }
 protected async confirmCancel(){
  const o=this.order(),target=this.cancelTarget();if(!o||!target||this.reason().trim().length<5)return;
  if(!await this.dialog.confirm({title:'Confirmar cancelación',
   message:'La cancelación afecta al pedido y puede requerir autorización de un supervisor.',
   danger:true,confirmText:'Cancelar'}))return;
  if(target==='order'){
   await this.perform(()=>firstValueFrom(this.api.cancel(o.id,this.reason().trim(),this.classification()||undefined)));
  }else{
   await this.perform(()=>firstValueFrom(this.api.cancelLine(o.id,target,this.reason().trim())));
  }
  if(!this.error())this.cancelTarget.set('');
 }
}
