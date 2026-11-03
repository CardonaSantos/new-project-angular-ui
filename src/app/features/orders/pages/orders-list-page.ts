import {Component,computed,effect,inject,signal} from '@angular/core';
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
import {ORDER_MODES,ORDER_STATES,type OrderMode,type OrderState,type OrderSummary} from '../data-access/orders.models';
import {money,modeText} from '../data-access/orders.helpers';
@Component({
 selector:'gc-orders-list-page',
 imports:[RouterLink,DatePipe,GcOrdersNav,GcSearchSelect,GcErrorState,GcOrderStatus],
 template:`
 <main class="ord-page"><gc-orders-nav/>
  <section class="ord-card">
   <div class="ord-heading"><div><h1>Órdenes</h1><p>Consulta y continúa los pedidos registrados.</p></div>
    @if(access.canCreate()){<a class="ord-primary" routerLink="/orders/pos">Nueva orden</a>}
   </div>
   <div class="ord-filter-grid">
    <label>Buscar por número
     <input [value]="search()" (input)="search.set($any($event.target).value)"
      (keyup.enter)="apply()" placeholder="Ej. ORD-…" maxlength="100"/>
    </label>
    <gc-search-select id="order-list-branch" label="Sucursal" [items]="branches()"
     [value]="branchId()" [clearable]="false" (valueChange)="chooseBranch($event)"/>
    <gc-search-select id="order-list-status" label="Estado" [items]="states"
     [value]="state()" placeholder="Todos" [searchable]="false"
     (valueChange)="setState($event)"/>
    <gc-search-select id="order-list-mode" label="Tipo de pedido" [items]="modes"
     [value]="mode()" placeholder="Todos" [searchable]="false"
     (valueChange)="setMode($event)"/>
   </div>
   <div class="ord-actions"><button type="button" (click)="apply()" [disabled]="busy()">Buscar</button></div>
   @if(busy()){<p role="status">Consultando pedidos…</p>}
   @if(error()){<gc-error-state [message]="error()!" (retry)="load()"/>}
   @if(!busy()&&!error()){
    <div class="ord-table-wrap"><table class="ord-table">
     <thead><tr><th>Número</th><th>Tipo</th><th>Fecha</th><th>Importe</th><th>Estado</th><th>Acción</th></tr></thead>
     <tbody>
     @for(item of items();track item.id){
      <tr><td><strong>{{item.numero}}</strong></td><td>{{modeText(item.modalidad)}}</td>
       <td>{{item.abiertaEn|date:'dd/MM/yyyy HH:mm'}}</td>
       <td>{{money(item.total)}}</td><td><gc-order-status [state]="item.estado"/></td>
       <td><a [routerLink]="['/orders/list',item.id]">Ver pedido</a></td></tr>
     } @empty {<tr><td colspan="6">No hay órdenes para los filtros seleccionados.</td></tr>}
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
 private readonly api=inject(OrdersApi);
 private readonly context=inject(GcBranchContext);
 protected readonly branches=computed(()=>this.context.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly modes=ORDER_MODES;protected readonly states=ORDER_STATES;
 protected readonly branchId=signal('');protected readonly search=signal('');
 protected readonly mode=signal<OrderMode|''>('');protected readonly state=signal<OrderState|''>('');
 protected readonly page=signal(1);protected readonly pages=signal(0);protected readonly total=signal(0);
 protected readonly items=signal<OrderSummary[]>([]);protected readonly busy=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly money=money;protected readonly modeText=modeText;
 private generation=0;
 constructor(){effect(()=>{
  const branch=this.context.branchId();
  if(branch&&branch!==this.branchId()){this.branchId.set(branch);this.page.set(1);void this.load()}
 })}
 protected chooseBranch(id:string){this.branchId.set(id);this.page.set(1);void this.load()}
 protected apply(){this.page.set(1);void this.load()}
 protected setState(v:string){
  this.state.set(ORDER_STATES.find(x=>x.id===v)?.id??'');this.apply();
 }
 protected setMode(v:string){
  this.mode.set(ORDER_MODES.find(x=>x.id===v)?.id??'');this.apply();
 }
 protected changePage(delta:number){this.page.update(x=>x+delta);void this.load()}
 protected async load(){
  if(!this.branchId()||!this.access.canRead())return;
  const gen=++this.generation;this.busy.set(true);this.error.set(null);
  try{
   const data=await firstValueFrom(this.api.list({sucursalId:this.branchId(),search:this.search().trim(),
    ...(this.mode()?{modalidad:this.mode() as OrderMode}:{}),
    ...(this.state()?{estado:this.state() as OrderState}:{}),page:this.page(),limit:20}));
   if(gen!==this.generation)return;
   this.items.set(data.data);this.total.set(data.meta.total);this.pages.set(data.meta.totalPages);
  }catch(e){if(gen===this.generation)this.error.set(gcErrorMessage(e))}
  finally{if(gen===this.generation)this.busy.set(false)}
 }
}
