import {Component,computed,effect,ElementRef,HostListener,inject,signal,viewChild} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {CdkTrapFocus} from '@angular/cdk/a11y';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {CatalogApi} from '../../catalog/data-access/catalog.api';
import type {CatalogBranchMenu,CatalogProjectedGroup,CatalogProjectedItem} from '../../catalog/data-access/catalog.models';
import {BranchesApi} from '../../organization/data-access/organization-api';
import type {BranchConfig} from '../../organization/data-access/organization.models';
import {sumDecimals,parseApiDecimal} from '../../../shared/formatting';
import {GcOrdersNav} from '../orders-nav';
import {GcPosProduct,GcPosCart} from '../components/orders-ui';
import {GcPosExpressCheckout} from '../components/pos-express-checkout';
import {asOrderLine,type PosCartEntry} from '../components/pos-cart.models';
import {OrdersApi} from '../data-access/orders.api';
import {OrdersAccess} from '../data-access/orders-access';
import {PaymentsAccess} from '../../payments/data-access/payments-access';
import {OrdersPreferences} from '../data-access/orders-preferences';
import {ORDER_MODES,type CreateOrderInput,type OrderDetail,type QuickCheckoutResult,type OrderMode,type TableRecord} from '../data-access/orders.models';
import {money,operationKey,orderFriendlyError} from '../data-access/orders.helpers';

