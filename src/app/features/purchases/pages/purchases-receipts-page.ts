import {DatePipe} from '@angular/common';
import {Component,computed,effect,inject,signal,untracked} from '@angular/core';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {PurchasesApi} from '../data-access/purchases.api';
import {PurchasesAccess} from '../data-access/purchases-access';
import type {PurchaseReceipt,PurchaseSupplier} from '../data-access/purchases.models';
import {GcPurchasesNav} from '../purchases-nav';
@Component({
 selector:'gc-purchases-receipts-page',
 imports:[DatePipe,RouterLink,GcSearchSelect,GcPurchasesNav],
 template:`<main class="pur-page"><gc-purchases-nav/>
  <header class="pur-heading"><h1>Recepciones</h1>
   <div class="pur-actions">
    <button type="button" (click)="load()" [disabled]="busy()">Actualizar</button>
    @if(access.canReceiptsCreate()){
     <a class="pur-button pur-primary" routerLink="/purchases/receipts/new">Nueva recepción</a>
    }
   </div>
  </header>
  <section class="pur-card">
   <div class="pur-grid-3">
    <gc-search-select id="pur-receipt-provider" label="Proveedor" [items]="supplierChoices()"
     [value]="supplierId()" (valueChange)="supplierId.set($event);page.set(1);load()"
     placeholder="Todos los proveedores"/>
    <gc-search-select id="pur-receipt-size" label="Por página" [items]="sizes"
     [value]="String(limit())" [clearable]="false" [searchable]="false"
     (valueChange)="setLimit($event)"/>
   </div>
   @if(error()){<p role="alert" class="pur-alert">{{error()}}</p>}
   @if(busy()){<p role="status" class="pur-muted">Consultando recepciones…</p>}
   <div class="pur-table-scroll">
    <table class="pur-table">
     <thead><tr><th>Recepción</th><th>Proveedor</th><th>Almacén</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
     <tbody>
      @for(row of rows();track row.id){
       <tr class="pur-data-row">
        <td data-label="Recepción"><strong [title]="row.numero">{{row.numero}}</strong></td>
        <td data-label="Proveedor">{{row.proveedor.nombre}}</td>
        <td data-label="Almacén">{{row.almacen.nombre}}</td>
        <td data-label="Estado"><span class="pur-badge">{{status(row.estado)}}</span></td>
        <td data-label="Fecha">{{row.creadoEn|date:'dd/MM/yyyy HH:mm'}}</td>
        <td data-label="Acción"><a class="pur-link" [routerLink]="['/purchases/receipts',row.id]">Ver detalle</a></td>
       </tr>
      } @empty {
       @if(!busy()){<tr><td colspan="6" class="pur-empty">No hay recepciones con estos filtros.</td></tr>}
      }
     </tbody>
    </table>
   </div>
   <div class="pur-pagination">
    <span class="pur-muted">{{total()}} recepciones · Página {{page()}} de {{pages()||1}}</span>
    <div class="pur-actions">
     <button type="button" (click)="change(-1)" [disabled]="page()<=1||busy()">Anterior</button>
     <button type="button" (click)="change(1)" [disabled]="page()>=pages()||busy()">Siguiente</button>
    </div>
   </div>
  </section>
 </main>`,
 styleUrl:'../purchases.scss'
})
export class GcPurchasesReceiptsPage {
 private readonly api=inject(PurchasesApi);
 private readonly branch=inject(GcBranchContext);
 protected readonly access=inject(PurchasesAccess);
 protected readonly rows=signal<PurchaseReceipt[]>([]);
 protected readonly suppliers=signal<PurchaseSupplier[]>([]);
 protected readonly supplierId=signal('');
 protected readonly supplierChoices=computed(()=>this.suppliers().map(s=>({id:s.id,label:s.nombre})));
 protected readonly page=signal(1);protected readonly total=signal(0);protected readonly pages=signal(0);
 protected readonly limit=signal(20);
 protected readonly sizes=[{id:'10',label:'10'},{id:'20',label:'20'},{id:'50',label:'50'}];
 protected readonly busy=signal(false);protected readonly error=signal('');
 private generation=0;
 constructor(){
  effect(()=>{
   const branch=this.branch.branchId();
   untracked(()=>{
    this.page.set(1);this.supplierId.set('');this.rows.set([]);
    if(branch){void this.loadSuppliers();void this.load()}
   });
  });
 }
 protected status(value:string){return value==='CONFIRMADO'?'Ingresada':value==='BORRADOR'?'Borrador':'Cancelada'}
 private async loadSuppliers(){
  try{
   const result=await firstValueFrom(this.api.suppliers({sucursalId:this.branch.branchId()??undefined,limit:100}));
   this.suppliers.set(result.data);
  }catch{this.suppliers.set([])}
 }
 protected setLimit(value:string){
  const n=Number(value);if(![10,20,50].includes(n))return;
  this.limit.set(n);this.page.set(1);void this.load();
 }
 protected change(delta:number){
  const n=this.page()+delta;if(n<1||n>this.pages()||this.busy())return;
  this.page.set(n);void this.load();
 }
 protected async load(){
  const branch=this.branch.branchId();
  if(!branch||!this.access.canRead())return;
  const generation=++this.generation;
  this.busy.set(true);this.error.set('');
  try{
   const r=await firstValueFrom(this.api.receipts({sucursalId:branch,proveedorId:this.supplierId(),
    page:this.page(),limit:this.limit()}));
   if(generation!==this.generation||branch!==this.branch.branchId())return;
   this.rows.set(r.data);this.total.set(r.meta.total);this.pages.set(r.meta.totalPages);
  }catch(e){if(generation===this.generation)this.error.set(gcErrorMessage(e))}
  finally{if(generation===this.generation)this.busy.set(false)}
 }
}
