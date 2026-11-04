import {DatePipe} from '@angular/common';
import {Component,computed,effect,inject,signal,untracked} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {GcPaymentsNav} from '../payments-nav';
import {PaymentsApi} from '../data-access/payments.api';
import {PaymentsAccess} from '../data-access/payments-access';
import {amount,money,paymentError} from '../data-access/payments.helpers';
import type {SaleRecord,SalesFilters} from '../data-access/payments.models';
import {GcSaleDetailDialog} from '../components/sale-detail-dialog';
import {parseApiDecimal} from '../../../shared/formatting';

@Component({
 selector:'gc-payments-sales-page',
 imports:[DatePipe,GcPaymentsNav,GcSearchSelect],
 template:`
 <main class="ord-page pay-page pay-sales-page">
  <gc-payments-nav/>
  <div class="ord-heading">
   <h1>Ventas</h1>
   <button type="button" (click)="load()" [disabled]="busy()">Actualizar</button>
  </div>
  <section class="ord-card pay-sales-board">
   <div class="pay-sales-filters">
    <div class="pay-sales-search">
     <label for="sales-search">Buscar venta o pedido</label>
     <div class="pay-sales-search-row">
      <input id="sales-search" [value]="search()" maxlength="100"
       placeholder="Número de venta o pedido"
       (input)="search.set($any($event.target).value)"
       (keyup.enter)="apply()" [disabled]="busy()"/>
      <button type="button" class="ord-primary" (click)="apply()"
       [disabled]="busy()||!!validationError()">Buscar</button>
     </div>
    </div>
    <label>Desde
     <input type="date" [value]="from()" (input)="from.set($any($event.target).value)"
      [disabled]="busy()"/>
    </label>
    <label>Hasta
     <input type="date" [value]="to()" (input)="to.set($any($event.target).value)"
      [disabled]="busy()"/>
    </label>
    <gc-search-select id="sales-limit" label="Filas por página" [items]="pageSizes"
     [value]="limitText()" [clearable]="false" [searchable]="false"
     (valueChange)="changeLimit($event)"/>
   </div>
   <div class="pay-sales-filter-actions">
    <details class="pay-sales-more">
     <summary>Filtrar por importe</summary>
     <div class="pay-sales-amounts">
      <label>Mínimo
       <input inputmode="decimal" [value]="minTotal()" placeholder="Ej. 10.00"
        (input)="minTotal.set($any($event.target).value)" [disabled]="busy()"/>
      </label>
      <label>Máximo
       <input inputmode="decimal" [value]="maxTotal()" placeholder="Ej. 100.00"
        (input)="maxTotal.set($any($event.target).value)" [disabled]="busy()"/>
      </label>
      <button type="button" (click)="apply()" [disabled]="busy()||!!validationError()">Aplicar</button>
     </div>
    </details>
    @if(hasFilters()){
     <button type="button" (click)="clear()" [disabled]="busy()">Limpiar filtros</button>
    }
   </div>
   @if(validationError()){<p role="alert" class="ord-alert">{{validationError()}}</p>}
   @if(error()){<p role="alert" class="ord-alert">{{error()}}</p>}
   @if(busy()){<p role="status" class="ord-muted">Consultando ventas…</p>}
   @if(!error()){
    <div class="ord-table-wrap pay-sales-table">
     <table class="ord-table">
      <thead><tr><th>Fecha</th><th>Venta</th><th>Pedido</th><th>Total</th><th>Acción</th></tr></thead>
      <tbody>
       @for(s of sales();track s.id){
        <tr>
         <td>{{s.cerradaEn|date:'dd/MM/yyyy HH:mm'}}</td>
         <td><strong class="pay-sales-number" [title]="s.numero">{{s.numero}}</strong></td>
         <td><span [title]="s.cuenta?.orden?.numero??''">{{s.cuenta?.orden?.numero??'—'}}</span></td>
         <td class="pay-sales-money">{{money(s.total)}}</td>
         <td><button type="button" (click)="inspect(s.id)"
           [disabled]="busy()||detailBusy()"
           [attr.aria-label]="'Ver detalle de venta '+s.numero">Ver detalle</button></td>
        </tr>
       } @empty {
        @if(!busy()){
         <tr><td colspan="5" class="pay-sales-empty">
          {{hasFilters()?'No hay ventas con esos filtros.':'No hay ventas registradas en esta sucursal.'}}
         </td></tr>
        }
       }
      </tbody>
     </table>
    </div>
   }
   <div class="ord-pagination pay-sales-pagination">
    <span>{{total()}} ventas · Página {{page()}} de {{pages()||1}}</span>
    <div class="ord-actions">
     <button type="button" [disabled]="page()<=1||busy()" (click)="change(-1)">Anterior</button>
     <button type="button" [disabled]="page()>=pages()||busy()" (click)="change(1)">Siguiente</button>
    </div>
   </div>
  </section>
 </main>`
})
export class GcPaymentsSalesPage{
 private readonly api=inject(PaymentsApi);
 private readonly branch=inject(GcBranchContext);
 private readonly access=inject(PaymentsAccess);
 private readonly dialogs=inject(MatDialog);
 protected readonly money=money;
 protected readonly pageSizes=[{id:'10',label:'10'},{id:'20',label:'20'},{id:'50',label:'50'}];
 protected readonly sales=signal<SaleRecord[]>([]);
 protected readonly page=signal(1);
 protected readonly total=signal(0);
 protected readonly pages=signal(0);
 protected readonly limit=signal(20);
 protected readonly limitText=computed(()=>String(this.limit()));
 protected readonly search=signal('');
 protected readonly from=signal('');
 protected readonly to=signal('');
 protected readonly minTotal=signal('');
 protected readonly maxTotal=signal('');
 private readonly applied=signal<SalesFilters>({});
 protected readonly busy=signal(false);
 protected readonly detailBusy=signal(false);
 protected readonly error=signal('');
 protected readonly validationError=computed(()=>{
  if(this.from()&&this.to()&&this.from()>this.to())
   return 'La fecha inicial no puede ser posterior a la final.';
  const min=this.minTotal().trim(),max=this.maxTotal().trim();
  if(min&&amount(min)===null||max&&amount(max)===null)
   return 'Los importes deben ser positivos o cero y tener como máximo dos decimales.';
  if(min&&max&&parseApiDecimal(min).gt(parseApiDecimal(max)))
   return 'El importe mínimo no puede superar el máximo.';
  return '';
 });
 protected readonly hasFilters=computed(()=>Boolean(
  this.search().trim()||this.from()||this.to()||this.minTotal()||this.maxTotal()
  ||Object.values(this.applied()).some(Boolean)));
 private generation=0;
 private dialogGeneration=0;
 constructor(){
  effect(()=>{
   const branch=this.branch.branchId();
   untracked(()=>{
    this.page.set(1);
    this.sales.set([]);
    this.total.set(0);
    this.pages.set(0);
    this.dialogs.closeAll();
    if(branch)void this.load();
   });
  });
 }
 protected apply(){
  if(this.validationError())return;
  this.applied.set({
   search:this.search().trim(),desde:this.from(),hasta:this.to(),
   minTotal:this.minTotal().trim(),maxTotal:this.maxTotal().trim()
  });
  this.page.set(1);
  void this.load();
 }
 protected clear(){
  this.search.set('');this.from.set('');this.to.set('');
  this.minTotal.set('');this.maxTotal.set('');
  this.applied.set({});this.page.set(1);void this.load();
 }
 protected changeLimit(v:string){
  const value=Number(v);
  if(![10,20,50].includes(value))return;
  this.limit.set(value);this.page.set(1);void this.load();
 }
 protected change(delta:number){
  const next=this.page()+delta;
  if(next<1||next>this.pages())return;
  this.page.set(next);void this.load();
 }
 protected async load(){
  const branch=this.branch.branchId();
  if(!branch||!this.access.canSalesRead())return;
  const generation=++this.generation;
  this.busy.set(true);this.error.set('');
  try{
   const data=await firstValueFrom(this.api.sales(branch,this.page(),this.limit(),this.applied()));
   if(generation!==this.generation||branch!==this.branch.branchId())return;
   this.sales.set(data.data);
   this.total.set(data.meta.total);
   this.pages.set(data.meta.totalPages);
  }catch(e){if(generation===this.generation)this.error.set(paymentError(e))}
  finally{if(generation===this.generation)this.busy.set(false)}
 }
 protected async inspect(id:string){
  if(this.detailBusy()||!this.access.canSalesRead())return;
  const generation=++this.dialogGeneration,branch=this.branch.branchId();
  this.detailBusy.set(true);this.error.set('');
  try{
   const sale=await firstValueFrom(this.api.sale(id));
   if(generation!==this.dialogGeneration||branch!==this.branch.branchId())return;
   this.dialogs.open(GcSaleDetailDialog,{
    data:sale,autoFocus:'first-tabbable',restoreFocus:true,
    maxWidth:'96vw',width:'min(96vw, 640px)',maxHeight:'90dvh',
    panelClass:'gc-sale-detail-dialog'
   });
  }catch(e){if(generation===this.dialogGeneration)this.error.set(paymentError(e))}
  finally{if(generation===this.dialogGeneration)this.detailBusy.set(false)}
 }
}
