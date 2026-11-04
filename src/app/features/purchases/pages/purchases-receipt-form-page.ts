import {Component,computed,effect,inject,OnInit,signal,untracked} from '@angular/core';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {firstValueFrom,Subject,debounceTime,distinctUntilChanged} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {InventoryApi} from '../../inventory/data-access/inventory.api';
import type {Article} from '../../inventory/data-access/inventory.models';
import {parseApiDecimal,toApiDecimal} from '../../../shared/formatting';
import {PurchasesApi} from '../data-access/purchases.api';
import {PurchasesAccess} from '../data-access/purchases-access';
import {decimal,newKey} from '../data-access/purchases.helpers';
import type {PurchaseReceiptInput,ReceiptLineInput,PurchaseSupplier,PurchasePresentation,PurchaseOrder} from '../data-access/purchases.models';
import {GcPurchasesNav} from '../purchases-nav';
import {GcPurchasesCreateArticle} from '../components/purchases-create-article';
import {GcPurchasesCreateSupplier} from '../components/purchases-create-supplier';

interface ReceiptEditorLine {
 key:string;articuloId:string;article:Article|null;ubicacionId:string;loteId:string;
 presentacionId:string;cantidadCompra:string;cantidadRechazada:string;
 factorAUnidadBase:string;precioUnitarioCompra:string;
 tasaImpuesto:string;impuestoRecuperable:boolean;
 ordenCompraLineaId:string;
 newLotCode:string;newExpiry:string;lotBusy:boolean;
}
const blank=():ReceiptEditorLine=>({
 key:newKey(),articuloId:'',article:null,ubicacionId:'',loteId:'',
 presentacionId:'',cantidadCompra:'',cantidadRechazada:'0',
 factorAUnidadBase:'1',precioUnitarioCompra:'',tasaImpuesto:'0',
 impuestoRecuperable:false,ordenCompraLineaId:'',newLotCode:'',newExpiry:'',lotBusy:false
});
@Component({
 selector:'gc-purchases-receipt-form-page',
 imports:[RouterLink,GcPurchasesNav,GcInventoryPicker,GcSearchSelect,GcPurchasesCreateArticle,GcPurchasesCreateSupplier],
 template:`<main class="pur-page"><gc-purchases-nav/>
  <header class="pur-heading"><div>
   <a class="pur-link" routerLink="/purchases/receipts">← Recepciones</a>
   <h1>{{editId?'Editar recepción':'Nueva recepción de mercancía'}}</h1></div>
  </header>
  @if(!access.canReceiptsCreate()){
   <p role="alert" class="pur-alert">No tienes permiso para registrar recepciones.</p>
  }@else{
   @if(loading()){<p role="status" class="pur-muted">Cargando datos…</p>}
   <section class="pur-card">
    <h2>1. Proveedor y destino</h2>
    @if(orderId()){<p class="pur-note">Recepción de la orden de compra {{orderNumber()}}. La mercancía debe vincularse a sus líneas.</p>}
    @if(access.canSupplierManage()&&!orderId()){
     <button type="button" (click)="showSupplierCreation.update(v=>!v)">
      {{showSupplierCreation()?'Volver a la recepción':'Crear proveedor'}}
     </button>
    }
    @if(showSupplierCreation()){
     <gc-purchases-create-supplier (created)="supplierCreated($event)"
      (cancel)="showSupplierCreation.set(false)"/>
    }
    <div class="pur-grid">
     <gc-search-select id="pur-form-supplier" label="Proveedor"
      [items]="supplierChoices()" [remote]="true" [loading]="supplierBusy()"
      [value]="supplierId()" [disabled]="!!orderId()"
      (valueChange)="setSupplier($event)" (searchChange)="queueSupplier($event)"
      placeholder="Buscar proveedor…"/>
     <gc-inventory-picker id="pur-form-warehouse" label="Almacén de destino" kind="warehouse"
      [branchId]="branchId()" [value]="warehouseId()"
      (valueChange)="setWarehouse($event)"/>
    </div>
    <div class="pur-grid">
     <div class="pur-field"><label for="pur-receipt-reference">Factura, remisión o referencia</label>
      <input id="pur-receipt-reference" [value]="reference()" maxlength="150"
       (input)="reference.set($any($event.target).value);markDirty()"
       placeholder="Ej. Factura 000123"/>
     </div>
     <div class="pur-field"><label for="pur-receipt-note">Observaciones</label>
      <input id="pur-receipt-note" [value]="observations()" maxlength="500"
       (input)="observations.set($any($event.target).value);markDirty()"
       placeholder="Opcional"/>
     </div>
    </div>
    <p class="pur-muted">Si no existe factura, indica un motivo en observaciones.</p>
   </section>
   <section class="pur-card">
    <div class="pur-heading"><h2>2. Productos recibidos</h2>
     @if(!orderId()){<button type="button" (click)="addLine()" [disabled]="busy()">Agregar artículo</button>}
    </div>
    @if(!orderId()&&!supplierId()){<p class="pur-muted">Selecciona primero un proveedor.</p>}
    <div class="pur-lines">
     @for(line of lines();track line.key;let i=$index){
      <fieldset class="pur-line pur-simple-fieldset">
       <div class="pur-line-header">
        <strong>Artículo {{i+1}}</strong>
        @if(!orderId()&&lines().length>1){
         <button type="button" (click)="removeLine(line.key)" [disabled]="busy()"
          [attr.aria-label]="'Eliminar artículo '+(i+1)">Quitar</button>
        }
       </div>
       @if(orderId()){
        <strong>{{line.article?.nombre??line.articuloId}}</strong>
       }@else{
        <gc-inventory-picker [id]="'pur-receipt-art-'+line.key" kind="article" label="Artículo"
         [value]="line.articuloId"
         (valueChange)="chooseArticle(line.key,$event)"/>
        @if(access.canArticleManage()){
         <button type="button" (click)="articleCreationKey.set(line.key)">Crear artículo nuevo</button>
        }
       }
       @if(articleCreationKey()===line.key){
        <gc-purchases-create-article (created)="createdArticle(line.key,$event)"
         (cancel)="articleCreationKey.set('')"/>
       }
       <div class="pur-grid">
        <gc-inventory-picker [id]="'pur-receipt-loc-'+line.key" kind="location"
         label="Ubicación donde se almacena" [branchId]="branchId()" [warehouseId]="warehouseId()"
         [value]="line.ubicacionId" (valueChange)="patch(line.key,'ubicacionId',$event)"/>
        @if(line.article?.requiereLote||!!line.loteId){
         <gc-inventory-picker [id]="'pur-receipt-lot-'+line.key" kind="lot" label="Lote"
          [branchId]="branchId()" [articleId]="line.articuloId"
          [value]="line.loteId" (valueChange)="patch(line.key,'loteId',$event)"/>
        }
       </div>
       @if(line.article?.requiereLote&&access.canLotManage()){
        <details class="pur-lot-add"><summary>Registrar lote nuevo</summary>
         <div class="pur-grid">
          <div class="pur-field"><label [for]="'pur-lot-code-'+line.key">Código de lote</label>
           <input [id]="'pur-lot-code-'+line.key" [value]="line.newLotCode"
            (input)="patch(line.key,'newLotCode',$any($event.target).value)" maxlength="100"/>
          </div>
          @if(line.article?.requiereVencimiento){
           <div class="pur-field"><label [for]="'pur-lot-exp-'+line.key">Vencimiento</label>
            <input [id]="'pur-lot-exp-'+line.key" type="date" [value]="line.newExpiry"
             (input)="patch(line.key,'newExpiry',$any($event.target).value)"/>
           </div>
          }
         </div>
         <button type="button" [disabled]="line.lotBusy||!line.newLotCode.trim()"
          (click)="createLot(line.key)">Crear lote</button>
        </details>
       }
       @if(!orderId()&&supplierId()){
        <gc-search-select [id]="'pur-receipt-presentation-'+line.key"
         label="Presentación de compra (opcional)" [items]="presentationsFor(line.articuloId)"
         [value]="line.presentacionId"
         (valueChange)="choosePresentation(line.key,$event)"
         placeholder="Unidad base"/>
       }
       <div class="pur-grid-3">
        <div class="pur-field"><label [for]="'pur-receipt-qty-'+line.key">Cantidad recibida</label>
         <input [id]="'pur-receipt-qty-'+line.key" inputmode="decimal"
          [value]="line.cantidadCompra" (input)="patch(line.key,'cantidadCompra',$any($event.target).value)"/>
        </div>
        <div class="pur-field"><label [for]="'pur-receipt-cost-'+line.key">Precio de compra por unidad (Q)</label>
         <input [id]="'pur-receipt-cost-'+line.key" inputmode="decimal"
          [value]="line.precioUnitarioCompra"
          (input)="patch(line.key,'precioUnitarioCompra',$any($event.target).value)"/>
        </div>
        <div class="pur-field"><label [for]="'pur-receipt-factor-'+line.key">Factor a unidad base</label>
         <input [id]="'pur-receipt-factor-'+line.key" [value]="line.factorAUnidadBase"
          disabled aria-describedby="pur-receipt-factor-help"/>
        </div>
       </div>
       @if(line.article){<p class="pur-muted">
        1 presentación = {{line.factorAUnidadBase}} {{line.article.unidadBase.nombre}}.
       </p>}
       <details>
        <summary>Rechazos e impuestos</summary>
        <div class="pur-grid-3">
         <div class="pur-field"><label [for]="'pur-receipt-reject-'+line.key">Cantidad rechazada</label>
          <input [id]="'pur-receipt-reject-'+line.key" inputmode="decimal"
           [value]="line.cantidadRechazada" (input)="patch(line.key,'cantidadRechazada',$any($event.target).value)"/>
         </div>
         <div class="pur-field"><label [for]="'pur-receipt-tax-'+line.key">Tasa de impuesto (0 a 1)</label>
          <input [id]="'pur-receipt-tax-'+line.key" inputmode="decimal"
           [value]="line.tasaImpuesto" [disabled]="!!orderId()"
           (input)="patch(line.key,'tasaImpuesto',$any($event.target).value)"/>
         </div>
         <label class="pur-field"><span>Impuesto recuperable</span>
          <input type="checkbox" [checked]="line.impuestoRecuperable" [disabled]="!!orderId()"
           (change)="patch(line.key,'impuestoRecuperable',$any($event.target).checked)"/>
         </label>
        </div>
       </details>
      </fieldset>
     }
    </div>
   </section>
   <section class="pur-card">
    <h2>3. Revisar y guardar</h2>
    <div class="pur-inline">
     <label><input type="checkbox" [checked]="taxIncluded()" [disabled]="!!orderId()"
      (change)="taxIncluded.set($any($event.target).checked);markDirty()"/> El precio incluye impuestos</label>
    </div>
    @if(orderId()){<p class="pur-muted">La modalidad fiscal debe coincidir con la orden de compra.</p>}
    <p class="pur-note">Guardar un borrador no modifica existencias. «Guardar e ingresar» confirma la recepción y registra stock.</p>
    @if(error()){<p role="alert" class="pur-alert">{{error()}}</p>}
    <div class="pur-actions">
     <button type="button" [disabled]="busy()||!canSave()" (click)="save(false)">
      {{busy()?'Guardando…':'Guardar borrador'}}
     </button>
     @if(access.canReceiptsConfirm()){
      <button type="button" class="pur-primary" [disabled]="busy()||!canSave()" (click)="save(true)">
       {{busy()?'Procesando…':'Guardar e ingresar stock'}}
      </button>
     }
     <a routerLink="/purchases/receipts" class="pur-link">Volver</a>
    </div>
   </section>
  }
 </main>`,
 styleUrl:'../purchases.scss'
})
export class GcPurchasesReceiptFormPage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly api=inject(PurchasesApi);
 private readonly inv=inject(InventoryApi);
 private readonly branch=inject(GcBranchContext);
 protected readonly access=inject(PurchasesAccess);
 private readonly notice=inject(GcNotificationService);
 private readonly dialog=inject(ConfirmDialogService);
 protected readonly branchId=computed(()=>this.branch.branchId()??'');
 protected readonly editId=this.route.snapshot.paramMap.get('id')??'';
 protected readonly supplierId=signal('');
 protected readonly warehouseId=signal('');
 protected readonly reference=signal('');
 protected readonly observations=signal('');
 protected readonly taxIncluded=signal(false);
 protected readonly orderId=signal('');
 protected readonly orderNumber=signal('');
 protected readonly lines=signal<ReceiptEditorLine[]>([blank()]);
 protected readonly showSupplierCreation=signal(false);
 protected readonly articleCreationKey=signal('');
 protected readonly suppliers=signal<PurchaseSupplier[]>([]);
 protected readonly supplierBusy=signal(false);
 protected readonly supplierChoices=computed(()=>this.suppliers().map(s=>({id:s.id,label:s.nombre})));
 protected readonly presentations=signal<PurchasePresentation[]>([]);
 protected readonly loading=signal(false);
 protected readonly busy=signal(false);
 protected readonly error=signal('');
 private supplierGeneration=0;private formGeneration=0;
 private dirty=false;
 private readonly searches=new Subject<string>();
 protected readonly canSave=computed(()=>Boolean(
  this.branchId()&&this.supplierId()&&this.warehouseId()&&
  (this.orderId()||this.reference().trim()||this.observations().trim())&&
  this.lines().length&&this.lines().every(l=>{
   const qty=decimal(l.cantidadCompra),rejected=decimal(l.cantidadRechazada||'0',true);
   const price=decimal(l.precioUnitarioCompra,true),factor=decimal(l.factorAUnidadBase);
   const tax=decimal(l.tasaImpuesto||'0',true);
   return l.articuloId&&l.ubicacionId&&qty&&rejected!==null&&
    parseApiDecimal(rejected).lt(parseApiDecimal(qty))&&price!==null&&factor!==null&&
    tax!==null&&parseApiDecimal(tax).lte(1)&&
    (!l.article?.requiereLote||!!l.loteId)&&(!this.orderId()||!!l.ordenCompraLineaId);
  })
 ));
 constructor(){
  this.searches.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed())
   .subscribe(term=>void this.searchSuppliers(term));
  effect(()=>{
   const branch=this.branchId();
   untracked(()=>{
    if(!this.editId&&!this.route.snapshot.queryParamMap.get('orderId')){
     this.warehouseId.set('');this.supplierId.set('');
     this.lines.set([blank()]);this.dirty=false;
    }
    if(branch)void this.searchSuppliers('');
   });
  });
 }
 ngOnInit(){
  const orderId=this.route.snapshot.queryParamMap.get('orderId');
  if(this.editId)void this.loadEdit(this.editId);
  else if(orderId)void this.loadPurchaseOrder(orderId);
 }
 protected markDirty(){this.dirty=true}
 protected queueSupplier(term:string){this.searches.next(term)}
 private async searchSuppliers(term:string){
  const generation=++this.supplierGeneration;
  this.supplierBusy.set(true);
  try{
   const result=await firstValueFrom(this.api.suppliers({sucursalId:this.branchId(),search:term,limit:50}));
   if(generation===this.supplierGeneration){
    const existing=this.suppliers().find(s=>s.id===this.supplierId());
    const list=result.data.filter(s=>s.activo);
    this.suppliers.set(existing&&!list.some(s=>s.id===existing.id)?[existing,...list]:list);
   }
  }catch(e){if(generation===this.supplierGeneration)this.error.set(gcErrorMessage(e))}
  finally{if(generation===this.supplierGeneration)this.supplierBusy.set(false)}
 }
 protected supplierCreated(s:PurchaseSupplier){
  this.suppliers.update(rows=>rows.some(x=>x.id===s.id)?rows:[s,...rows]);
  this.showSupplierCreation.set(false);this.setSupplier(s.id);
 }
 protected createdArticle(key:string,article:Article){
  this.lines.update(lines=>lines.map(l=>l.key===key?{
   ...l,articuloId:article.id,article,loteId:'',presentacionId:'',factorAUnidadBase:'1'
  }:l));
  this.articleCreationKey.set('');this.markDirty();
 }
 protected setSupplier(id:string){
  if(this.orderId())return;
  this.supplierId.set(id);this.presentations.set([]);
  this.lines.update(lines=>lines.map(l=>({...l,presentacionId:'',factorAUnidadBase:'1'})));
  this.markDirty();if(id)void this.loadPresentations(id);
 }
 private async loadPresentations(supplierId:string){
  try{
   const result=await firstValueFrom(this.api.presentations({sucursalId:this.branchId(),proveedorId:supplierId,limit:100}));
   if(supplierId===this.supplierId())
    this.presentations.set(result.data.filter(p=>p.activa&&(!p.proveedorId||p.proveedorId===supplierId)));
  }catch{/* Direct receiving in base units remains available. */}
 }
 protected presentationsFor(articleId:string){
  return this.presentations().filter(p=>p.articuloId===articleId).map(p=>({
   id:p.id,label:p.nombre+' · '+p.factorAUnidadBase+' en unidad base'
  }));
 }
 protected choosePresentation(key:string,id:string){
  const p=this.presentations().find(x=>x.id===id);
  this.lines.update(lines=>lines.map(l=>l.key===key?{
   ...l,presentacionId:id,factorAUnidadBase:p?.factorAUnidadBase??'1'
  }:l));this.markDirty();
 }
 protected setWarehouse(id:string){
  if(this.warehouseId()===id)return;
  this.warehouseId.set(id);
  this.lines.update(ls=>ls.map(l=>({...l,ubicacionId:''})));
  this.markDirty();
 }
 protected addLine(){this.lines.update(ls=>[...ls,blank()]);this.markDirty()}
 protected removeLine(key:string){
  if(this.lines().length<=1)return;
  this.lines.update(ls=>ls.filter(l=>l.key!==key));this.markDirty();
 }
 protected patch<K extends keyof ReceiptEditorLine>(key:string,property:K,value:ReceiptEditorLine[K]){
  this.lines.update(ls=>ls.map(l=>l.key===key?{...l,[property]:value}:l));
  this.markDirty();
 }
 protected async chooseArticle(key:string,id:string){
  this.lines.update(ls=>ls.map(l=>l.key===key?{
   ...l,articuloId:id,article:null,loteId:'',presentacionId:'',factorAUnidadBase:'1'
  }:l));this.markDirty();
  if(!id)return;
  try{
   const article=await firstValueFrom(this.inv.article(id));
   if(this.lines().some(l=>l.key===key&&l.articuloId===id))
    this.patch(key,'article',article);
  }catch(e){this.error.set(gcErrorMessage(e))}
 }
 protected async createLot(key:string){
  const line=this.lines().find(x=>x.key===key);
  if(!line||!line.articuloId||!line.newLotCode.trim()||line.lotBusy||!this.access.canLotManage())return;
  if(line.article?.requiereVencimiento&&!line.newExpiry){
   this.error.set('Indica la fecha de vencimiento de este lote.');return;
  }
  this.patch(key,'lotBusy',true);this.error.set('');
  try{
   const lot=await firstValueFrom(this.inv.createLot({articuloId:line.articuloId,
    codigoLote:line.newLotCode.trim(),...(line.newExpiry?{fechaVencimiento:line.newExpiry}:{})}));
   this.patch(key,'loteId',lot.id);this.patch(key,'newLotCode','');this.patch(key,'newExpiry','');
   this.notice.show('Lote creado.','success');
  }catch(e){this.error.set(gcErrorMessage(e));this.notice.show(gcErrorMessage(e),'error',0)}
  finally{this.patch(key,'lotBusy',false)}
 }
 private async loadEdit(id:string){
  const generation=++this.formGeneration;
  this.loading.set(true);this.error.set('');
  try{
   const data=await firstValueFrom(this.api.receipt(id));
   if(generation!==this.formGeneration)return;
   if(data.estado!=='BORRADOR'){
    await this.router.navigate(['/purchases/receipts',id]);return;
   }
   this.supplierId.set(data.proveedorId);
   this.warehouseId.set(data.almacenId);
   this.reference.set(data.referenciaProveedor??'');this.observations.set(data.observaciones??'');
   this.orderId.set(data.ordenCompraId??'');
   const rowsForTax=data.recepcionCompraLineasComoRecepcion??[];
   this.taxIncluded.set(Boolean(rowsForTax[0]?.precioIncluyeImpuesto));
   this.suppliers.update(s=>s.some(x=>x.id===data.proveedor.id)?s:[data.proveedor,...s]);
   const rows=data.recepcionCompraLineasComoRecepcion??[];
   const source=rows.map(l=>({...blank(),articuloId:l.articuloId,
    ubicacionId:l.ubicacionId,loteId:l.loteId??'',ordenCompraLineaId:l.ordenCompraLineaId??'',
    factorAUnidadBase:l.factorAUnidadBase,precioUnitarioCompra:l.precioUnitarioCompra,
    cantidadCompra:parseApiDecimal(l.cantidadCompra).plus(parseApiDecimal(l.cantidadRechazada??'0')).toFixed(),
    cantidadRechazada:l.cantidadRechazada??'0',tasaImpuesto:l.tasaImpuesto??'0',
    impuestoRecuperable:l.impuestoRecuperable??false
   }));this.lines.set(source.length?source:[blank()]);
   if(data.ordenCompraId)await this.loadPurchaseOrder(data.ordenCompraId,false);
   else await this.loadPresentations(data.proveedorId);
   await this.hydrateArticles();
   this.dirty=false;
  }catch(e){if(generation===this.formGeneration)this.error.set(gcErrorMessage(e))}
  finally{if(generation===this.formGeneration)this.loading.set(false)}
 }
 private async loadPurchaseOrder(id:string,replace=true){
  this.loading.set(true);this.error.set('');
  try{
   const order=await firstValueFrom(this.api.order(id));
   if(order.estado!=='CONFIRMADA')throw Error('La orden debe estar confirmada para recibir mercancía.');
   if(order.sucursalId!==this.branchId())throw Error('Orden de otra sucursal.');
   this.orderId.set(id);this.orderNumber.set(order.numero);
   this.supplierId.set(order.proveedorId);this.taxIncluded.set(Boolean((order as PurchaseOrder).precioIncluyeImpuesto));
   this.suppliers.update(x=>x.some(s=>s.id===order.proveedorId)?x:[order.proveedor,...x]);
   if(replace){
    this.lines.set((order.lineas??[]).filter(x=>decimal(x.pendiente??'0',true)!=='0').map(l=>({
     ...blank(),articuloId:l.articuloId,ordenCompraLineaId:l.id,
     article:null,cantidadCompra:l.pendiente??l.cantidadCompra,
     factorAUnidadBase:l.factorAUnidadBase,precioUnitarioCompra:l.precioUnitarioCompra,
     tasaImpuesto:l.tasaImpuesto??'0',impuestoRecuperable:l.impuestoRecuperable??false
    })));
    if(!this.lines().length)throw Error('La orden ya no tiene cantidades pendientes de recepción.');
    await this.hydrateArticles();
   }
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.loading.set(false)}
 }
 private async hydrateArticles(){
  const snapshot=this.lines();
  await Promise.all(snapshot.map(async l=>{
   try{
    const article=await firstValueFrom(this.inv.article(l.articuloId));
    if(this.lines().some(x=>x.key===l.key&&x.articuloId===l.articuloId))
     this.lines.update(ls=>ls.map(x=>x.key===l.key?{...x,article}:x));
   }catch{/* Preserve the selected article ID for server validation. */}
  }));
 }
 private payload():PurchaseReceiptInput {
  const entries:ReceiptLineInput[]=this.lines().map(l=>({
   articuloId:l.articuloId,ubicacionId:l.ubicacionId,
   ...(l.loteId?{loteId:l.loteId}:{}),
   ...(l.ordenCompraLineaId?{ordenCompraLineaId:l.ordenCompraLineaId}:{}),
   cantidadCompra:decimal(l.cantidadCompra)!,
   factorAUnidadBase:decimal(l.factorAUnidadBase)!,
   precioUnitarioCompra:decimal(l.precioUnitarioCompra,true)!,
   ...(decimal(l.cantidadRechazada||'0',true)!=='0'
     ?{cantidadRechazada:decimal(l.cantidadRechazada,true)!}:{}),
   ...(l.tasaImpuesto?{tasaImpuesto:decimal(l.tasaImpuesto,true)!}:{}),
   impuestoRecuperable:l.impuestoRecuperable
  }));
  return {
   proveedorId:this.supplierId(),almacenId:this.warehouseId(),
   ...(this.orderId()?{ordenCompraId:this.orderId()}:{}),
   referenciaProveedor:this.reference().trim(),observaciones:this.observations().trim(),
   precioIncluyeImpuesto:this.taxIncluded(),lineas:entries
  };
 }
 protected async save(postNow:boolean){
  if(this.busy()||!this.canSave()||!this.access.canReceiptsCreate()||
   (postNow&&!this.access.canReceiptsConfirm()))return;
  if(postNow&&!await this.dialog.confirm({title:'Registrar entrada de mercancía',
   message:'Se guardará la recepción y se sumarán al stock todas las cantidades aceptadas. Esta acción no se puede deshacer editando el documento.',
   confirmText:'Guardar e ingresar'}))return;
  const payload=this.payload();
  this.busy.set(true);this.error.set('');
  let savedId=this.editId;
  try{
   const result=this.editId
    ?await firstValueFrom(this.api.editReceipt(this.editId,payload))
    :await firstValueFrom(this.api.createReceipt(payload));
   savedId=result.id;this.dirty=false;
   if(postNow){
    try{
     await firstValueFrom(this.api.confirmReceipt(savedId,newKey()));
     this.notice.show('Mercancía ingresada en Inventario.','success');
    }catch(e){
     const msg='El borrador se guardó, pero no pudo confirmarse: '+gcErrorMessage(e);
     this.notice.show(msg,'error',0);
    }
   }else this.notice.show('Recepción guardada como borrador.','success');
   await this.router.navigate(['/purchases/receipts',savedId]);
  }catch(e){
   this.error.set(gcErrorMessage(e));
  }finally{this.busy.set(false)}
 }
 hasUnsavedChanges(){return this.dirty&&!this.busy()}
}
