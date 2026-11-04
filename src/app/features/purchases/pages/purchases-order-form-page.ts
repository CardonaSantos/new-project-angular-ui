import {Component,computed,effect,inject,signal,untracked} from '@angular/core';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {firstValueFrom,Subject,debounceTime,distinctUntilChanged} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {PurchasesApi} from '../data-access/purchases.api';
import {PurchasesAccess} from '../data-access/purchases-access';
import {decimal,newKey} from '../data-access/purchases.helpers';
import type {PurchasePresentation,PurchaseSupplier,PurchaseOrderInput} from '../data-access/purchases.models';
import {GcPurchasesNav} from '../purchases-nav';
interface OrderEditorLine{
 key:string;articuloId:string;presentacionId:string;cantidadCompra:string;
 factorAUnidadBase:string;precioUnitarioCompra:string;tasaImpuesto:string;
 impuestoRecuperable:boolean;
}
const newLine=():OrderEditorLine=>({
 key:newKey(),articuloId:'',presentacionId:'',cantidadCompra:'',
 factorAUnidadBase:'1',precioUnitarioCompra:'',tasaImpuesto:'0',impuestoRecuperable:false
});
@Component({
 selector:'gc-purchases-order-form-page',
 imports:[RouterLink,GcPurchasesNav,GcInventoryPicker,GcSearchSelect],
 template:`<main class="pur-page"><gc-purchases-nav/>
  <header class="pur-heading"><div>
   <a routerLink="/purchases/orders" class="pur-link">← Órdenes de compra</a>
   <h1>Nueva orden de compra</h1></div>
  </header>
  @if(!access.canOrdersCreate()){
   <p class="pur-alert" role="alert">No tienes permiso para crear órdenes de compra.</p>
  }@else{
   @if(requisitionId){<p class="pur-note">Compra vinculada a la requisición {{requisitionNumber()}}. Solo se podrán adquirir los artículos pendientes.</p>}
   <section class="pur-card">
    <h2>1. Proveedor y sucursal</h2>
    <div class="pur-grid">
     <gc-search-select id="pur-order-supplier" label="Proveedor" [items]="supplierChoices()"
      [value]="supplierId()" [remote]="true" [loading]="supplierBusy()"
      (valueChange)="chooseSupplier($event)" (searchChange)="supplierSearch.next($event)"
      placeholder="Buscar proveedor"/>
     <div class="pur-field"><label>Sucursal</label>
      <strong>{{context.active()?.nombre??'Sin sucursal'}}</strong>
     </div>
    </div>
    <div class="pur-field"><label for="pur-order-note">Observaciones (opcional)</label>
     <input id="pur-order-note" maxlength="500" [value]="observations()"
      (input)="observations.set($any($event.target).value);markDirty()"/>
    </div>
   </section>
   <section class="pur-card">
    <div class="pur-heading"><h2>2. Artículos solicitados</h2>
     @if(!requisitionId){<button type="button" (click)="addLine()">Agregar artículo</button>}
    </div>
    <div class="pur-lines">
     @for(l of lines();track l.key;let i=$index){
      <fieldset class="pur-line pur-simple-fieldset">
       <div class="pur-line-header"><strong>Artículo {{i+1}}</strong>
        @if(lines().length>1&&!requisitionId){
         <button type="button" (click)="removeLine(l.key)">Quitar</button>
        }
       </div>
       @if(requisitionId){
        <strong>{{requisitionLabel(l.articuloId)}}</strong>
       }@else{
        <gc-inventory-picker [id]="'pur-order-art-'+l.key" label="Artículo"
         kind="article" [value]="l.articuloId"
         (valueChange)="chooseArticle(l.key,$event)"/>
       }
       @if(supplierId()){
        <gc-search-select [id]="'pur-order-pres-'+l.key" label="Presentación de compra"
         [items]="presentationsFor(l.articuloId)" [value]="l.presentacionId"
         (valueChange)="choosePresentation(l.key,$event)"
         placeholder="Unidad base"/>
       }
       <div class="pur-grid-3">
        <div class="pur-field"><label [for]="'pur-order-qty-'+l.key">Cantidad</label>
         <input [id]="'pur-order-qty-'+l.key" inputmode="decimal" [value]="l.cantidadCompra"
          (input)="patch(l.key,'cantidadCompra',$any($event.target).value)"/>
        </div>
        <div class="pur-field"><label [for]="'pur-order-price-'+l.key">Precio unitario (Q)</label>
         <input [id]="'pur-order-price-'+l.key" inputmode="decimal" [value]="l.precioUnitarioCompra"
          (input)="patch(l.key,'precioUnitarioCompra',$any($event.target).value)"/>
        </div>
        <div class="pur-field"><label>Factor a unidad base</label>
         <input [value]="l.factorAUnidadBase" disabled/>
        </div>
       </div>
       <details>
        <summary>Impuestos</summary>
        <div class="pur-grid">
         <div class="pur-field"><label [for]="'pur-order-tax-'+l.key">Tasa (0 a 1)</label>
          <input [id]="'pur-order-tax-'+l.key" inputmode="decimal"
           [value]="l.tasaImpuesto" (input)="patch(l.key,'tasaImpuesto',$any($event.target).value)"/>
         </div>
         <label class="pur-field"><span>Impuesto recuperable</span>
          <input type="checkbox" [checked]="l.impuestoRecuperable"
           (change)="patch(l.key,'impuestoRecuperable',$any($event.target).checked)"/>
         </label>
        </div>
       </details>
      </fieldset>
     }
    </div>
   </section>
   <section class="pur-card">
    <h2>3. Guardar orden</h2>
    <label><input type="checkbox" [checked]="taxIncluded()"
     (change)="taxIncluded.set($any($event.target).checked);markDirty()"/>
     Los precios incluyen impuestos</label>
    @if(error()){<p class="pur-alert" role="alert">{{error()}}</p>}
    <div class="pur-actions">
     <button type="button" [disabled]="busy()||!valid()" (click)="submit(false)">
      {{busy()?'Guardando…':'Guardar borrador'}}
     </button>
     @if(access.canOrdersApprove()){
      <button type="button" class="pur-primary" [disabled]="busy()||!valid()"
       (click)="submit(true)">Crear y confirmar orden</button>
     }
     <a routerLink="/purchases/orders" class="pur-link">Volver</a>
    </div>
    <p class="pur-muted">Confirmar una orden no ingresa stock; la mercancía se registra al recibirla.</p>
   </section>
  }
 </main>`,
 styleUrl:'../purchases.scss'
})
export class GcPurchasesOrderFormPage {
 protected readonly context=inject(GcBranchContext);
 protected readonly access=inject(PurchasesAccess);
 private readonly api=inject(PurchasesApi);
 private readonly router=inject(Router);
 private readonly route=inject(ActivatedRoute);
 protected readonly requisitionId=this.route.snapshot.queryParamMap.get('requisitionId')??'';
 protected readonly requisitionNumber=signal('');
 private readonly requisitionLabels=signal<Record<string,string>>({});
 private readonly notices=inject(GcNotificationService);
 private readonly dialogs=inject(ConfirmDialogService);
 protected readonly supplierId=signal('');
 protected readonly suppliers=signal<PurchaseSupplier[]>([]);
 protected readonly supplierChoices=computed(()=>this.suppliers().map(s=>({id:s.id,label:s.nombre})));
 protected readonly supplierBusy=signal(false);
 protected readonly supplierSearch=new Subject<string>();
 protected readonly presentations=signal<PurchasePresentation[]>([]);
 protected readonly lines=signal<OrderEditorLine[]>([newLine()]);
 protected readonly observations=signal('');
 protected readonly taxIncluded=signal(false);
 protected readonly busy=signal(false);protected readonly error=signal('');
 protected readonly valid=computed(()=>Boolean(
  this.context.branchId()&&this.supplierId()&&this.lines().length&&
  this.lines().every(l=>Boolean(l.articuloId&&decimal(l.cantidadCompra)&&
   decimal(l.factorAUnidadBase)&&decimal(l.precioUnitarioCompra,true)!==null&&
   decimal(l.tasaImpuesto,true)!==null&&Number(l.tasaImpuesto)<=1))
 ));
 private generation=0;private dirty=false;private key=newKey();
 constructor(){
  this.supplierSearch.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed())
   .subscribe(q=>void this.loadSuppliers(q));
  effect(()=>{
   this.context.branchId();untracked(()=>{
    this.lines.set([newLine()]);this.supplierId.set('');this.dirty=false;
    void this.loadSuppliers('');
    if(this.requisitionId&&this.context.branchId())void this.loadRequisition();
   });
  });
 }
 private async loadRequisition(){
  try{
   const r=await firstValueFrom(this.api.requisition(this.requisitionId));
   if(r.estado!=='ABIERTA')throw Error('La requisición ya no está abierta.');
   this.requisitionNumber.set(r.numero);
   this.requisitionLabels.set(Object.fromEntries(r.lineas.map(l=>[l.articuloId,l.articulo.nombre])));
   const pending=r.lineas.filter(l=>Number(l.pendiente)>0);
   if(!pending.length)throw Error('La requisición no tiene insumos pendientes.');
   this.lines.set(pending.map(l=>({...newLine(),articuloId:l.articuloId,
    cantidadCompra:l.pendiente})));
  }catch(e){this.error.set(gcErrorMessage(e))}
 }
 protected requisitionLabel(id:string){return this.requisitionLabels()[id]??id}
 protected markDirty(){this.key=newKey();this.dirty=true}
 private async loadSuppliers(search:string){
  const gen=++this.generation;this.supplierBusy.set(true);
  try{
   const result=await firstValueFrom(this.api.suppliers({sucursalId:this.context.branchId()??undefined,
    search,limit:50}));
   if(gen!==this.generation)return;
   const selected=this.suppliers().find(s=>s.id===this.supplierId());
   const active=result.data.filter(s=>s.activo);
   this.suppliers.set(selected&&!active.some(s=>s.id===selected.id)?[selected,...active]:active);
  }catch(e){if(gen===this.generation)this.error.set(gcErrorMessage(e))}
  finally{if(gen===this.generation)this.supplierBusy.set(false)}
 }
 protected chooseSupplier(id:string){
  this.supplierId.set(id);this.presentations.set([]);
  this.lines.update(ls=>ls.map(l=>({...l,presentacionId:'',factorAUnidadBase:'1'})));
  this.markDirty();
  if(id)void this.loadPresentations(id);
 }
 private async loadPresentations(id:string){
  try{
   const result=await firstValueFrom(this.api.presentations({sucursalId:this.context.branchId()??undefined,
    proveedorId:id,limit:100}));
   if(this.supplierId()===id)
    this.presentations.set(result.data.filter(p=>p.activa&&(!p.proveedorId||p.proveedorId===id)));
  }catch{/* Base-unit ordering remains possible. */}
 }
 protected presentationsFor(id:string){
  return this.presentations().filter(p=>p.articuloId===id)
   .map(p=>({id:p.id,label:p.nombre+' · '+p.factorAUnidadBase+' en unidad base'}));
 }
 protected addLine(){this.lines.update(ls=>[...ls,newLine()]);this.markDirty()}
 protected removeLine(key:string){
  this.lines.update(ls=>ls.filter(l=>l.key!==key));this.markDirty();
 }
 protected patch<K extends keyof OrderEditorLine>(key:string,field:K,value:OrderEditorLine[K]){
  this.lines.update(ls=>ls.map(l=>l.key===key?{...l,[field]:value}:l));this.markDirty();
 }
 protected chooseArticle(key:string,id:string){
  this.lines.update(ls=>ls.map(l=>l.key===key?{
   ...l,articuloId:id,presentacionId:'',factorAUnidadBase:'1'
  }:l));this.markDirty();
 }
 protected choosePresentation(key:string,id:string){
  const p=this.presentations().find(p=>p.id===id);
  this.lines.update(ls=>ls.map(l=>l.key===key?{
   ...l,presentacionId:id,factorAUnidadBase:p?.factorAUnidadBase??'1'
  }:l));this.markDirty();
 }
 protected async submit(confirmOrder:boolean){
  if(this.busy()||!this.valid()||!this.access.canOrdersCreate()||
   (this.requisitionId&&!this.access.canSupplyRequest())||
   (confirmOrder&&!this.access.canOrdersApprove()))return;
  if(confirmOrder&&!await this.dialogs.confirm({title:'Crear y confirmar orden',
   message:'Se registrará la orden y quedará lista para recibir mercancía. Esto no aumenta todavía el stock.',
   confirmText:'Crear y confirmar'}))return;
  const body:PurchaseOrderInput={
   sucursalId:this.context.branchId()!,proveedorId:this.supplierId(),
   precioIncluyeImpuesto:this.taxIncluded(),observaciones:this.observations().trim(),
   claveOperacion:this.key,
   ...(this.requisitionId?{requisicionId:this.requisitionId}:{}),
   lineas:this.lines().map(l=>({
    articuloId:l.articuloId,...(l.presentacionId?{presentacionId:l.presentacionId}:{}),
    cantidadCompra:decimal(l.cantidadCompra)!,factorAUnidadBase:decimal(l.factorAUnidadBase)!,
    precioUnitarioCompra:decimal(l.precioUnitarioCompra,true)!,
    tasaImpuesto:decimal(l.tasaImpuesto,true)!,impuestoRecuperable:l.impuestoRecuperable
   }))
  };
  this.busy.set(true);this.error.set('');
  try{
   const o=await firstValueFrom(this.requisitionId
    ?this.api.purchaseFromRequisition(this.requisitionId,{claveOperacion:this.key,orden:body})
    :this.api.createOrder(body));this.dirty=false;
   if(confirmOrder){
    try{
     await firstValueFrom(this.api.confirmOrder(o.id,newKey()));
     this.notices.show('Orden de compra confirmada.','success');
    }catch(e){this.notices.show('Orden guardada como borrador: '+gcErrorMessage(e),'error',0)}
   }else this.notices.show('Orden de compra guardada.','success');
   await this.router.navigate(['/purchases/orders',o.id]);
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
 hasUnsavedChanges(){return this.dirty&&!this.busy()}
}
