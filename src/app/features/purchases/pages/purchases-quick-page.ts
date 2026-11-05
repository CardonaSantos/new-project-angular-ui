import {Component,computed,effect,inject,signal,untracked} from '@angular/core';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {InventoryApi} from '../../inventory/data-access/inventory.api';
import type {Article} from '../../inventory/data-access/inventory.models';
import {parseApiDecimal,formatCurrency} from '../../../shared/formatting';
import {GcPurchasesCreateArticle} from '../components/purchases-create-article';
import {PurchasesAccess} from '../data-access/purchases-access';
import {decimal,newKey} from '../data-access/purchases.helpers';
import {GcPurchasesNav} from '../purchases-nav';

interface InboundLine {
 key:string;articuloId:string;article:Article|null;cantidad:string;costoUnitario:string;
 loteId:string;newLotCode:string;newExpiry:string;loading:boolean;lotBusy:boolean;error:string;
}
const emptyLine=():InboundLine=>({
 key:newKey(),articuloId:'',article:null,cantidad:'',costoUnitario:'',
 loteId:'',newLotCode:'',newExpiry:'',loading:false,lotBusy:false,error:''
});
const maxLines=25;
@Component({
 selector:'gc-purchases-quick-page',
 imports:[RouterLink,GcPurchasesNav,GcInventoryPicker,GcPurchasesCreateArticle],
 template:`
 <main class="pur-page pur-quick-page"><gc-purchases-nav/>
  <header class="pur-heading">
   <div><h1>Entrada rápida de insumos</h1>
    <p class="pur-muted">Añade los artículos recibidos y registra todas las existencias juntas.</p></div>
   <a class="pur-button" routerLink="/purchases/receipts/new">Recepción de proveedor</a>
  </header>
  @if(!access.canQuickEntry()){
   <section class="pur-card" role="alert">Necesitas permisos de ajuste y costos para registrar entradas directas.</section>
  }@else{
   <section class="pur-card">
    <h2>1. Destino</h2>
    <div class="pur-grid pur-quick-destination">
     <div class="pur-field"><span class="pur-static-label">Sucursal</span>
      <strong>{{context.active()?.nombre??'Sin sucursal seleccionada'}}</strong>
     </div>
     <gc-inventory-picker id="pur-quick-warehouse" label="Almacén" kind="warehouse"
      [branchId]="branchId()" [disabled]="busy()" [value]="warehouseId()"
      (valueChange)="chooseWarehouse($event)"/>
     <gc-inventory-picker id="pur-quick-location" label="Ubicación de ingreso" kind="location"
      [branchId]="branchId()" [warehouseId]="warehouseId()" [disabled]="busy()"
      [value]="locationId()" (valueChange)="chooseLocation($event)"/>
    </div>
   </section>

   <section class="pur-card">
    <div class="pur-heading">
     <div><h2>2. Artículos para ingresar</h2>
      <p class="pur-muted">{{lines().length}} de {{maxLines}} artículos</p></div>
     <button type="button" [disabled]="busy()||lines().length>=maxLines" (click)="addLine()">
      Agregar artículo
     </button>
    </div>
    <div class="pur-lines" aria-label="Lista de insumos para ingreso">
     @for(line of lines();track line.key;let i=$index){
      <fieldset class="pur-line pur-quick-line">
       <legend class="pur-sr-only">Artículo {{i+1}}</legend>
       <div class="pur-line-header">
        <strong>Artículo {{i+1}}</strong>
        @if(lines().length>1){
         <button type="button" [disabled]="busy()" (click)="removeLine(line.key)"
          [attr.aria-label]="'Quitar artículo '+(i+1)">Quitar</button>
        }
       </div>
       @if(articleCreator()===line.key&&access.canArticleManage()){
        <gc-purchases-create-article (created)="articleCreated(line.key,$event)"
         (dismiss)="articleCreator.set('')"/>
       }@else{
        <div class="pur-quick-article">
         <gc-inventory-picker [id]="'pur-quick-article-'+line.key"
          kind="article" label="Insumo" [disabled]="busy()"
          [value]="line.articuloId" [selectedLabel]="articleLabel(line)"
          (valueChange)="chooseArticle(line.key,$event)"/>
         @if(access.canArticleManage()){
          <button type="button" [disabled]="busy()" (click)="articleCreator.set(line.key)">
           Crear nuevo
          </button>
         }
        </div>
       }
       @if(line.loading){<p class="pur-muted" role="status">Consultando artículo…</p>}
       @if(line.article;as item){
        <p class="pur-muted">Unidad: {{item.unidadBase.nombre}} ({{item.unidadBase.codigo}})</p>
       }
       <div class="pur-grid">
        <div class="pur-field">
         <label [for]="'pur-quick-qty-'+line.key">Cantidad en unidad base</label>
         <input [id]="'pur-quick-qty-'+line.key" inputmode="decimal"
          [value]="line.cantidad" [disabled]="busy()" autocomplete="off"
          (input)="patch(line.key,'cantidad',$any($event.target).value)"
          placeholder="Ej. 12"/>
        </div>
        <div class="pur-field">
         <label [for]="'pur-quick-cost-'+line.key">Costo por unidad (Q)</label>
         <input [id]="'pur-quick-cost-'+line.key" inputmode="decimal"
          [value]="line.costoUnitario" [disabled]="busy()" autocomplete="off"
          (input)="patch(line.key,'costoUnitario',$any($event.target).value)"
          placeholder="Ej. 8.50"/>
        </div>
       </div>
       @if(line.article?.requiereLote){
        <div class="pur-quick-lot">
         <gc-inventory-picker [id]="'pur-quick-lot-'+line.key" kind="lot"
          label="Lote" [branchId]="branchId()" [articleId]="line.articuloId"
          [disabled]="busy()" [value]="line.loteId"
          (valueChange)="patch(line.key,'loteId',$event)"/>
         @if(access.canLotManage()){
          <details>
           <summary>Crear lote nuevo</summary>
           <div class="pur-grid">
            <div class="pur-field">
             <label [for]="'pur-quick-code-'+line.key">Código del lote</label>
             <input [id]="'pur-quick-code-'+line.key" [value]="line.newLotCode"
              [disabled]="busy()" maxlength="100"
              (input)="patch(line.key,'newLotCode',$any($event.target).value)"/>
            </div>
            @if(line.article?.requiereVencimiento){
             <div class="pur-field">
              <label [for]="'pur-quick-expiry-'+line.key">Vencimiento</label>
              <input [id]="'pur-quick-expiry-'+line.key" type="date"
               [value]="line.newExpiry" [disabled]="busy()"
               (input)="patch(line.key,'newExpiry',$any($event.target).value)"/>
             </div>
            }
           </div>
           <button type="button" (click)="createLot(line.key)"
            [disabled]="busy()||line.lotBusy||!line.newLotCode.trim()">
            {{line.lotBusy?'Creando…':'Crear y seleccionar lote'}}
           </button>
          </details>
         }
        </div>
       }
       @if(line.error){<p role="alert" class="pur-error">{{line.error}}</p>}
       @if(line.cantidad&&line.costoUnitario&&validLine(line)){
        <p class="pur-quick-subtotal">Importe: <strong>{{lineTotal(line)}}</strong></p>
       }
      </fieldset>
     }
    </div>
    <div class="pur-actions">
     <button type="button" [disabled]="busy()||lines().length>=maxLines" (click)="addLine()">
      Agregar otro insumo
     </button>
    </div>
   </section>

   <section class="pur-card">
    <h2>3. Registrar entrada</h2>
    <div class="pur-field">
     <label for="pur-quick-reason">Referencia o motivo</label>
     <input id="pur-quick-reason" [value]="reason()" [disabled]="busy()"
      maxlength="500" (input)="setReason($any($event.target).value)"
      placeholder="Ej. Compra de insumos para la cafetería"/>
    </div>
    <div class="pur-quick-checkout">
     <div>
      <strong>{{lines().length}} {{lines().length===1?'artículo':'artículos'}}</strong>
      <p class="pur-muted">Total estimado: {{estimate()}}</p>
     </div>
     <button type="button" class="pur-primary"
      [disabled]="busy()||!ready()" (click)="submit()">
      {{busy()?'Registrando…':'Registrar entrada completa'}}
     </button>
    </div>
    @if(error()){<p role="alert" class="pur-alert">{{error()}}</p>}
    <div class="pur-actions">
     <a class="pur-link" routerLink="/inventory/operations/movements">Ver movimientos de inventario</a>
    </div>
   </section>
  }
 </main>`,
 styleUrl:'../purchases.scss'
})
export class GcPurchasesQuickPage {
 protected readonly context=inject(GcBranchContext);
 protected readonly access=inject(PurchasesAccess);
 private readonly inventory=inject(InventoryApi);
 private readonly notices=inject(GcNotificationService);
 private readonly confirm=inject(ConfirmDialogService);
 protected readonly maxLines=maxLines;
 protected readonly branchId=computed(()=>this.context.branchId()??'');
 protected readonly warehouseId=signal('');
 protected readonly locationId=signal('');
 protected readonly lines=signal<InboundLine[]>([emptyLine()]);
 protected readonly articleCreator=signal('');
 protected readonly reason=signal('');
 protected readonly busy=signal(false);
 protected readonly error=signal('');
 private generation=0;
 private requestKey=newKey();
 private dirty=false;

