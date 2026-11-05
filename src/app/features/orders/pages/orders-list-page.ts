import {Component,computed,effect,inject,signal,untracked} from '@angular/core';
import {DatePipe} from '@angular/common';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcOrdersNav} from '../orders-nav';
import {GcOrderStatus} from '../components/orders-ui';
import {OrdersApi} from '../data-access/orders.api';
import {OrdersAccess} from '../data-access/orders-access';
import {PaymentsAccess} from '../../payments/data-access/payments-access';
import {ORDER_MODES,ORDER_STATES,type OrderMode,type OrderState,type OrderSummary,type WorkOrder} from '../data-access/orders.models';
import {money,modeText} from '../data-access/orders.helpers';
@Component({
 selector:'gc-orders-list-page',
 imports:[RouterLink,DatePipe,GcOrdersNav,GcSearchSelect,GcErrorState,GcOrderStatus],
 template:`
 <main class="ord-page ord-orders-list-page"><gc-orders-nav/>
  <section class="ord-card ord-orders-list-board">
   <div class="ord-heading"><h1>{{view()==='operational'?'Órdenes en curso':'Historial de órdenes'}}</h1>
    <div class="ord-actions">
     <button type="button" (click)="load()" [disabled]="busy()">Actualizar</button>
     @if(access.canCreate()){<a class="ord-primary" routerLink="/orders/pos">Nueva orden</a>}
    </div>
   </div>
   <div class="ord-view-switch ord-worklist-switch" role="group" aria-label="Vista de órdenes">
    <button type="button" [class.active]="view()==='operational'"
     [attr.aria-pressed]="view()==='operational'" (click)="switchView('operational')">En curso</button>
    <button type="button" [class.active]="view()==='history'"
     [attr.aria-pressed]="view()==='history'" (click)="switchView('history')">Historial</button>
   </div>
   <div class="ord-filter-grid ord-order-filters">
    <div class="ord-search-action">
     <label for="order-search">Buscar por número
      <input id="order-search" type="search" [value]="search()" (input)="search.set($any($event.target).value)"
       (keyup.enter)="apply()" placeholder="Ej. ORD-…" maxlength="100" [disabled]="busy()"/>
     </label>
     <button type="button" class="ord-primary" (click)="apply()" [disabled]="busy()">Buscar</button>
    </div>
    <gc-search-select id="order-list-branch" label="Sucursal" [items]="branches()"
     [value]="branchId()" [clearable]="false" (valueChange)="chooseBranch($event)"/>
    @if(view()==='history'){
     <gc-search-select id="order-list-status" label="Estado" [items]="states"
      [value]="state()" placeholder="Todos" [searchable]="false"
      (valueChange)="setState($event)"/>
    }
    <gc-search-select id="order-list-mode" label="Tipo de pedido" [items]="modes"
     [value]="mode()" placeholder="Todos" [searchable]="false"
     (valueChange)="setMode($event)"/>
    <gc-search-select id="order-list-limit" label="Filas por página" [items]="pageSizes"
     [value]="limitText()" [clearable]="false" [searchable]="false"
     (valueChange)="changeLimit($event)"/>
   </div>
   @if(hasFilters()){
    <div class="ord-order-filter-actions">
     <button type="button" (click)="clearFilters()" [disabled]="busy()">Limpiar filtros</button>
    </div>
   }
   @if(busy()){<p role="status">Consultando pedidos…</p>}
   @if(error()){<gc-error-state [message]="error()!" (retry)="load()"/>}
   @if(!busy()&&!error()&&view()==='operational'){
    <div class="ord-worklist-grid" aria-label="Órdenes abiertas">
     @for(item of workOrders();track item.id){
      <article class="ord-worklist-tile">
       <div class="ord-heading">
        <strong [title]="item.numero">{{item.numero}}</strong>
        <span class="ord-ticket-badge">Abierta</span>
       </div>
       <p class="ord-note">{{item.mesa?'Mesa '+item.mesa.numero+' · '+item.mesa.sala.nombre:modeText(item.modalidad)}}</p>
       <div class="ord-worklist-money">
        <div><span>Total</span><strong>{{money(item.total)}}</strong></div>
        <div><span>Pendiente</span><strong>{{money(item.saldo)}}</strong></div>
       </div>
       @if(item.kitchen.pending||item.kitchen.preparing||item.kitchen.toDeliver||item.needsProcessing){
        <p class="ord-note">
         @if(item.kitchen.pending){ {{item.kitchen.pending}} pendientes · }
         @if(item.kitchen.preparing){ {{item.kitchen.preparing}} preparando · }
         @if(item.kitchen.toDeliver){ {{item.kitchen.toDeliver}} para entregar · }
         @if(item.needsProcessing){Productos por enviar}
        </p>
       }
       <div class="ord-actions">
        @if(item.mesa){
         <a class="ord-primary" [routerLink]="['/orders/pos']"
          [queryParams]="{mesaId:item.mesa.id}">Agregar productos</a>
        }
        <a [routerLink]="['/orders/list',item.id]">Ver pedido</a>
        @if(paymentsAccess.canRead()&&paymentsAccess.canCollect()){
         <a [routerLink]="['/payments/order',item.id]">Cobrar</a>
        }
       </div>
      </article>
     }@empty{<p class="ord-empty">No hay órdenes abiertas con estos filtros.</p>}
    </div>
   }
   @if(!busy()&&!error()&&view()==='history'){
    <div class="ord-table-wrap ord-order-list-table"><table class="ord-table">
     <thead><tr><th>Número</th><th>Tipo</th><th>Fecha</th><th>Importe</th><th>Estado</th><th>Acción</th></tr></thead>
     <tbody>
     @for(item of items();track item.id){
      <tr class="ord-order-data-row">
       <td data-label="Número"><strong class="ord-order-number" [title]="item.numero">{{item.numero}}</strong></td>
       <td data-label="Tipo">{{modeText(item.modalidad)}}</td>
       <td data-label="Fecha">{{item.abiertaEn|date:'dd/MM/yyyy HH:mm'}}</td>
       <td data-label="Importe" class="ord-order-total">{{money(item.total)}}</td>
       <td data-label="Estado"><gc-order-status [state]="item.estado"/></td>
       <td data-label="Acciones"><div class="ord-actions">
        <a [routerLink]="['/orders/list',item.id]">Ver pedido</a>
        @if(item.estado==='ABIERTA'&&paymentsAccess.canRead()&&paymentsAccess.canCollect()){
         <a [routerLink]="['/payments/order',item.id]">Cobrar</a>
        }
       </div></td>
      </tr>
     } @empty {<tr><td colspan="6" class="ord-order-empty">
       {{hasFilters()?'No hay órdenes con estos filtros.':'No hay órdenes registradas en esta sucursal.'}}
      </td></tr>}
     </tbody>
    </table></div>
   }
   @if(!busy()&&!error()){
    <div class="ord-pagination">
     <span>{{total()}} órdenes · Página {{page()}} de {{pages()||1}}</span>
     <div class="ord-actions">
      <button type="button" (click)="changePage(-1)" [disabled]="page()<=1||busy()">Anterior</button>
      <button type="button" (click)="changePage(1)" [disabled]="page()>=pages()||busy()">Siguiente</button>
     </div>
    </div>
   }
  </section>
 </main>`
})
export class GcOrdersListPage{
 protected readonly access=inject(OrdersAccess);
 protected readonly paymentsAccess=inject(PaymentsAccess);
 private readonly api=inject(OrdersApi);
 private readonly context=inject(GcBranchContext);
 protected readonly branches=computed(()=>this.context.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly modes=ORDER_MODES;protected readonly states=ORDER_STATES;
 protected readonly branchId=signal('');protected readonly search=signal('');
 protected readonly mode=signal<OrderMode|''>('');protected readonly state=signal<OrderState|''>('');
 protected readonly page=signal(1);protected readonly pages=signal(0);protected readonly total=signal(0);
 protected readonly limit=signal(20);
 protected readonly limitText=computed(()=>String(this.limit()));
 protected readonly pageSizes=[{id:'10',label:'10'},{id:'20',label:'20'},{id:'50',label:'50'}];
 private readonly appliedSearch=signal('');
 protected readonly hasFilters=computed(()=>Boolean(this.search().trim()||this.appliedSearch()||this.mode()||this.state()));
 protected readonly items=signal<OrderSummary[]>([]);
 protected readonly workOrders=signal<WorkOrder[]>([]);
 protected readonly view=signal<'operational'|'history'>('operational');
 protected readonly busy=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly money=money;protected readonly modeText=modeText;
 private generation=0;
 constructor(){effect(()=>{
  const branch=this.context.branchId();
  untracked(()=>{
   if(branch&&branch!==this.branchId()){
    this.branchId.set(branch);this.page.set(1);
    this.items.set([]);this.workOrders.set([]);this.total.set(0);this.pages.set(0);
    void this.load();
   }
  });
 })}
 protected switchView(v:'operational'|'history'){
  if(this.view()===v)return;
  this.view.set(v);this.page.set(1);void this.load();
 }
 protected chooseBranch(id:string){if(!id)return;this.branchId.set(id);this.page.set(1);void this.load()}
 protected apply(){this.appliedSearch.set(this.search().trim());this.page.set(1);void this.load()}
 protected clearFilters(){
  this.search.set('');this.appliedSearch.set('');this.mode.set('');this.state.set('');
  this.page.set(1);void this.load();
 }
 protected setState(v:string){
  this.state.set(ORDER_STATES.find(x=>x.id===v)?.id??'');
  this.page.set(1);void this.load();
 }
 protected setMode(v:string){
  this.mode.set(ORDER_MODES.find(x=>x.id===v)?.id??'');
  this.page.set(1);void this.load();
 }
 protected changeLimit(value:string){
  const next=Number(value);if(![10,20,50].includes(next)||next===this.limit())return;
  this.limit.set(next);this.page.set(1);void this.load();
 }
 protected changePage(delta:number){
  const next=this.page()+delta;if(next<1||next>this.pages()||this.busy())return;
  this.page.set(next);void this.load();
 }
 protected async load(){
  const branch=this.branchId();
  if(!branch||!this.access.canRead())return;
  const gen=++this.generation;this.busy.set(true);this.error.set(null);
  try{
   const q={sucursalId:branch,search:this.appliedSearch(),
    ...(this.mode()?{modalidad:this.mode() as OrderMode}:{}),
    page:this.page(),limit:this.limit()};
   if(this.view()==='operational'){
    const data=await firstValueFrom(this.api.worklist({...q,estado:'ABIERTA'}));
    if(gen!==this.generation||branch!==this.branchId())return;
    this.workOrders.set(data.data);this.items.set([]);
    this.total.set(data.meta.total);this.pages.set(data.meta.totalPages);
   }else{
    const data=await firstValueFrom(this.api.list({...q,
     ...(this.state()?{estado:this.state() as OrderState}:{})}));
    if(gen!==this.generation||branch!==this.branchId())return;
    this.items.set(data.data);this.workOrders.set([]);
    this.total.set(data.meta.total);this.pages.set(data.meta.totalPages);
   }
  }catch(e){if(gen===this.generation)this.error.set(gcErrorMessage(e))}
  finally{if(gen===this.generation)this.busy.set(false)}
 }
}