@Component({
 selector:'gc-orders-pos-page',
 imports:[RouterLink,CdkTrapFocus,GcOrdersNav,GcSearchSelect,GcPosProduct,GcPosCart,GcPosExpressCheckout],
 template:`
 <main class="ord-page ord-pos"><gc-orders-nav/>
 <div class="ord-heading">
  <div><h1>Punto de venta</h1>
   <p class="ord-note">{{prefs.view()==='tables'?'Atención en mesas':'Venta en mostrador o para llevar'}} · {{cart().length}} líneas en el pedido</p></div>
  <div class="ord-view-switch" role="group" aria-label="Modo de atención">
   <button type="button" [class.active]="prefs.view()==='counter'"
    [attr.aria-pressed]="prefs.view()==='counter'" (click)="setView('counter')">Mostrador</button>
   <button type="button" [class.active]="prefs.view()==='tables'"
    [attr.aria-pressed]="prefs.view()==='tables'" (click)="setView('tables')">Mesas</button>
  </div>
 </div>
 @if(error()){<div role="alert" class="ord-alert">{{error()}}
   <button type="button" (click)="reload()">Reintentar</button></div>}
 @if(success()){
  <section class="ord-pos-confirmed" role="status" aria-live="polite">
   <div class="ord-pos-confirmed-content">
    <strong>{{expressSale()?'Venta cobrada correctamente':'Pedido registrado correctamente'}}</strong>
    <span>{{success()}}</span>
   </div>
   <div class="ord-actions ord-pos-confirmed-actions">
    <a class="ord-primary" [routerLink]="['/orders/list',createdId()]">Ver pedido</a>
    @if(expressSale();as sale){
     <a [routerLink]="['/payments/sales',sale.ventaId,'receipt']">Imprimir comprobante 80 mm</a>
     <button type="button" (click)="newSale()">Nueva venta</button>
    }
    @if(paymentsAccess.canRead()&&paymentsAccess.canCollect()){
     <a [routerLink]="['/payments/order',createdId()]">Cobrar ahora</a>
    }
    @if(access.canKitchenRead()){
     @for(ticket of createdTickets();track ticket.id){
      <a [routerLink]="['/orders/kitchen/tickets',ticket.id,'print']">
       Imprimir comanda {{ticket.numero}}</a>
     }
    }
   </div>
  </section>
 }
 @if(prefs.view()==='tables'&&showTablePicker()){
  <section class="ord-card ord-pos-tables">
   <div class="ord-heading"><h2>Elegir mesa</h2>
    <button type="button" (click)="loadTables()" [disabled]="tableBusy()">Actualizar mesas</button></div>
   @if(!access.canTablesRead()){<p>No tienes acceso al listado de mesas.</p>}
   @else{
    <div class="ord-pos-table-toolbar">
     <label for="pos-table-search">Buscar mesa o sala
      <input id="pos-table-search" type="search" [value]="tableSearch()"
       (input)="tableSearch.set($any($event.target).value)" placeholder="Número o nombre de sala"/>
     </label>
     <span class="ord-note">{{availableTableCount()}} disponibles · {{occupiedTableCount()}} ocupadas</span>
    </div>
    @if(tableBusy()){<p role="status" class="ord-note">Actualizando mesas…</p>}
    <div class="ord-table-grid">
     @for(table of filteredTables();track table.id){
      <button class="ord-table-tile" type="button" [disabled]="!table.activa" (click)="chooseTable(table)">
       <strong>Mesa {{table.numero}}</strong><small>{{table.sala.nombre}} · {{table.capacidad}} personas</small>
       <span [class.ord-occupied]="!!table.ocupacion">{{!table.activa?'Inactiva':table.ocupacion?'Ocupada · continuar pedido':'Disponible'}}</span>
      </button>
     } @empty {<p class="ord-empty">No se encontraron mesas con esta búsqueda.</p>}
    </div>
   }
   <div class="ord-actions"><a routerLink="/orders/tables">Ver todas las mesas</a>
    @if(selectedTable()){<span>Pedido para mesa {{selectedTable()?.numero}}</span>
     <button type="button" (click)="selectedTable.set(null);mode.set('MOSTRADOR');invalidateKey()">Quitar mesa</button>}
   </div>
  </section>
 }
 @if(prefs.view()==='tables'&&!showTablePicker()&&selectedTable()){
  <div class="ord-pos-table-context">
   <div><strong>Mesa {{selectedTable()?.numero}} · {{selectedTable()?.sala?.nombre}}</strong>
    @if(existingOrder();as current){
     <span>Orden {{current.numero}} · Total {{money(current.total,currency())}} ·
      {{current.ordenLineasComoOrden.length}} productos registrados</span>
    }@else{<span>Pedido nuevo</span>}
   </div>
   <div class="ord-actions">
    @if(existingOrder();as current){
     <a [routerLink]="['/orders/list',current.id]">Ver detalles</a>
     @if(paymentsAccess.canRead()){
      <a [routerLink]="['/payments/order',current.id]">Cobrar mesa</a>
     }
    }
    <button type="button" [disabled]="submitting()||tableBusy()" (click)="showTablePicker.set(true)">Cambiar mesa</button>
   </div>
  </div>
 }
 @if(tableBusy()&&selectedTable()){<p class="ord-note" role="status">Cargando el pedido de la mesa…</p>}
 <div class="ord-pos-layout">
  <section class="ord-catalog" aria-label="Catálogo de productos">
   <div class="ord-toolbar">
    <label>Buscar producto
     <input #productSearch type="search" [value]="query()" (input)="query.set($any($event.target).value)"
      placeholder="Nombre o presentación" autocomplete="off"/>
    </label>
    <div class="ord-actions">
     <button type="button" [class.active]="prefs.productLayout()==='visual'"
      [attr.aria-pressed]="prefs.productLayout()==='visual'"
      (click)="prefs.setLayout('visual')">Tarjetas</button>
     <button type="button" [class.active]="prefs.productLayout()==='compact'"
      [attr.aria-pressed]="prefs.productLayout()==='compact'"
      (click)="prefs.setLayout('compact')">Lista</button>
     <button type="button" (click)="reload()" [disabled]="busy()">Actualizar</button>
    </div>
   </div>
   <div class="ord-pos-catalog-meta"><span class="ord-note">{{filtered().length}} presentaciones disponibles</span>
    @if(query()||category()){<button type="button" (click)="query.set('');category.set('')">Limpiar búsqueda</button>}
   </div>
   <div class="ord-category-list" role="group" aria-label="Categorías">
    <button type="button" [class.active]="category()===''" (click)="category.set('')">Todos</button>
    @for(c of categories();track c){<button type="button" [class.active]="category()===c"
      (click)="category.set(c)">{{c}}</button>}
   </div>
   @if(busy()){<p role="status" class="ord-muted">Cargando carta…</p>}
   @else if(!menu()?.menus?.length){<p class="ord-empty">No hay carta publicada para esta sucursal y horario.</p>}
   <div class="ord-products" [class.ord-products--compact]="prefs.productLayout()==='compact'">
    @for(item of filtered();track item.id){
     <gc-pos-product [item]="item" [compact]="prefs.productLayout()==='compact'"
      (choose)="pick($event)"/>
    } @empty {
     @if(!busy()&&menu()?.menus?.length){<p class="ord-empty">No se encontraron productos.</p>}
    }
   </div>
  </section>
  <aside class="ord-checkout" [class.ord-checkout--open]="cartOpen()" aria-label="Resumen del pedido">
   <div class="ord-cart-close"><button type="button" (click)="cartOpen.set(false)">Cerrar resumen</button></div>
   <gc-pos-cart [items]="cart()" [total]="total()" [currency]="currency()"
    [disabled]="submitting()"
    (quantity)="changeQty($event)" (remove)="remove($event)"/>
   <div class="ord-checkout-options">
    @if(cart().length){<div class="ord-actions ord-pos-cart-tools">
     <span class="ord-note">El importe definitivo lo calcula el servidor.</span>
     <button type="button" class="ord-danger" [disabled]="submitting()" (click)="clearCart()">Vaciar carrito</button>
    </div>}
    <gc-search-select id="pos-modality" label="Tipo de pedido" [items]="modes()"
     [value]="mode()" [clearable]="false" [searchable]="false" [disabled]="submitting()"
     (valueChange)="chooseMode($event)"/>
    @if(mode()==='MESA'){
     <gc-search-select id="pos-table" label="Mesa" [items]="tableChoices()"
      [value]="selectedTable()?.id??''" [disabled]="!access.canTablesRead()||submitting()"
      placeholder="Seleccionar mesa" (valueChange)="selectTableId($event)"/>
    }
    <label>Observaciones del pedido
     <textarea rows="2" maxlength="500" [value]="observations()" [disabled]="submitting()"
      placeholder="Opcional" (input)="observations.set($any($event.target).value);invalidateKey()"></textarea>
    </label>
    @if(directOnly()){
     <p class="ord-note" role="status">
      Venta sin preparación: estos productos no generan comandas.
      El servidor registrará sus movimientos de inventario al procesarlos.
     </p>
    }@else{
     <label class="ord-check-row">
      <input type="checkbox" [checked]="sendKitchen()" [disabled]="submitting()"
       (change)="sendKitchen.set($any($event.target).checked);invalidateKey()"/>
      Procesar al confirmar (enviar preparados a Cocina y registrar salidas de stock)
     </label>
     @if(!sendKitchen()){
      <p class="ord-note" role="status">Quedarán pendientes de procesar.
       Para cerrar y registrar la venta, deberás procesarlos desde el detalle del pedido.</p>
     }
    }
    @if(config()?.exigeCobroAntesPreparar){
     <p class="ord-note">Esta sucursal exige cobrar antes de preparar. La orden quedará pendiente hasta registrar el pago.</p>
    } @else if(!config()){
     <p class="ord-note">La preparación seguirá las reglas vigentes de la sucursal.</p>
    }
    @if(submitError()){
     <p role="alert" class="ord-alert">{{submitError()}}</p>
     @if(submitError()?.includes('receta publicada')){
      <a routerLink="/recipes/list">Revisar recetas publicadas</a>
     } @else if(submitError()?.includes('precio vigente')){
      <a routerLink="/catalog/prices">Revisar precios</a>
     } @else if(submitError()?.includes('estación de cocina')){
      <a routerLink="/orders/settings">Configurar cocina</a>
     }
    }
    @if(directOnly()&&mode()!=='MESA'&&paymentsAccess.canCollect()&&access.canCreate()){
     <button class="ord-primary ord-confirm" type="button"
      [disabled]="submitting()||!cart().length"
      (click)="beginExpress()">Cobrar ahora · {{money(total(),currency())}}</button>
     <button class="ord-secondary-action" type="button" [disabled]="submitting()"
      (click)="submit()">Guardar sin cobrar</button>
    }@else{
     <button class="ord-primary ord-confirm" type="button"
      [disabled]="submitting()||tableBusy()||!access.canCreate()||cart().length===0||(mode()==='MESA'&&!selectedTable())"
      (click)="submit()">{{submitting()?'Guardando…':existingOrder()?'Agregar productos al pedido':'Confirmar pedido · '+money(total(),currency())}}</button>
    }
   </div>
  </aside>
 </div>
 @if(cart().length){<button class="ord-mobile-cart" type="button" (click)="cartOpen.set(true)">
  Ver pedido · {{cart().length}} productos · {{money(total(),currency())}}
 </button>}
 @if(quickDraft();as draft){
  <gc-pos-express-checkout [order]="draft" (cancel)="quickDraft.set(null)"
   (completed)="completeExpress($event)"/>
 }
 @if(configuring();as item){
  <div class="ord-overlay" role="presentation" (click)="configureClose()"></div>
  <section class="ord-customizer" role="dialog" aria-modal="true"
   cdkTrapFocus [cdkTrapFocusAutoCapture]="true" aria-labelledby="configure-title">
   <div class="ord-heading"><h2 id="configure-title">{{item.variante.producto?.nombre??item.variante.nombre}}</h2>
    <button type="button" (click)="configureClose()" aria-label="Cerrar">×</button></div>
   <p class="ord-muted">{{item.variante.nombre}} · {{money(item.precio,item.moneda)}}</p>
   @for(group of item.gruposModificadores;track group.grupoId){
    <fieldset class="ord-choice-group">
     <legend>{{group.grupo}} <small>Elige {{group.minimo}} {{group.maximo===null?'o más': 'a '+group.maximo}}</small></legend>
     @for(extra of group.opciones;track extra.id){
      <label class="ord-extra">
       <input type="checkbox" [checked]="extraSelected(group.grupoId,extra.id)"
        (change)="toggleExtra(group,extra.id,$any($event.target).checked)"/>
       <span>{{extra.nombre}}</span><small>+{{money(extra.recargo,item.moneda)}}</small>
      </label>
     }
    </fieldset>
   }
   <div class="ord-form-grid">
    <label>Cantidad
     <input type="number" min="1" max="999" step="1" inputmode="numeric" [value]="customQty()"
      (input)="customQty.set($any($event.target).valueAsNumber||1)"/>
    </label>
    @if(access.canDiscount()){<label>Descuento por línea
     <input type="text" inputmode="decimal" [value]="customDiscount()"
      (input)="customDiscount.set($any($event.target).value)" placeholder="0.00"/>
    </label>}
   </div>
   <label>Nota para cocina
    <textarea rows="2" maxlength="300" [value]="customNotes()"
     (input)="customNotes.set($any($event.target).value)" placeholder="Opcional"></textarea>
   </label>
   @if(configError()){<p class="ord-alert" role="alert">{{configError()}}</p>}
   <div class="ord-actions ord-custom-actions">
    <button type="button" (click)="configureClose()">Cancelar</button>
    <button type="button" class="ord-primary" (click)="addConfigured()">Agregar al pedido</button>
   </div>
  </section>
 }
 </main>`
})
export class GcOrdersPosPage{
 private readonly api=inject(OrdersApi);
 private readonly catalog=inject(CatalogApi);
 private readonly branchesApi=inject(BranchesApi);
 private readonly confirm=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 private readonly activatedRoute=inject(ActivatedRoute);
 protected readonly context=inject(GcBranchContext);
 protected readonly access=inject(OrdersAccess);
 protected readonly paymentsAccess=inject(PaymentsAccess);
 protected readonly prefs=inject(OrdersPreferences);
 private readonly searchInput=viewChild<ElementRef<HTMLInputElement>>('productSearch');
 protected readonly modes=computed(()=>
  ORDER_MODES.filter(m=>m.id!=='MESA'||this.access.canTablesRead()));
 protected readonly menu=signal<CatalogBranchMenu|null>(null);
 protected readonly tables=signal<TableRecord[]>([]);
 protected readonly tableSearch=signal('');protected readonly tableBusy=signal(false);
 protected readonly config=signal<BranchConfig|null>(null);
 protected readonly query=signal('');
 protected readonly category=signal('');
 protected readonly cart=signal<PosCartEntry[]>([]);
 protected readonly busy=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly submitError=signal<string|null>(null);
 protected readonly success=signal('');
 protected readonly createdId=signal('');
 protected readonly createdTickets=signal<{id:string;numero:string}[]>([]);
 protected readonly expressSale=signal<QuickCheckoutResult|null>(null);
 protected readonly quickDraft=signal<CreateOrderInput|null>(null);
 protected readonly existingOrder=signal<OrderDetail|null>(null);
 protected readonly observations=signal('');
 protected readonly mode=signal<OrderMode>('MOSTRADOR');
 protected readonly selectedTable=signal<TableRecord|null>(null);
 protected readonly sendKitchen=signal(true);
 protected readonly productTypes=computed(()=>new Map(
  (this.menu()?.menus??[]).flatMap(menu=>menu.secciones.flatMap(section=>
   section.items.map(item=>[item.variante.id,item.variante.producto?.tipo] as const)
  ))
 ));
 protected readonly directOnly=computed(()=>this.cart().length>0&&this.cart().every(line=>{
  const type=this.productTypes().get(line.variantId);
  return type==='INVENTARIABLE'||type==='SERVICIO';
 }));
 protected readonly submitting=signal(false);
 protected readonly cartOpen=signal(false);
 protected readonly showTablePicker=signal(true);
 protected readonly configuring=signal<CatalogProjectedItem|null>(null);
 protected readonly customQty=signal(1);
 protected readonly customNotes=signal('');
 protected readonly customDiscount=signal('0');
 protected readonly configError=signal('');
 private readonly selectedExtras=signal<Record<string,string[]>>({});
 private operationId='';
 private loadingGeneration=0;private tableGeneration=0;
 private pendingTableFromUrl=this.activatedRoute.snapshot.queryParamMap.get('mesaId')??'';
 protected readonly money=money;
 protected readonly categories=computed(()=>{
  const categories=new Set<string>();
  for(const menu of this.menu()?.menus??[])for(const section of menu.secciones)categories.add(section.nombre);
  return [...categories];
 });
 protected readonly filtered=computed(()=>{
  const search=this.query().trim().toLocaleLowerCase('es');
  const list:CatalogProjectedItem[]=[];
  const ids=new Set<string>();
  for(const menu of this.menu()?.menus??[])for(const section of menu.secciones){
   if(this.category()&&section.nombre!==this.category())continue;
   for(const item of section.items){
    const names=[item.variante.producto?.nombre,item.variante.nombre,item.variante.sku].join(' ').toLocaleLowerCase('es');
    if(search&&!names.includes(search))continue;
    if(!ids.has(item.id)){list.push(item);ids.add(item.id)}
   }
  }
  return list;
 });
 protected readonly availableTableCount=computed(()=>this.tables().filter(t=>t.activa&&!t.ocupacion).length);
 protected readonly occupiedTableCount=computed(()=>this.tables().filter(t=>t.activa&&t.ocupacion).length);
 protected readonly filteredTables=computed(()=>{
  const term=this.tableSearch().trim().toLocaleLowerCase('es');
  return this.tables().filter(t=>!term||(t.numero+' '+t.sala.nombre).toLocaleLowerCase('es').includes(term));
 });
 protected readonly tableChoices=computed(()=>this.tables().filter(x=>x.activa).map(t=>({
  id:t.id,label:t.sala.nombre+' · Mesa '+t.numero+(t.ocupacion?' (ocupada)':'')
 })));
 protected readonly total=computed(()=>{
  const amounts=this.cart().map(line=>parseApiDecimal(line.price).mul(line.quantity).minus(line.discount||'0').toFixed());
  return sumDecimals(amounts);
 });
 protected readonly currency=computed(()=>this.cart()[0]?.currency??this.config()?.moneda??'GTQ');
 constructor(){effect(()=>{
  const branch=this.context.branchId();
  this.prefs.load();
  if(branch){
   this.selectedTable.set(null);this.existingOrder.set(null);this.quickDraft.set(null);
   this.expressSale.set(null);this.mode.set('MOSTRADOR');this.cart.set([]);
   this.invalidateKey();void this.reload();
  }
 })}
 hasUnsavedChanges():boolean{return this.cart().length>0}
 @HostListener('document:keydown',['$event'])
 protected keydown(event:KeyboardEvent){
  const t=event.target as HTMLElement|null;
  if((event.key==='/'||event.key==='F2')&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&
   !['INPUT','TEXTAREA','SELECT'].includes(t?.tagName??'')){
    event.preventDefault();this.searchInput()?.nativeElement.focus();
  }
  if(event.key==='Escape'&&this.configuring())this.configureClose();
  if(event.key==='Escape'&&this.quickDraft())this.quickDraft.set(null);
  if(event.key==='F4'&&!this.configuring()&&!this.quickDraft()&&
   !['INPUT','TEXTAREA','SELECT'].includes(t?.tagName??'')){
   event.preventDefault();this.beginExpress();
  }
 }
 protected setView(mode:'counter'|'tables'){
  if(this.submitting())return;
  this.prefs.setView(mode);
  if(mode==='counter'){
   this.selectedTable.set(null);this.existingOrder.set(null);this.mode.set('MOSTRADOR');
  }
  this.showTablePicker.set(mode==='tables');
  if(mode==='tables')void this.loadTables();
 }
 protected chooseMode(value:string){
  if(this.submitting())return;
  const v=ORDER_MODES.find(x=>x.id===value)?.id??'MOSTRADOR';
  this.mode.set(v);if(v!=='MESA'){this.selectedTable.set(null);this.existingOrder.set(null)}
  if(v==='MESA'&&!this.tables().length)void this.loadTables();
  this.invalidateKey();
 }
 protected async reload(){
  const branch=this.context.branchId();if(!branch)return;
  const gen=++this.loadingGeneration;this.busy.set(true);this.error.set(null);
  try{
   const result=await firstValueFrom(this.catalog.branchMenu(branch));
   if(gen===this.loadingGeneration){this.menu.set(result);this.category.set('')}
  }catch(e){if(gen===this.loadingGeneration)this.error.set(orderFriendlyError(e))}
  finally{if(gen===this.loadingGeneration)this.busy.set(false)}
  try{const c=await firstValueFrom(this.branchesApi.config(branch));if(gen===this.loadingGeneration)this.config.set(c)}
  catch{if(gen===this.loadingGeneration)this.config.set(null)}
  if(this.prefs.view()==='tables'||this.pendingTableFromUrl)void this.loadTables();
 }
 protected async loadTables(){
  const branch=this.context.branchId();
  if(!branch||!this.access.canTablesRead())return;
  const generation=++this.tableGeneration;
  this.tableBusy.set(true);
  try{
   const tables=await firstValueFrom(this.api.tables(branch));
   if(generation!==this.tableGeneration||branch!==this.context.branchId())return;
   this.tables.set(tables);
   if(this.pendingTableFromUrl){
    const selected=tables.find(x=>x.id===this.pendingTableFromUrl&&x.activa);
    this.pendingTableFromUrl='';
    if(selected)this.chooseTable(selected);
    else this.error.set('La mesa seleccionada no está disponible.');
   }
  }catch(e){
   if(generation===this.tableGeneration&&branch===this.context.branchId())
    this.error.set(orderFriendlyError(e));
  }finally{if(generation===this.tableGeneration)this.tableBusy.set(false)}
 }
 protected chooseTable(t:TableRecord){
  if(this.submitting())return;
  const existing=t.ocupacion?.ordenesComoOcupacionMesa?.find(x=>x.estado==='ABIERTA');
  this.selectedTable.set(t);this.existingOrder.set(null);
  this.mode.set('MESA');this.invalidateKey();this.showTablePicker.set(false);
  if(existing)void this.loadExistingOrder(existing.id,t.id);
 }
 protected selectTableId(id:string){
  if(this.submitting())return;
  const t=this.tables().find(x=>x.id===id)||null;
  if(t){this.chooseTable(t);return}
  this.selectedTable.set(null);this.existingOrder.set(null);this.invalidateKey();
 }
 protected pick(item:CatalogProjectedItem){
  if(this.submitting())return;
  this.success.set('');this.createdId.set('');this.expressSale.set(null);
  this.configError.set('');
  if(item.gruposModificadores.length){
   this.configuring.set(item);this.selectedExtras.set({});this.customQty.set(1);
   this.customNotes.set('');this.customDiscount.set('0');return;
  }
  this.addLine(item,1,[],[],'','0');
 }
 protected extraSelected(group:string,id:string){
  return (this.selectedExtras()[group]??[]).includes(id);
 }
 protected toggleExtra(group:CatalogProjectedGroup,id:string,checked:boolean){
  const current=this.selectedExtras()[group.grupoId]??[];
  if(checked&&group.maximo!==null&&current.length>=group.maximo){this.configError.set('Ya seleccionaste el máximo de este grupo.');return}
  this.configError.set('');
  const next=checked?[...current,id]:current.filter(x=>x!==id);
  this.selectedExtras.update(x=>({...x,[group.grupoId]:next}));
 }
 protected configureClose(){this.configuring.set(null);this.configError.set('')}
 protected addConfigured(){
  if(this.submitting())return;
  const item=this.configuring();if(!item)return;
  const qty=Math.trunc(this.customQty());
  if(!Number.isFinite(qty)||qty<1||qty>999){this.configError.set('Escribe una cantidad válida entre 1 y 999.');return}
  const modifierIds:string[]=[];const labels:string[]=[];const extraPrices:string[]=[];
  for(const group of item.gruposModificadores){
   const ids=this.selectedExtras()[group.grupoId]??[];
   if(ids.length<group.minimo||(group.maximo!==null&&ids.length>group.maximo)){
    this.configError.set('Revisa las opciones obligatorias de '+group.grupo+'.');return;
   }
   for(const id of ids){const choice=group.opciones.find(x=>x.id===id);
    if(!choice){this.configError.set('Una opción ya no está disponible.');return}
    modifierIds.push(id);labels.push(choice.nombre);extraPrices.push(choice.recargo);
   }
  }
  const discount=this.customDiscount().trim()||'0';
  try{const amount=parseApiDecimal(discount);if(amount.lt(0)||amount.decimalPlaces()>2||
    amount.gt(parseApiDecimal(sumDecimals([item.precio,...extraPrices])).mul(qty))){
   this.configError.set('El descuento no es válido para este producto.');return;
  }}catch{this.configError.set('Escribe un descuento válido.');return}
  this.addLine(item,qty,modifierIds,labels,this.customNotes(),discount,extraPrices);
  this.configureClose();
 }
 private addLine(item:CatalogProjectedItem,qty:number,mods:string[],extras:string[],notes:string,discount:string,extraPrices:string[]=[]){
  if(this.cart().length>=100){this.submitError.set('El pedido admite hasta 100 líneas.');return}
  this.cart.update(list=>[...list,{key:operationKey('item'),variantId:item.variante.id,
   name:item.variante.producto?.nombre??item.variante.nombre,variant:item.variante.nombre,
   price:sumDecimals([item.precio,...extraPrices]),currency:item.moneda,quantity:qty,
   modifierIds:mods,extras,notes:notes.trim().slice(0,300),discount}]);
  this.invalidateKey();this.submitError.set('');
 }
 protected changeQty(change:{key:string;delta:number}){
  if(this.submitting())return;
  this.cart.update(lines=>lines.map(x=>x.key===change.key?
   {...x,quantity:Math.min(999,Math.max(1,x.quantity+change.delta))}:x));
  this.invalidateKey();
 }
 protected remove(id:string){if(this.submitting())return;this.cart.update(lines=>lines.filter(x=>x.key!==id));this.invalidateKey()}
 protected invalidateKey(){if(!this.submitting())this.operationId=''}
 protected async clearCart(){
  if(this.submitting()||!this.cart().length)return;
  if(!await this.confirm.confirm({title:'Vaciar pedido actual',
   message:'Se quitarán todos los productos sin crear ni cancelar ninguna orden en el servidor.',
   confirmText:'Vaciar carrito',danger:true}))return;
  this.cart.set([]);this.submitError.set('');this.invalidateKey();this.cartOpen.set(false);
 }
 protected async submit(){
  const branch=this.context.branchId();if(!branch||this.submitting()||!this.cart().length)return;
  if(this.mode()==='MESA'&&!this.selectedTable()){this.submitError.set('Selecciona una mesa.');return}
  if(!this.operationId)this.operationId=operationKey('pos');
  // Direct products MUST be sent through the server processing step:
  // INVENTARIABLE -> inventory consumption, SERVICIO -> sent flag, neither creates KDS tickets.
  const shouldProcess=this.directOnly()?true:this.sendKitchen();
  const dto={
   sucursalId:branch,modalidad:this.mode(),origen:this.mode()==='MESA'?'MESERO' as const:'CAJA' as const,
   ...(this.mode()==='MESA'&&this.selectedTable()?{mesaId:this.selectedTable()!.id}:{}),
   ...(this.observations().trim()?{observaciones:this.observations().trim()}:{}),
   lineas:this.cart().map(asOrderLine),enviarCocina:shouldProcess,claveOperacion:this.operationId
  };
  this.submitting.set(true);this.submitError.set('');
  try{
   const existing=this.existingOrder();
   const data=existing
    ?await firstValueFrom(this.api.addLines(existing.id,{
      lineas:dto.lineas,enviarCocina:dto.enviarCocina,claveOperacion:dto.claveOperacion
     }))
    :await firstValueFrom(this.api.create(dto));
   this.createdId.set(data.id);
   this.createdTickets.set((data.comandasComoOrden??[]).map(x=>({id:x.id,numero:x.numero})));
   const kitchenCreated=(data.comandasComoOrden??[]).length>0;
   const hasUnprocessed=(data.ordenLineasComoOrden??[]).some(line=>
    parseApiDecimal(line.cantidadEnviada).lt(parseApiDecimal(line.cantidad)));
   const status=kitchenCreated?' · Enviada a Cocina':
    hasUnprocessed?' · Pendiente de procesar antes de cerrar':
    ' · Procesada sin comanda de Cocina';
   const message=existing
    ?this.cart().length+' productos agregados a '+data.numero+status+'.'
    :'Orden '+data.numero+' creada'+status+'.';
   this.success.set(message);
   this.notices.show(message,'success',7000);
   this.cart.set([]);this.observations.set('');
   this.operationId='';this.cartOpen.set(false);
   if(existing){
    this.existingOrder.set(data);
   }else{
    this.selectedTable.set(null);this.existingOrder.set(null);
    this.mode.set('MOSTRADOR');
    this.showTablePicker.set(this.prefs.view()==='tables');
   }
   if(this.prefs.view()==='tables')void this.loadTables();
  }catch(e){this.submitError.set(orderFriendlyError(e))}
  finally{this.submitting.set(false)}
 }
 protected async loadExistingOrder(id:string,tableId:string){
  const branch=this.context.branchId();if(!branch)return;
  this.tableBusy.set(true);this.submitError.set('');
  try{
   const order=await firstValueFrom(this.api.detail(id));
   if(this.context.branchId()!==branch||this.selectedTable()?.id!==tableId)return;
   if(order.estado!=='ABIERTA'||order.sucursalId!==branch){
    this.submitError.set('El pedido ya no está abierto. Actualiza las mesas.');
    return;
   }
   this.existingOrder.set(order);
  }catch(e){this.submitError.set(orderFriendlyError(e))}
  finally{if(this.context.branchId()===branch)this.tableBusy.set(false)}
 }
 protected beginExpress(){
  const branch=this.context.branchId();
  if(!branch||this.submitting()||!this.cart().length||!this.directOnly()||
   this.mode()==='MESA'||this.mode()==='DELIVERY'||!this.paymentsAccess.canCollect()||
   !this.access.canCreate())return;
  this.quickDraft.set({
   sucursalId:branch,modalidad:this.mode(),origen:'CAJA',
   lineas:this.cart().map(asOrderLine),
   ...(this.observations().trim()?{observaciones:this.observations().trim()}:{}),
   enviarCocina:true,claveOperacion:operationKey('pos-express')
  });
 }
 protected completeExpress(result:QuickCheckoutResult){
  this.quickDraft.set(null);this.expressSale.set(result);
  this.createdId.set(result.ordenId);this.createdTickets.set([]);
  this.success.set('Venta '+result.numero+' cobrada y cerrada por '+money(result.total,this.currency())+'.');
  this.cart.set([]);this.observations.set('');this.operationId='';
  this.cartOpen.set(false);
 }
 protected newSale(){
  this.success.set('');this.createdId.set('');this.expressSale.set(null);
  this.query.set('');this.category.set('');
  this.searchInput()?.nativeElement.focus();
 }
}