 protected readonly ready=computed(()=>{
  const list=this.lines();
  if(!this.branchId()||!this.warehouseId()||!this.locationId()||
   this.busy()||this.reason().trim().length<3||!list.length||list.length>maxLines)return false;
  if(list.some(l=>!this.validLine(l)))return false;
  // Separate lots are valid, but the same article+lot cannot accidentally appear twice.
  const unique=new Set(list.map(l=>l.articuloId+':'+(l.loteId||'')));
  return unique.size===list.length;
 });
 protected readonly estimate=computed(()=>{
  let total=parseApiDecimal('0');
  for(const line of this.lines()){
   const quantity=decimal(line.cantidad);
   const cost=decimal(line.costoUnitario,true);
   if(quantity&&cost!==null)
    total=total.plus(parseApiDecimal(quantity).mul(parseApiDecimal(cost)));
  }
  return formatCurrency(total.toFixed());
 });

 constructor(){
  effect(()=>{
   this.branchId();
   untracked(()=>{
    this.generation++;
    this.warehouseId.set('');this.locationId.set('');
    this.lines.set([emptyLine()]);this.reason.set('');
    this.articleCreator.set('');this.error.set('');
    this.requestKey=newKey();this.dirty=false;
   });
  });
 }
 protected validLine(line:InboundLine):boolean {
  const cost=decimal(line.costoUnitario,true);
  return Boolean(line.articuloId&&line.article?.activo&&!line.loading&&
   decimal(line.cantidad)!==null&&cost!==null&&
   (!line.article?.requiereLote||line.loteId));
 }
 protected articleLabel(line:InboundLine){
  return line.article?line.article.codigo+' · '+line.article.nombre:'';
 }
 protected lineTotal(line:InboundLine){
  const q=decimal(line.cantidad),p=decimal(line.costoUnitario,true);
  return q&&p!==null
   ?formatCurrency(parseApiDecimal(q).mul(parseApiDecimal(p)).toFixed()):'—';
 }
 private touch(){this.requestKey=newKey();this.dirty=true;this.error.set('')}
 protected chooseWarehouse(id:string){
  if(this.busy()||id===this.warehouseId())return;
  this.warehouseId.set(id);this.locationId.set('');this.touch();
 }
 protected chooseLocation(id:string){
  if(this.busy()||id===this.locationId())return;
  this.locationId.set(id);this.touch();
 }
 protected setReason(value:string){
  if(this.busy())return;
  this.reason.set(value);this.touch();
 }
 protected addLine(){
  if(this.busy()||this.lines().length>=maxLines)return;
  this.lines.update(list=>[...list,emptyLine()]);this.touch();
 }
 protected removeLine(key:string){
  if(this.busy()||this.lines().length<=1)return;
  this.lines.update(list=>list.filter(line=>line.key!==key));
  if(this.articleCreator()===key)this.articleCreator.set('');
  this.touch();
 }
 protected patch<K extends keyof InboundLine>(key:string,field:K,value:InboundLine[K]){
  if(this.busy())return;
  this.lines.update(list=>list.map(line=>line.key===key?{...line,[field]:value}:line));
  this.touch();
 }
 protected async chooseArticle(key:string,id:string){
  if(this.busy())return;
  const generation=++this.generation;
  this.lines.update(list=>list.map(l=>l.key===key
   ?{...l,articuloId:id,article:null,loteId:'',loading:!!id,error:''}:l));
  this.touch();
  if(!id)return;
  try{
   const article=await firstValueFrom(this.inventory.article(id));
   if(generation<=this.generation)
    this.lines.update(list=>list.map(l=>l.key===key&&l.articuloId===id
     ?{...l,article,error:''}:l));
  }catch(e){
   this.lines.update(list=>list.map(l=>l.key===key&&l.articuloId===id
    ?{...l,error:gcErrorMessage(e)}:l));
  }finally{
   this.lines.update(list=>list.map(l=>l.key===key&&l.articuloId===id
    ?{...l,loading:false}:l));
  }
 }
 protected articleCreated(key:string,article:Article){
  if(this.busy())return;
  this.lines.update(list=>list.map(l=>l.key===key
   ?{...l,articuloId:article.id,article,loteId:'',loading:false,error:''}:l));
  this.articleCreator.set('');this.touch();
 }
 protected async createLot(key:string){
  const line=this.lines().find(l=>l.key===key);
  if(!line||this.busy()||line.lotBusy||!line.article?.requiereLote||
   !this.access.canLotManage()||!line.newLotCode.trim())return;
  if(line.article.requiereVencimiento&&!line.newExpiry){
   this.lines.update(ls=>ls.map(l=>l.key===key
    ?{...l,error:'Indica el vencimiento del lote.'}:l));return;
  }
  this.lines.update(ls=>ls.map(l=>l.key===key?{...l,lotBusy:true,error:''}:l));
  try{
   const lot=await firstValueFrom(this.inventory.createLot({
    articuloId:line.articuloId,codigoLote:line.newLotCode.trim(),
    ...(line.newExpiry?{fechaVencimiento:line.newExpiry}:{})
   }));
   this.lines.update(ls=>ls.map(l=>l.key===key&&l.articuloId===line.articuloId
    ?{...l,loteId:lot.id,newLotCode:'',newExpiry:''}:l));
   this.notices.show('Lote creado y seleccionado.','success');this.touch();
  }catch(e){
   this.lines.update(ls=>ls.map(l=>l.key===key?{...l,error:gcErrorMessage(e)}:l));
  }finally{
   this.lines.update(ls=>ls.map(l=>l.key===key?{...l,lotBusy:false}:l));
  }
 }
 protected async submit(){
  if(!this.ready()||this.busy()||!this.access.canQuickEntry())return;
  const list=this.lines(),branch=this.branchId(),location=this.locationId();
  const payload={
   claveOperacion:this.requestKey,
   motivo:this.reason().trim(),
   lineas:list.map(line=>({
    articuloId:line.articuloId,ubicacionId:location,
    ...(line.loteId?{loteId:line.loteId}:{}),
    cantidad:decimal(line.cantidad)!,costoUnitario:decimal(line.costoUnitario,true)!
   }))
  };
  if(!await this.confirm.confirm({
   title:'Registrar '+list.length+' '+(list.length===1?'insumo':'insumos'),
   message:'Se ingresará toda la lista en una sola operación. Si alguna línea falla, no se registrará ningún movimiento.',
   confirmText:'Registrar entrada'
  }))return;
  this.busy.set(true);this.error.set('');
  try{
   const posted=await firstValueFrom(this.inventory.inboundBatch(payload));
   if(branch!==this.branchId())return;
   this.notices.show(posted.numeroLineas+' artículos ingresados en Inventario.','success');
   this.lines.set([emptyLine()]);this.reason.set('');this.articleCreator.set('');
   this.requestKey=newKey();this.dirty=false;
  }catch(e){
   this.error.set(gcErrorMessage(e));
   // Keep the same key and all unsaved rows for safe retry.
  }finally{this.busy.set(false)}
 }
 hasUnsavedChanges(){return this.dirty&&!this.busy()}
}
