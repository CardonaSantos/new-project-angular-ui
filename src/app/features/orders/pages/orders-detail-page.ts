import {Component,computed,inject,OnInit,signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {CatalogApi} from '../../catalog/data-access/catalog.api';
import type {CatalogBranchMenu,CatalogProjectedGroup,CatalogProjectedItem} from '../../catalog/data-access/catalog.models';
import {GcOrdersNav} from '../orders-nav';
import {GcOrderStatus} from '../components/orders-ui';
import {OrdersApi} from '../data-access/orders.api';
import {OrdersAccess} from '../data-access/orders-access';
import {CANCELLATION_CLASSES,type CancellationClass,type OrderDetail, type OrderLine} from '../data-access/orders.models';
import {money,operationKey,qtyText,safeQuantity} from '../data-access/orders.helpers';

@Component({
 selector:'gc-orders-detail-page',
 imports:[RouterLink,DatePipe,GcOrdersNav,GcOrderStatus,GcSearchSelect],
 template:`
 <main class="ord-page"><gc-orders-nav/>
  <div class="ord-heading"><div><a routerLink="/orders/list">← Órdenes</a>
   <h1>Pedido {{order()?.numero??''}}</h1></div>
   @if(order();as o){<gc-order-status [state]="o.estado"/>}
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
     <p class="ord-note">Cuenta: {{money(o.cuentasComoOrden[0].pagado)}} pagados de {{money(o.cuentasComoOrden[0].total)}}.</p>
    }
    @if(o.estado==='ABIERTA'&&access.canManage()){
     <div class="ord-actions">
      <button type="button" (click)="send()" [disabled]="actionBusy()">Enviar pendientes a cocina</button>
      <button type="button" (click)="close()" [disabled]="actionBusy()">Cerrar pedido</button>
      <button class="ord-danger" type="button" (click)="beginCancel()" [disabled]="actionBusy()">Cancelar pedido</button>
     </div>
    }
   </section>
   <section class="ord-card">
    <h2>Productos del pedido</h2>
    <div class="ord-order-lines">
     @for(line of o.ordenLineasComoOrden;track line.id){
      <article class="ord-order-line" [class.ord-faded]="line.canceladaEn">
       <div class="ord-line-title"><strong>{{line.nombreSnapshot}}</strong>
        <strong>{{money(line.subtotal)}}</strong></div>
       <small>{{qtyText(line.cantidad)}} unidades · {{money(line.precioUnitario)}} c/u</small>
       @if(line.ordenLineaModificadoresComoOrdenLinea?.length){
        <small>{{extraNames(line)}}</small>
       }
       @if(line.notasCocina){<small>Para cocina: {{line.notasCocina}}</small>}
       @if(line.canceladaEn){<span>Cancelada</span>}
       @else if(o.estado==='ABIERTA'&&access.canManage()){
        <div class="ord-actions">
         @if(!sent(line)){
          <button type="button" [disabled]="actionBusy()" (click)="editItem.set(line);editQty.set(line.cantidad);editNotes.set(line.notasCocina??'');editDiscount.set(line.descuento)">
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
      <span>Comanda {{ticket.numero}} · {{ticket.estado}}</span>
     }</div>
    }
   </section>
   @if(o.estado==='ABIERTA'&&access.canManage()){
    <section class="ord-card">
     <h2>Agregar productos</h2>
     <p class="ord-muted">Solo se enviarán a cocina los productos nuevos que no se hayan enviado antes.</p>
     <gc-search-select id="detail-menu-variant" label="Producto y presentación"
      [items]="variantChoices()" [value]="variantId()" placeholder="Buscar producto"
      (valueChange)="pickVariant($event)"/>
     @if(selectedItem();as item){
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
    <section class="ord-card">
     <h2>Notas del pedido</h2>
     <label>Observaciones
      <textarea rows="2" maxlength="500" [value]="observations()"
       (input)="observations.set($any($event.target).value)"></textarea>
     </label>
     <div class="ord-actions"><button type="button" [disabled]="actionBusy()" (click)="saveNotes()">Guardar notas</button></div>
    </section>
   }
   @if(editItem();as line){
    <section class="ord-card">
     <h2>Editar {{line.nombreSnapshot}}</h2>
     <div class="ord-form-grid">
      <label>Cantidad <input [value]="editQty()" (input)="editQty.set($any($event.target).value)"
       inputmode="decimal"/></label>
      @if(access.canDiscount()){<label>Descuento
       <input inputmode="decimal" [value]="editDiscount()" (input)="editDiscount.set($any($event.target).value)"/>
      </label>}
     </div>
     <label>Nota para cocina <textarea rows="2" maxlength="300" [value]="editNotes()"
      (input)="editNotes.set($any($event.target).value)"></textarea></label>
     <div class="ord-actions"><button type="button" [disabled]="actionBusy()" (click)="saveLine()">Guardar línea</button>
      <button type="button" (click)="editItem.set(null)">Volver</button></div>
    </section>
   }
   @if(cancelTarget()){
    <section class="ord-card">
     <h2>{{cancelTarget()==='order'?'Cancelar pedido':'Cancelar producto'}}</h2>
     <label>Motivo (al menos 5 caracteres)
      <textarea rows="2" maxlength="500" [value]="reason()"
       (input)="reason.set($any($event.target).value)"></textarea>
     </label>
     @if(cancelTarget()==='order'){
      <gc-search-select id="order-cancel-class" label="Clasificación de cancelación"
       [items]="cancellationChoices" [value]="classification()"
       placeholder="Seleccionar si hubo preparación" [searchable]="false"
       (valueChange)="classification.set($event)"/>
      <p class="ord-note">Los ingredientes ya utilizados no se devuelven automáticamente al inventario.</p>
     }
     <div class="ord-actions"><button class="ord-danger" type="button"
      [disabled]="reason().trim().length<5||actionBusy()" (click)="confirmCancel()">
      Confirmar cancelación</button>
      <button type="button" (click)="cancelTarget.set('')">Volver</button></div>
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
 protected readonly branch=inject(GcBranchContext);
 protected readonly access=inject(OrdersAccess);
 protected readonly money=money;protected readonly qtyText=qtyText;
 protected readonly cancellationChoices=CANCELLATION_CLASSES;
 protected readonly order=signal<OrderDetail|null>(null);
 protected readonly busy=signal(false);protected readonly actionBusy=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly observations=signal('');
 protected readonly editItem=signal<OrderLine|null>(null);
 protected readonly editQty=signal('1');protected readonly editDiscount=signal('0');protected readonly editNotes=signal('');
 protected readonly cancelTarget=signal('');protected readonly reason=signal('');
 protected readonly classification=signal<CancellationClass|''>('');
 protected readonly menu=signal<CatalogBranchMenu|null>(null);
 protected readonly variantId=signal('');
 protected readonly addQty=signal('1');protected readonly addDiscount=signal('0');
 protected readonly addNotes=signal('');protected readonly sendAdded=signal(true);
 private readonly extras=signal<Record<string,string[]>>({});
 private pendingKey='';
 protected readonly activeLines=computed(()=>this.order()?.ordenLineasComoOrden.filter(x=>!x.canceladaEn)??[]);
 protected readonly options=computed(()=>{
  const items:CatalogProjectedItem[]=[];
  for(const menu of this.menu()?.menus??[])for(const section of menu.secciones)items.push(...section.items);
  return items;
 });
 protected readonly variantChoices=computed(()=>this.options().map(x=>({
  id:x.variante.id,label:(x.variante.producto?.nombre??x.variante.nombre)+' · '+x.variante.nombre
 })));
 protected readonly selectedItem=computed(()=>this.options().find(x=>x.variante.id===this.variantId())??null);
 ngOnInit(){void this.load()}
 protected extraNames(line:OrderLine){
  return (line.ordenLineaModificadoresComoOrdenLinea??[]).map(x=>x.nombreSnapshot).join(', ');
 }
 protected sent(line:OrderLine){return Number(line.cantidadEnviada)>0}
 protected async load(){
  const id=this.route.snapshot.paramMap.get('id');if(!id)return;
  this.busy.set(true);this.error.set(null);
  try{
   const o=await firstValueFrom(this.api.detail(id));this.order.set(o);
   this.observations.set(o.observaciones??'');
   try{this.menu.set(await firstValueFrom(this.catalog.branchMenu(o.sucursalId)))}
   catch{this.menu.set(null)}
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
 private async perform(action:()=>Promise<OrderDetail>){
  if(this.actionBusy())return;
  this.actionBusy.set(true);this.error.set(null);
  try{const o=await action();this.order.set(o);this.observations.set(o.observaciones??'');this.pendingKey=''}
  catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
 protected async send(){
  const o=this.order();if(!o)return;
  const approved=await this.dialog.confirm({title:'Enviar a cocina',message:'Enviar los productos pendientes a preparación?',confirmText:'Enviar'});
  if(!approved)return;
  if(!this.pendingKey)this.pendingKey=operationKey('send');
  await this.perform(()=>firstValueFrom(this.api.send(o.id,this.pendingKey)));
 }
 protected async close(){
  const o=this.order();if(!o)return;
  if(!await this.dialog.confirm({title:'Cerrar pedido',
   message:'El servidor verificará que la cuenta esté pagada y la preparación finalizada.',
   confirmText:'Cerrar pedido'}))return;
  await this.perform(()=>firstValueFrom(this.api.close(o.id)));
 }
 protected async saveNotes(){
  const o=this.order();if(!o)return;
  await this.perform(()=>firstValueFrom(this.api.edit(o.id,{
   version:o.version,observaciones:this.observations().trim()
  })));
 }
 protected hasExtra(group:string,id:string){return (this.extras()[group]??[]).includes(id)}
 protected selectExtra(group:CatalogProjectedGroup,id:string,checked:boolean){
  const current=this.extras()[group.grupoId]??[];
  if(checked&&group.maximo!==null&&current.length>=group.maximo){this.error.set('Límite de opciones alcanzado en '+group.grupo);return}
  this.extras.update(x=>({...x,[group.grupoId]:checked?[...current,id]:current.filter(v=>v!==id)}));
  this.pendingKey='';
 }
 protected pickVariant(id:string){
  this.variantId.set(id);this.extras.set({});this.pendingKey='';this.error.set(null);
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
  if(!this.pendingKey)this.pendingKey=operationKey('line-add');
  await this.perform(()=>firstValueFrom(this.api.addLines(o.id,{
   lineas:[{varianteId:item.variante.id,cantidad:qty,modificadores:modifierIds.map(modificadorId=>({modificadorId})),
    ...(this.access.canDiscount()&&this.addDiscount().trim()?{descuento:this.addDiscount().trim()}:{}),
    ...(this.addNotes().trim()?{notasCocina:this.addNotes().trim()}:{} )}],
   enviarCocina:this.sendAdded(),claveOperacion:this.pendingKey
  })));
  if(!this.error()){this.variantId.set('');this.extras.set({});this.addQty.set('1');this.addNotes.set('')}
 }
 protected async saveLine(){
  const o=this.order(),line=this.editItem();if(!o||!line)return;
  const qty=safeQuantity(this.editQty());if(!qty){this.error.set('La cantidad no es válida.');return}
  if(!this.pendingKey)this.pendingKey=operationKey('line-edit');
  await this.perform(()=>firstValueFrom(this.api.editLine(o.id,line.id,{
   cantidad:qty,notasCocina:this.editNotes().trim(),claveOperacion:this.pendingKey,
   ...(this.access.canDiscount()?{descuento:this.editDiscount().trim()}:{} )
  })));
  if(!this.error())this.editItem.set(null);
 }
 protected beginCancel(){this.cancelTarget.set('order');this.reason.set('');this.classification.set('')}
 protected beginCancelLine(line:OrderLine){this.cancelTarget.set(line.id);this.reason.set('')}
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
