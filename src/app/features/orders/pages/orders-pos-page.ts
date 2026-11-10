import {Component,computed,effect,ElementRef,HostListener,inject,signal,viewChild} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {CdkTrapFocus} from '@angular/cdk/a11y';
import {Subject,debounceTime,distinctUntilChanged,firstValueFrom} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {GcSearchSelect,type GcSelectOption} from '../../../design-system/forms/gc-search-select';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {CatalogApi} from '../../catalog/data-access/catalog.api';
import type {CatalogBranchMenu,CatalogProjectedGroup,CatalogProjectedItem} from '../../catalog/data-access/catalog.models';
import {BranchesApi} from '../../organization/data-access/organization-api';
import type {BranchConfig} from '../../organization/data-access/organization.models';
import {sumDecimals,parseApiDecimal} from '../../../shared/formatting';
import {UsersApi} from '../../users/data-access/users.api';
import {DeliveryApi} from '../../delivery/data-access/delivery.api';
import {GcOrdersNav} from '../orders-nav';
import {GcPosProduct,GcPosCart} from '../components/orders-ui';
import {GcPosExpressCheckout} from '../components/pos-express-checkout';
import {addOrMergeCartEntry,asOrderLine,type PosCartEntry} from '../components/pos-cart.models';
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
 <div class="ord-heading ord-pos-heading">
  <div class="ord-pos-heading-copy"><h1>Punto de venta</h1>
   <span class="ord-note">{{prefs.view()==='tables'?'Mesas':'Mostrador'}} · {{cart().length}} líneas</span></div>
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
    @if(access.canViewDetail()){
     <a [routerLink]="['/orders/print',createdId()]">Imprimir pedido completo</a>
    }
    @if(expressSale();as sale){
     <a [routerLink]="['/payments/sales',sale.ventaId,'receipt']">Imprimir comprobante 80 mm</a>
     <button type="button" (click)="newSale()">Nueva venta</button>
    }
    @if(!expressSale()&&paymentsAccess.canRead()&&paymentsAccess.canCollect()){
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
  <section class="ord-card ord-pos-tables ord-pos-table-picker" aria-label="Elegir mesa">
   <div class="ord-pos-table-picker-head">
    <div class="ord-pos-table-picker-title">
     <h2>Mesas</h2>
     <small>{{availableTableCount()}} disponibles · {{occupiedTableCount()}} ocupadas</small>
    </div>
    <div class="ord-pos-table-picker-tools">
     <label class="ord-pos-table-picker-search">
      <span class="ord-pos-sr-only">Buscar mesa o sala</span>
      <input type="search" aria-label="Buscar mesa o sala" [value]="tableSearch()"
       (input)="tableSearch.set($any($event.target).value)" placeholder="Buscar mesa o sala"/>
     </label>
     <button type="button" (click)="loadTables()" [disabled]="tableBusy()">Actualizar</button>
     <a routerLink="/orders/tables">Ver mesas</a>
    </div>
   </div>
   @if(!access.canTablesRead()){<p class="ord-note">No tienes acceso al listado de mesas.</p>}
   @else{
    @if(tableBusy()){<p role="status" class="ord-note">Actualizando mesas…</p>}
    <div class="ord-pos-table-picker-strip" role="group" aria-label="Seleccionar mesa">
     @for(table of filteredTables();track table.id){
      <button class="ord-pos-table-pill" type="button"
       [disabled]="!table.activa||tableBusy()"
       (click)="chooseTable(table)"
       [attr.aria-label]="'Mesa '+table.numero+', '+(table.ocupacion?'ocupada, continuar pedido':'disponible')">
       <strong>Mesa {{table.numero}}</strong>
       <small>{{table.sala.nombre}} · {{table.capacidad}} pers.</small>
       <span [class.ord-occupied]="!!table.ocupacion">
        {{!table.activa?'Inactiva':table.ocupacion?'Ocupada · continuar':'Disponible'}}
       </span>
      </button>
     } @empty {<p class="ord-note">No hay mesas con estos filtros.</p>}
    </div>
   }
  </section>
 }
 @if(prefs.view()==='counter'&&existingOrder();as current){
  <div class="ord-pos-table-context">
   <div><strong>Ampliando {{current.numero}}</strong>
    <span>Pedido abierto · Total anterior {{money(current.total,currency())}}</span></div>
   <div class="ord-actions">
    <a class="ord-pos-context-button" [routerLink]="['/orders/list',current.id]">Ver detalles</a>
    @if(paymentsAccess.canRead()){
     <a class="ord-pos-context-button ord-pos-context-button--pay" [routerLink]="['/payments/order',current.id]">Cobrar</a>
    }
    @if(access.canViewDetail()){
     <a class="ord-pos-context-button" [routerLink]="['/orders/print',current.id]">Pedido completo</a>
    }
    @if(access.canKitchenRead()){
     @if(recentComanda();as ticket){
      <a class="ord-pos-print-link" [routerLink]="['/orders/kitchen/tickets',ticket.id,'print']">
       Imprimir comanda</a>
     }
    }
   </div>
  </div>
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
     <a class="ord-pos-context-button" [routerLink]="['/orders/list',current.id]">Ver detalles</a>
     @if(paymentsAccess.canRead()){
      <a class="ord-pos-context-button ord-pos-context-button--pay" [routerLink]="['/payments/order',current.id]">Cobrar mesa</a>
     }
     @if(access.canViewDetail()){
      <a class="ord-pos-context-button" [routerLink]="['/orders/print',current.id]">Pedido completo</a>
     }
     @if(access.canKitchenRead()){
      @if(recentComanda();as ticket){
       <a class="ord-pos-print-link" [routerLink]="['/orders/kitchen/tickets',ticket.id,'print']">
        Imprimir comanda</a>
      }
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
    <label class="ord-pos-search-label"><span class="ord-pos-sr-only">Buscar producto</span>
     <input #productSearch type="search" aria-label="Buscar producto" [value]="query()" (input)="query.set($any($event.target).value)"
      placeholder="Nombre o presentación" autocomplete="off"/>
     <span class="ord-pos-search-hint" aria-hidden="true">Atajo <kbd>/</kbd> para buscar</span>
    </label>
    <div class="ord-actions ord-pos-view-controls" role="group" aria-label="Visualización del catálogo">
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
   <div class="ord-checkout-scroll">
    @if(existingOrder();as current){
     <section class="ord-express-existing" aria-label="Productos ya registrados">
      <div class="ord-express-existing-head">
       <strong>Orden {{current.numero}}</strong>
       <small>{{current.ordenLineasComoOrden.length}} líneas registradas · {{money(current.total,currency())}}</small>
      </div>
      <details><summary>Ver productos anteriores</summary>
       @for(line of current.ordenLineasComoOrden;track line.id){
        @if(!line.canceladaEn){
         <div class="ord-express-existing-line">
          <span>{{line.cantidad}} × {{line.nombreSnapshot}}</span>
          <small>{{money(line.subtotal,currency())}}</small>
         </div>
        }
       }
      </details>
     </section>
    }
    <gc-pos-cart [items]="cart()" [disabled]="submitting()"
     (quantity)="changeQty($event)" (remove)="remove($event)"/>
    <div class="ord-checkout-options">
    @if(cart().length){<div class="ord-actions ord-pos-cart-tools">
     <span class="ord-note">El importe definitivo lo calcula el servidor.</span>
     <button type="button" class="ord-danger" [disabled]="submitting()" (click)="clearCart()">Vaciar carrito</button>
    </div>}
    @if(selectedTable();as table){
     <div class="ord-pos-selection-summary">
      <strong>Mesa {{table.numero}}</strong><small>{{table.sala.nombre}} · {{existingOrder()?'Añadiendo a la orden':'Pedido nuevo'}}</small>
     </div>
    }@else if(existingOrder();as current){
     <div class="ord-pos-selection-summary">
      <strong>Ampliando {{current.numero}}</strong><small>Modalidad {{mode()}} · sin nueva orden</small>
     </div>
    }@else{
     <gc-search-select id="pos-modality" label="Tipo de pedido" [items]="modes()"
      [value]="mode()" [clearable]="false" [searchable]="false" [disabled]="submitting()"
      (valueChange)="chooseMode($event)"/>
     @if(mode()==='MESA'){
      <gc-search-select id="pos-table" label="Mesa" [items]="tableChoices()"
       [value]="selectedTable()?.id??''" [disabled]="!access.canTablesRead()||submitting()"
       placeholder="Seleccionar mesa" (valueChange)="selectTableId($event)"/>
     }
     @if(mode()==='DELIVERY'){
      <div class="ord-pos-delivery">
       <label>Dirección de entrega
        <input type="text" maxlength="500" [value]="direccionTexto()" [disabled]="submitting()"
         placeholder="Calle, número, zona, ciudad…"
         (input)="direccionTexto.set($any($event.target).value);invalidateKey()"/>
       </label>
       <label>Referencia (opcional)
        <input type="text" maxlength="500" [value]="referenciaDireccion()" [disabled]="submitting()"
         placeholder="Casa de dos niveles, portón negro…"
         (input)="referenciaDireccion.set($any($event.target).value);invalidateKey()"/>
       </label>
       <label>Teléfono de contacto (opcional)
        <input type="tel" maxlength="45" [value]="telefonoContacto()" [disabled]="submitting()"
         (input)="telefonoContacto.set($any($event.target).value);invalidateKey()"/>
       </label>
       <gc-search-select id="pos-courier" label="Repartidor (opcional)" [items]="courierChoices()"
        [value]="repartidorId()" [remote]="true" [loading]="courierBusy()" [disabled]="submitting()"
        placeholder="Buscar repartidor por nombre…"
        (valueChange)="selectCourier($event)" (searchChange)="searchCouriers($event)" (opened)="searchCouriers('')"/>
       <p class="ord-note">
        La entrega se crea junto con el pedido.
        @if(!repartidorId()){Si no asignas repartidor ahora, podrás hacerlo después desde Entregas.}
       </p>
      </div>
     }
    }
    <details class="ord-pos-more">
     <summary>Observaciones {{observations().trim()?'(añadidas)':'(opcional)'}}</summary>
     <label>Notas del pedido
      <textarea rows="2" maxlength="500" [value]="observations()" [disabled]="submitting()"
       placeholder="Instrucciones adicionales" (input)="observations.set($any($event.target).value);invalidateKey()"></textarea>
     </label>
    </details>
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
    </div>
   </div>
   <div class="ord-checkout-actions">
     <div class="ord-checkout-total">
      <span>{{existingOrder()?'Por agregar (estimado)':'Importe estimado'}}</span>
      <strong>{{money(total(),currency())}}</strong>
     </div>
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
     @if(quickEligible()){
     <button class="ord-primary ord-confirm" type="button"
      [disabled]="submitting()||!cart().length"
      (click)="beginExpress()">Cobrar ahora · {{money(total(),currency())}}</button>
     <button class="ord-secondary-action" type="button" [disabled]="submitting()"
      (click)="submit()">Guardar sin cobrar</button>
    }@else{
     <button class="ord-primary ord-confirm" type="button"
      [disabled]="submitting()||tableBusy()||!access.canCreate()||cart().length===0||
       (mode()==='MESA'&&(!selectedTable()||!tableOrderReady()))||
       (mode()==='DELIVERY'&&!existingOrder()&&direccionTexto().trim().length<5)"
      (click)="submit()">{{submitting()?'Guardando…':existingOrder()?'Agregar productos al pedido':'Confirmar pedido · '+money(total(),currency())}}</button>
    }
   </div>
  </aside>
 </div>
 @if(cart().length){<button class="ord-mobile-cart" type="button" (click)="cartOpen.set(true)">
  Ver pedido · {{cart().length}} productos · {{money(total(),currency())}}
 </button>}
 @if(quickDraft();as draft){
  <gc-pos-express-checkout [order]="draft" (dismissed)="quickDraft.set(null)"
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
 private readonly usersApi=inject(UsersApi);
 private readonly deliveryApi=inject(DeliveryApi);
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
 protected readonly recentComanda=computed(()=>
  (this.existingOrder()?.comandasComoOrden??[])
   .filter(ticket=>ticket.estado!=='CANCELADA')
   .sort((a,b)=>b.enviadaEn.localeCompare(a.enviadaEn))[0]??null);
 protected readonly activeTableOrderId=computed(()=>
  this.selectedTable()?.ocupacion?.ordenesComoOcupacionMesa?.find(x=>x.estado==='ABIERTA')?.id??'');
 protected readonly tableOrderReady=computed(()=>
  !this.tableBusy()&&(!this.activeTableOrderId()||
   this.existingOrder()?.id===this.activeTableOrderId()));

 protected readonly observations=signal('');
 protected readonly mode=signal<OrderMode>('MOSTRADOR');
 protected readonly selectedTable=signal<TableRecord|null>(null);
 protected readonly direccionTexto=signal('');
 protected readonly referenciaDireccion=signal('');
 protected readonly telefonoContacto=signal('');
 protected readonly repartidorId=signal('');
 protected readonly courierChoices=signal<GcSelectOption[]>([]);
 protected readonly courierBusy=signal(false);
 private readonly courierSearch=new Subject<string>();
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
 protected readonly quickEligible=computed(()=>this.directOnly()&&!this.existingOrder()&&
  !this.tableBusy()&&(this.mode()==='MOSTRADOR'||this.mode()==='PARA_LLEVAR')&&
  this.access.canCreate()&&this.paymentsAccess.canCollect());
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
 private pendingOrderFromUrl=this.activatedRoute.snapshot.queryParamMap.get('ordenId')??'';
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
 constructor(){
  this.courierSearch.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed()).subscribe(term=>{
   void this.loadCouriers(term);
  });
  effect(()=>{
  const branch=this.context.branchId();
  this.prefs.load();
  if(branch){
   this.selectedTable.set(null);this.existingOrder.set(null);this.quickDraft.set(null);
   this.expressSale.set(null);this.mode.set('MOSTRADOR');this.cart.set([]);
   this.direccionTexto.set('');this.referenciaDireccion.set('');this.telefonoContacto.set('');
   this.repartidorId.set('');this.courierChoices.set([]);
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

  if(event.key==='F4'&&!this.configuring()&&!this.quickDraft()&&
   !['INPUT','TEXTAREA','SELECT'].includes(t?.tagName??'')){
   event.preventDefault();this.beginExpress();
  }
 }
 protected async setView(mode:'counter'|'tables'){
  if(this.submitting()||this.prefs.view()===mode)return;
  if(this.cart().length&&(this.selectedTable()||this.existingOrder())){
   const okay=await this.confirm.confirm({title:'Cambiar tipo de atención',
    message:'Hay productos nuevos sin guardar. ¿Descartarlos y cambiar de atención?',
    confirmText:'Descartar y cambiar',danger:true});
   if(!okay)return;
   this.cart.set([]);this.invalidateKey();
  }
  this.prefs.setView(mode);
  this.selectedTable.set(null);this.existingOrder.set(null);
  this.mode.set(mode==='counter'?'MOSTRADOR':'MESA');
  this.showTablePicker.set(mode==='tables');
  if(mode==='tables')void this.loadTables();
 }
 protected chooseMode(value:string){
  if(this.submitting()||this.existingOrder())return;
  const v=ORDER_MODES.find(x=>x.id===value)?.id??'MOSTRADOR';
  this.mode.set(v);if(v!=='MESA'){this.selectedTable.set(null);this.existingOrder.set(null)}
  if(v!=='DELIVERY'){
   this.direccionTexto.set('');this.referenciaDireccion.set('');this.telefonoContacto.set('');
   this.repartidorId.set('');this.courierChoices.set([]);
  }
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
  if(this.pendingOrderFromUrl){
   const orderId=this.pendingOrderFromUrl;this.pendingOrderFromUrl='';
   void this.openExistingFromUrl(orderId);
  }
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
 protected async chooseTable(t:TableRecord){
  if(this.submitting())return;
  if(this.selectedTable()?.id===t.id){
   this.showTablePicker.set(false);
   const current=this.activeTableOrderId();
   if(current&&!this.existingOrder()&&!this.tableBusy())void this.loadExistingOrder(current,t.id);
   return;
  }
  if(this.selectedTable()&&this.cart().length){
   const okay=await this.confirm.confirm({title:'Cambiar de mesa',
    message:'Los productos del carrito aún no están guardados. ¿Descartarlos para atender otra mesa?',
    confirmText:'Descartar y cambiar',danger:true});
   if(!okay)return;
   this.cart.set([]);this.invalidateKey();
  }
  const existing=t.ocupacion?.ordenesComoOcupacionMesa?.find(x=>x.estado==='ABIERTA');
  this.selectedTable.set(t);this.existingOrder.set(null);
  this.mode.set('MESA');this.invalidateKey();this.showTablePicker.set(false);
  if(existing)void this.loadExistingOrder(existing.id,t.id);
 }
 protected selectTableId(id:string){
  if(this.submitting()||this.tableBusy())return;
  const t=this.tables().find(x=>x.id===id)||null;
  if(t){void this.chooseTable(t);return}
  void this.clearSelectedTable();
 }
 protected async clearSelectedTable(){
  if(this.submitting()||this.tableBusy())return;
  if(this.selectedTable()&&this.cart().length){
   const okay=await this.confirm.confirm({title:'Quitar mesa del pedido',
    message:'Hay productos nuevos sin guardar para esta mesa. ¿Descartarlos y quitar la mesa?',
    confirmText:'Descartar y quitar',danger:true});
   if(!okay)return;
   this.cart.set([]);this.invalidateKey();
  }
  this.selectedTable.set(null);this.existingOrder.set(null);
  this.mode.set(this.prefs.view()==='tables'?'MESA':'MOSTRADOR');
  this.showTablePicker.set(this.prefs.view()==='tables');
  this.invalidateKey();
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
  const entry:PosCartEntry={key:operationKey('item'),variantId:item.variante.id,
   name:item.variante.producto?.nombre??item.variante.nombre,variant:item.variante.nombre,
   price:sumDecimals([item.precio,...extraPrices]),currency:item.moneda,quantity:qty,
   modifierIds:mods,extras,notes:notes.trim().slice(0,300),discount};
  const updated=addOrMergeCartEntry(this.cart(),entry);
  if(updated.status==='too-many-lines'){
   this.submitError.set('El pedido admite hasta 100 líneas diferentes.');return;
  }
  if(updated.status==='too-many-units'){
   this.submitError.set('Una línea admite como máximo 999 unidades.');return;
  }
  this.cart.set(updated.entries);
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
 protected searchCouriers(term:string){this.courierSearch.next(term)}
 private async loadCouriers(term:string){
  const branch=this.context.branchId();if(!branch)return;
  this.courierBusy.set(true);
  try{
   const result=await firstValueFrom(this.usersApi.options(
    {sucursalId:branch,purpose:'delivery.courier',search:term||undefined,limit:20}));
   this.courierChoices.set(result.data.map(u=>({id:u.id,label:u.label})));
  }catch{/* non-critical: the picker just stays empty, courier assignment is optional */}
  finally{this.courierBusy.set(false)}
 }
 protected selectCourier(id:string){
  if(this.submitting())return;
  this.repartidorId.set(id);this.invalidateKey();
 }
 protected async clearCart(){
  if(this.submitting()||!this.cart().length)return;
  if(!await this.confirm.confirm({title:'Vaciar pedido actual',
   message:'Se quitarán todos los productos sin crear ni cancelar ninguna orden en el servidor.',
   confirmText:'Vaciar carrito',danger:true}))return;
  this.cart.set([]);this.submitError.set('');this.invalidateKey();this.cartOpen.set(false);
 }
 protected async submit(){
  const branch=this.context.branchId();if(!branch||this.submitting()||!this.cart().length)return;
  if(this.mode()==='MESA'&&(!this.selectedTable()||!this.tableOrderReady())){
   this.submitError.set('Espera a cargar el pedido de la mesa antes de agregar productos.');return;
  }
  if(this.mode()==='DELIVERY'&&!this.existingOrder()&&this.direccionTexto().trim().length<5){
   this.submitError.set('Indica la dirección de entrega (mínimo 5 caracteres).');return;
  }
  if(!this.operationId)this.operationId=operationKey('pos');
  // Direct products MUST be sent through the server processing step:
  // INVENTARIABLE -> inventory consumption, SERVICIO -> sent flag, neither creates KDS tickets.
  const shouldProcess=this.directOnly()?true:this.sendKitchen();
  const dto={
   sucursalId:branch,modalidad:this.mode(),origen:this.mode()==='MESA'?'MESERO' as const:'CAJA' as const,
   ...(this.mode()==='MESA'&&this.selectedTable()?{mesaId:this.selectedTable()!.id}:{}),
   ...(this.observations().trim()?{observaciones:this.observations().trim()}:{}),
   ...(this.mode()==='DELIVERY'&&!this.existingOrder()?{
    direccionTexto:this.direccionTexto().trim(),
    ...(this.referenciaDireccion().trim()?{referenciaDireccion:this.referenciaDireccion().trim()}:{}),
    ...(this.telefonoContacto().trim()?{telefonoContacto:this.telefonoContacto().trim()}:{}),
    ...(this.repartidorId()?{repartidorId:this.repartidorId()}:{}),
   }:{}),
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
   const previously=new Set((existing?.comandasComoOrden??[]).map(t=>t.id));
   const newTickets=(data.comandasComoOrden??[]).filter(t=>!previously.has(t.id));
   this.createdTickets.set(newTickets.map(x=>({id:x.id,numero:x.numero})));
   const kitchenCreated=newTickets.length>0;
   const hasUnprocessed=(data.ordenLineasComoOrden??[]).some(line=>
    parseApiDecimal(line.cantidadEnviada).lt(parseApiDecimal(line.cantidad)));
   const status=kitchenCreated?' · Enviada a Cocina':
    hasUnprocessed?' · Pendiente de procesar antes de cerrar':
    ' · Procesada sin comanda de Cocina';
   const message=existing
    ?dto.lineas.length+(dto.lineas.length===1?' producto agregado a ':' productos agregados a ')+data.numero+status+'.'
    :'Orden '+data.numero+' creada'+status+'.';
   this.success.set(message);
   this.notices.show(message,'success',7000);
   this.cart.set([]);this.observations.set('');
   this.operationId='';this.cartOpen.set(false);
   if(existing){
    this.existingOrder.set(data);
   }else{
    const wasDeliveryWithoutCourier=this.mode()==='DELIVERY'&&!this.repartidorId();
    this.selectedTable.set(null);this.existingOrder.set(null);
    this.mode.set('MOSTRADOR');
    this.direccionTexto.set('');this.referenciaDireccion.set('');this.telefonoContacto.set('');
    this.repartidorId.set('');this.courierChoices.set([]);
    this.showTablePicker.set(this.prefs.view()==='tables');
    if(wasDeliveryWithoutCourier)void this.notifyMissingCourier(branch,data.id,data.numero);
   }
   if(this.prefs.view()==='tables')void this.loadTables();
  }catch(e){this.submitError.set(orderFriendlyError(e))}
  finally{this.submitting.set(false)}
 }
 /** Delivery orders can be sent without a courier (assigning one is optional in the POS
  * form). When that happens, surface a toast that stays up until dismissed, with a link
  * straight to where the courier gets assigned later — rather than letting the order
  * silently sit unassigned until someone happens to check Entregas. */
 private async notifyMissingCourier(sucursalId:string,ordenId:string,numero:string){
  try{
   const page=await firstValueFrom(this.deliveryApi.list({sucursalId,ordenId,limit:1}));
   const entregaId=page.data[0]?.id;
   if(entregaId){
    this.notices.show('El pedido '+numero+' es delivery y no tiene repartidor asignado.',
     'warning',0,{label:'Asignar repartidor',path:['/delivery',entregaId]});
    return;
   }
  }catch{/* fall through to the link-less notice below */}
  this.notices.show('El pedido '+numero+' es delivery y no tiene repartidor asignado. Asígnalo desde Entregas.',
   'warning',0);
 }
 protected async openExistingFromUrl(id:string){
  const branch=this.context.branchId();if(!branch)return;
  this.tableBusy.set(true);this.submitError.set('');
  try{
   const order=await firstValueFrom(this.api.detail(id));
   if(this.context.branchId()!==branch)return;
   if(order.estado!=='ABIERTA'||order.sucursalId!==branch)
    throw new Error('El pedido ya no está abierto en esta sucursal.');
   if(order.modalidad==='MESA'){
    this.pendingTableFromUrl=order.ocupacionMesa?.mesa?.id??'';
    if(!this.pendingTableFromUrl)throw new Error('La mesa del pedido no está disponible.');
    this.prefs.setView('tables');this.tableBusy.set(false);void this.loadTables();
    return;
   }
   this.prefs.setView('counter');this.showTablePicker.set(false);
   this.selectedTable.set(null);this.mode.set(order.modalidad);
   this.existingOrder.set(order);
  }catch(e){if(this.context.branchId()===branch)this.submitError.set(orderFriendlyError(e))}
  finally{if(this.context.branchId()===branch)this.tableBusy.set(false)}
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
  if(!branch||this.submitting()||!this.quickEligible())return;
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
