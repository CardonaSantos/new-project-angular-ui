import {DatePipe} from '@angular/common';
import {Component,computed,effect,inject,signal,untracked} from '@angular/core';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {PurchasesApi} from '../data-access/purchases.api';
import {PurchasesAccess} from '../data-access/purchases-access';
import {money} from '../data-access/purchases.helpers';
import type {PurchaseOrder,PurchaseSupplier} from '../data-access/purchases.models';
import {GcPurchasesNav} from '../purchases-nav';
@Component({
 selector:'gc-purchases-orders-page',
 imports:[DatePipe,RouterLink,GcSearchSelect,GcPurchasesNav],
 template:`<main class="pur-page"><gc-purchases-nav/>
  <header class="pur-heading"><h1>Órdenes de compra</h1>
   <div class="pur-actions">
    <button type="button" (click)="load()" [disabled]="busy()">Actualizar</button>
    @if(access.canOrdersCreate()){
     <a class="pur-button pur-primary" routerLink="/purchases/orders/new">Nueva orden</a>
    }
   </div>
  </header>
  <section class="pur-card">
   <div class="pur-grid">
    <gc-search-select id="pur-orders-supplier" label="Proveedor" [items]="supplierChoices()"
     [value]="supplierId()" (valueChange)="supplierId.set($event);page.set(1);load()"
     placeholder="Todos los proveedores"/>
    <gc-search-select id="pur-orders-limit" label="Por página" [items]="sizes"
     [value]="limitText()" [clearable]="false" [searchable]="false"
     (valueChange)="setLimit($event)"/>
   </div>
   @if(error()){<p role="alert" class="pur-alert">{{error()}}</p>}
   @if(busy()){<p role="status" class="pur-muted">Consultando órdenes…</p>}
   <div class="pur-table-scroll">
    <table class="pur-table">
     <thead><tr><th>Orden</th><th>Proveedor</th><th>Fecha</th><th>Importe</th><th>Estado</th><th></th></tr></thead>
     <tbody>
      @for(o of rows();track o.id){
       <tr class="pur-data-row">
        <td data-label="Orden"><strong [title]="o.numero">{{o.numero}}</strong></td>
        <td data-label="Proveedor">{{o.proveedor.nombre}}</td>
        <td data-label="Fecha">{{o.creadaEn|date:'dd/MM/yyyy'}}</td>
        <td data-label="Importe">{{money(o.totalEstimado)}}</td>
        <td data-label="Estado"><span class="pur-badge">{{status(o.estado)}}</span></td>
        <td data-label="Acción"><a class="pur-link" [routerLink]="['/purchases/orders',o.id]">Ver orden</a></td>
       </tr>
      } @empty {@if(!busy()){<tr><td colspan="6" class="pur-empty">No hay órdenes de compra.</td></tr>}}
     </tbody>
    </table>
   </div>
   <div class="pur-pagination">
    <span class="pur-muted">{{total()}} órdenes · Página {{page()}} de {{pages()||1}}</span>
    <div class="pur-actions">
     <button type="button" [disabled]="page()<=1||busy()" (click)="change(-1)">Anterior</button>
     <button type="button" [disabled]="page()>=pages()||busy()" (click)="change(1)">Siguiente</button>
    </div>
   </div>
  </section>
 </main>`,
 styleUrl:'../purchases.scss'
})
export class GcPurchasesOrdersPage{
 private readonly api=inject(PurchasesApi);
 private readonly branch=inject(GcBranchContext);
 protected readonly access=inject(PurchasesAccess);
 protected readonly money=money;
 protected readonly supplierId=signal('');
 protected readonly suppliers=signal<PurchaseSupplier[]>([]);
 protected readonly supplierChoices=computed(()=>this.suppliers().map(s=>({id:s.id,label:s.nombre})));
 protected readonly rows=signal<PurchaseOrder[]>([]);
 protected readonly page=signal(1);protected readonly limit=signal(20);
 protected readonly limitText=computed(()=>String(this.limit()));
 protected readonly total=signal(0);protected readonly pages=signal(0);
 protected readonly sizes=[{id:'10',label:'10'},{id:'20',label:'20'},{id:'50',label:'50'}];
 protected readonly busy=signal(false);protected readonly error=signal('');
 private generation=0;
 constructor(){
  effect(()=>{
   const branch=this.branch.branchId();untracked(()=>{
    this.rows.set([]);this.page.set(1);this.supplierId.set('');
    if(branch){void this.loadSuppliers();void this.load()}
   });
  });
 }
 private async loadSuppliers(){
  try{
   const result=await firstValueFrom(this.api.suppliers({sucursalId:this.branch.branchId()??undefined,limit:100}));
   this.suppliers.set(result.data);
  }catch{this.suppliers.set([])}
 }
 protected status(s:string){return s==='CONFIRMADA'?'Confirmada':s==='BORRADOR'?'Borrador':s==='CERRADA'?'Cerrada':'Cancelada'}
 protected setLimit(v:string){
  const n=Number(v);if(![10,20,50].includes(n))return;
  this.limit.set(n);this.page.set(1);void this.load();
 }
 protected change(d:number){
  const n=this.page()+d;if(n<1||n>this.pages()||this.busy())return;
  this.page.set(n);void this.load();
 }
 protected async load(){
  const branch=this.branch.branchId();if(!branch||!this.access.canRead())return;
  const generation=++this.generation;
  this.busy.set(true);this.error.set('');
  try{
   const r=await firstValueFrom(this.api.orders({sucursalId:branch,proveedorId:this.supplierId(),
    page:this.page(),limit:this.limit()}));
   if(generation!==this.generation||branch!==this.branch.branchId())return;
   this.rows.set(r.data);this.total.set(r.meta.total);this.pages.set(r.meta.totalPages);
  }catch(e){if(generation===this.generation)this.error.set(gcErrorMessage(e))}
  finally{if(generation===this.generation)this.busy.set(false)}
 }
}
