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
import {ORDER_MODES,ORDER_STATES,type OrderMode,type OrderState,type OrderSummary,type OrderWorkItem} from '../data-access/orders.models';
import {money,modeText} from '../data-access/orders.helpers';
@Component({
 selector:'gc-orders-list-page',
 imports:[RouterLink,DatePipe,GcOrdersNav,GcSearchSelect,GcErrorState,GcOrderStatus],
 template:`
 <main class="ord-page ord-orders-list-page"><gc-orders-nav/>
  <section class="ord-card ord-orders-list-board">
   <div class="ord-heading"><h1>Órdenes</h1>
    <div class="ord-actions">
     <button type="button" (click)="load()" [disabled]="busy()">Actualizar</button>
     @if(access.canCreate()){<a class="ord-primary" routerLink="/orders/pos">Nueva orden</a>}
    </div>
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
    <gc-search-select id="order-list-status" label="Estado" [items]="states"
     [value]="state()" placeholder="Todos" [searchable]="false"
     (valueChange)="setState($event)"/>
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
   @if(!busy()&&!error()){
    <div class="ord-table-wrap ord-order-list-table"><table class="ord-table">
     <thead><tr><th>Número</th><th>Tipo</th><th>Fecha</th><th>Importe</th><th>Saldo</th><th>Estado</th><th>Acción</th></tr></thead>
     <tbody>
     @for(item of items();track item.id){
      <tr class="ord-order-data-row">
       <td data-label="Número"><strong class="ord-order-number" [title]="item.numero">{{item.numero}}</strong></td>
       <td data-label="Tipo">{{modeText(item.modalidad)}}</td>
       <td data-label="Fecha">{{item.abiertaEn|date:'dd/MM/yyyy HH:mm'}}</td>
       <td data-label="Importe" class="ord-order-total">{{money(item.total)}}</td>
       <td data-label="Saldo" class="ord-order-total">
        @if('saldo' in item){<strong>{{money(item.saldo)}}</strong>}
        @else{<span class="ord-note">—</span>}
       </td>
       <td data-label="Estado"><gc-order-status [state]="item.estado"/></td>
       <td data-label="Acciones"><div class="ord-actions">
        @if('mesa' in item&&item.mesa&&item.estado==='ABIERTA'&&access.canCreate()){
         <a class="ord-primary" [routerLink]="['/orders/pos']"
          [queryParams]="{mesaId:item.mesa.id}">Añadir productos</a>
        }
        <a [routerLink]="['/orders/list',item.id]">Ver pedido</a>
        @if(item.estado==='ABIERTA'&&paymentsAccess.canRead()&&paymentsAccess.canCollect()){
         <a [routerLink]="['/payments/order',item.id]">Cobrar</a>
        }
       </div></td>
      </tr>
     } @empty {<tr><td colspan="7" class="ord-order-empty">
       {{hasFilters()?'No hay órdenes con estos filtros.':'No hay órdenes registradas en esta sucursal.'}}
      </td></tr>}
     </tbody>
    </table></div>
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
 protected readonly mode=signal<OrderMode|''>('');protected readonly state=signal<OrderState|''>('ABIERTA');
 protected readonly page=signal(1);protected readonly pages=signal(0);protected readonly total=signal(0);
 protected readonly limit=signal(20);
 protected readonly limitText=computed(()=>String(this.limit()));
 protected readonly pageSizes=[{id:'10',label:'10'},{id:'20',label:'20'},{id:'50',label:'50'}];
 private readonly appliedSearch=signal('');
 protected readonly hasFilters=computed(()=>Boolean(this.search().trim()||this.appliedSearch()||this.mode()||this.state()));
 protected readonly items=signal<(OrderSummary|OrderWorkItem)[]>([]);protected readonly busy=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly money=money;protected readonly modeText=modeText;
 private generation=0;
 constructor(){effect(()=>{
  const branch=this.context.branchId();
  untracked(()=>{
   if(branch&&branch!==this.branchId()){
    this.branchId.set(branch);this.page.set(1);
    this.items.set([]);this.total.set(0);this.pages.set(0);
    void this.load();
   }
  });
 })}
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
   const query={sucursalId:branch,search:this.appliedSearch(),
    ...(this.mode()?{modalidad:this.mode() as OrderMode}:{}),
    ...(this.state()?{estado:this.state() as OrderState}:{}),page:this.page(),limit:this.limit()};
   const data=this.state()==='ABIERTA'
    ?await firstValueFrom(this.api.worklist(query))
    :await firstValueFrom(this.api.list(query));
   if(gen!==this.generation||branch!==this.branchId())return;
   this.items.set(data.data);this.total.set(data.meta.total);this.pages.set(data.meta.totalPages);
  }catch(e){if(gen===this.generation)this.error.set(gcErrorMessage(e))}
  finally{if(gen===this.generation)this.busy.set(false)}
 }
}
