import {Component,computed,effect,inject,signal,untracked} from '@angular/core';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {InventoryApi} from '../../inventory/data-access/inventory.api';
import type {Article,InventoryKind} from '../../inventory/data-access/inventory.models';
import {ARTICLE_KINDS} from '../../inventory/data-access/inventory.models';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {PurchasesAccess} from '../data-access/purchases-access';
import {decimal,newKey} from '../data-access/purchases.helpers';
import {GcPurchasesNav} from '../purchases-nav';

@Component({
 selector:'gc-purchases-quick-page',
 imports:[RouterLink,GcPurchasesNav,GcInventoryPicker,GcSearchSelect],
 template:`
 <main class="pur-page"><gc-purchases-nav/>
  <header class="pur-heading">
   <div><h1>Entrada rápida de insumos</h1>
    <p class="pur-muted">Registra una entrada directa sin crear una orden de compra.</p></div>
   <a class="pur-button" routerLink="/purchases/receipts/new">Recepción de proveedor</a>
  </header>
  @if(!access.canQuickEntry()){
   <section class="pur-card" role="alert">Necesitas permisos de ajuste y costos para registrar entradas directas.</section>
  }@else{
   <section class="pur-card">
    <h2>1. Destino</h2>
    <div class="pur-grid">
     <div class="pur-field"><label>Sucursal</label>
      <strong>{{context.active()?.nombre??'Sin sucursal seleccionada'}}</strong>
     </div>
     <gc-inventory-picker id="pur-quick-warehouse" label="Almacén" kind="warehouse"
      [branchId]="branchId()" [value]="warehouseId()"
      (valueChange)="warehouseId.set($event);locationId.set('');changed()"/>
     <gc-inventory-picker id="pur-quick-location" label="Ubicación de ingreso" kind="location"
      [branchId]="branchId()" [warehouseId]="warehouseId()" [value]="locationId()"
      (valueChange)="locationId.set($event);changed()"/>
    </div>
    <p class="pur-muted">Elige la ubicación donde quedará disponible el ingrediente para Cocina.</p>
   </section>
   <section class="pur-card">
    <div class="pur-heading"><h2>2. Insumo</h2>
     @if(access.canArticleManage()){
      <button type="button" (click)="showArticleForm.update(v=>!v)">
       {{showArticleForm()?'Cerrar alta':'Crear artículo'}}
      </button>
     }
    </div>
    @if(showArticleForm()&&access.canArticleManage()){
     <fieldset class="pur-simple-fieldset">
      <legend>Nuevo artículo de inventario</legend>
      <div class="pur-grid">
       <div class="pur-field"><label for="pur-article-name">Nombre</label>
        <input id="pur-article-name" [value]="newName()" maxlength="160"
         (input)="newName.set($any($event.target).value)" placeholder="Ej. Leche entera"/>
       </div>
       <div class="pur-field"><label for="pur-article-code">Código</label>
        <input id="pur-article-code" [value]="newCode()" maxlength="50"
         (input)="newCode.set($any($event.target).value)" placeholder="Ej. LECHE-001"/>
       </div>
       <gc-search-select id="pur-article-kind" label="Tipo de artículo" [items]="articleKinds"
        [value]="newKind()" [clearable]="false" [searchable]="false"
        (valueChange)="newKind.set($any($event))"/>
       <gc-inventory-picker id="pur-article-unit" kind="unit" label="Unidad base"
        [value]="newUnitId()" (valueChange)="newUnitId.set($event)"/>
      </div>
      <div class="pur-inline">
       <label><input type="checkbox" [checked]="newRequiresLot()"
        (change)="newRequiresLot.set($any($event.target).checked)"/> Controlar por lote</label>
       <label><input type="checkbox" [checked]="newRequiresExpiry()"
        (change)="newRequiresExpiry.set($any($event.target).checked);newRequiresLot.set(newRequiresExpiry()||newRequiresLot())"/>
        Requiere vencimiento</label>
      </div>
      @if(articleError()){<p role="alert" class="pur-alert">{{articleError()}}</p>}
      <div class="pur-actions">
       <button type="button" class="pur-primary" [disabled]="articleBusy()||!newName().trim()||!newUnitId()"
        (click)="createArticle()">Crear y seleccionar</button>
       <button type="button" (click)="showArticleForm.set(false)" [disabled]="articleBusy()">Cancelar</button>
      </div>
     </fieldset>
     <div class="pur-divider"></div>
    }
    <gc-inventory-picker id="pur-quick-article" label="Artículo" kind="article"
     [value]="articleId()" (valueChange)="chooseArticle($event)"/>
    @if(articleBusy()){<p role="status" class="pur-muted">Consultando artículo…</p>}
    @if(article();as selected){
     <p class="pur-muted">Unidad base: {{selected.unidadBase.nombre}} ({{selected.unidadBase.codigo}})</p>
     @if(selected.requiereLote){
      <div class="pur-grid">
       <gc-inventory-picker id="pur-quick-lot" kind="lot" label="Lote"
        [branchId]="branchId()" [articleId]="articleId()" [value]="lotId()"
        (valueChange)="lotId.set($event);changed()"/>
       <div class="pur-field">
        <label for="pur-quick-lotcode">Nuevo lote</label>
        <input id="pur-quick-lotcode" [value]="newLotCode()" maxlength="100"
         (input)="newLotCode.set($any($event.target).value)"
         placeholder="Código del lote"/>
       </div>
       @if(selected.requiereVencimiento){
        <div class="pur-field"><label for="pur-quick-expiry">Vencimiento</label>
         <input id="pur-quick-expiry" type="date" [value]="newExpiry()"
          (input)="newExpiry.set($any($event.target).value)"/>
        </div>
       }
       <div class="pur-actions">
        <button type="button" [disabled]="lotBusy()||!newLotCode().trim()||!access.canLotManage()"
         (click)="createLot()">Crear lote</button>
       </div>
      </div>
     }
    }
   </section>
   <section class="pur-card">
    <h2>3. Cantidad y costo</h2>
    <div class="pur-grid">
     <div class="pur-field"><label for="pur-quick-qty">Cantidad en unidad base</label>
      <input id="pur-quick-qty" inputmode="decimal" [value]="quantity()"
       (input)="quantity.set($any($event.target).value);changed()"
       placeholder="Ej. 12" autocomplete="off"/>
     </div>
     <div class="pur-field"><label for="pur-quick-cost">Costo por unidad base (Q)</label>
      <input id="pur-quick-cost" inputmode="decimal" [value]="cost()"
       (input)="cost.set($any($event.target).value);changed()"
       placeholder="Ej. 8.50" autocomplete="off"/>
     </div>
    </div>
    <div class="pur-field"><label for="pur-quick-reason">Motivo o referencia</label>
     <input id="pur-quick-reason" [value]="reason()" maxlength="500"
      (input)="reason.set($any($event.target).value);changed()"
      placeholder="Ej. Compra de insumos para la cafetería"/>
    </div>
    @if(error()){<p role="alert" class="pur-alert">{{error()}}</p>}
    <div class="pur-actions">
     <button class="pur-primary" type="button" [disabled]="busy()||!ready()" (click)="submit()">
      {{busy()?'Registrando…':'Registrar entrada ahora'}}
     </button>
     <a routerLink="/inventory/operations/movements">Ver movimientos</a>
    </div>
   </section>
  }
 </main>`,
 styleUrl:'../purchases.scss'
})
export class GcPurchasesQuickPage {
 protected readonly context=inject(GcBranchContext);
 protected readonly access=inject(PurchasesAccess);
 private readonly inv=inject(InventoryApi);
 private readonly notices=inject(GcNotificationService);
 private readonly confirm=inject(ConfirmDialogService);
 protected readonly branchId=computed(()=>this.context.branchId()??'');
 protected readonly warehouseId=signal('');
 protected readonly locationId=signal('');
 protected readonly articleId=signal('');
 protected readonly article=signal<Article|null>(null);
 protected readonly lotId=signal('');
 protected readonly quantity=signal('');
 protected readonly cost=signal('');
 protected readonly reason=signal('');
 protected readonly busy=signal(false);
 protected readonly error=signal('');
 protected readonly showArticleForm=signal(false);
 protected readonly articleBusy=signal(false);
 protected readonly articleError=signal('');
 protected readonly newName=signal('');
 protected readonly newCode=signal('');
 protected readonly newKind=signal<InventoryKind>('INGREDIENTE');
 protected readonly newUnitId=signal('');
 protected readonly newRequiresLot=signal(false);
 protected readonly newRequiresExpiry=signal(false);
 protected readonly articleKinds=ARTICLE_KINDS.map(x=>({id:x.value,label:x.label}));
 protected readonly lotBusy=signal(false);
 protected readonly newLotCode=signal('');
 protected readonly newExpiry=signal('');
 private generation=0;private requestKey=newKey();private dirty=false;
 protected readonly ready=computed(()=>
  !!this.branchId()&&!!this.locationId()&&!!this.articleId()&&
  this.article()?.activo===true&&!this.articleBusy()&&
  (!this.article()?.requiereLote||!!this.lotId())&&
  decimal(this.quantity())!==null&&decimal(this.cost(),true)!==null&&this.reason().trim().length>=5
 );
 constructor(){
  effect(()=>{
   this.branchId();untracked(()=>{
    this.warehouseId.set('');this.locationId.set('');
    this.articleId.set('');this.article.set(null);this.lotId.set('');
    this.changed(false);
   });
  });
 }
 protected changed(mark=true){this.requestKey=newKey();if(mark)this.dirty=true}
 protected async chooseArticle(id:string){
  this.articleId.set(id);this.article.set(null);this.lotId.set('');
  this.changed();
  const generation=++this.generation;
  if(!id)return;
  this.articleBusy.set(true);
  try{
   const article=await firstValueFrom(this.inv.article(id));
   if(generation===this.generation&&this.articleId()===id)this.article.set(article);
  }catch(e){if(generation===this.generation)this.error.set(gcErrorMessage(e))}
  finally{if(generation===this.generation)this.articleBusy.set(false)}
 }
 protected async createArticle(){
  if(this.articleBusy()||!this.access.canArticleManage())return;
  const code=this.newCode().trim();
  if(!/^[A-Za-z][A-Za-z0-9_-]{1,49}$/.test(code)){
   this.articleError.set('Código válido: 2 a 50 caracteres, comenzando por letra.');return;
  }
  if(!this.newName().trim()||!this.newUnitId())return;
  this.articleBusy.set(true);this.articleError.set('');
  try{
   const item=await firstValueFrom(this.inv.createArticle({
    codigo:code,nombre:this.newName().trim(),tipo:this.newKind(),unidadBaseId:this.newUnitId(),
    requiereLote:this.newRequiresLot()||this.newRequiresExpiry(),
    requiereVencimiento:this.newRequiresExpiry()
   }));
   this.generation++;this.articleId.set(item.id);this.article.set(item);this.lotId.set('');
   this.showArticleForm.set(false);this.changed();
   this.notices.show('Artículo creado y seleccionado.','success');
  }catch(e){
   this.articleError.set(gcErrorMessage(e));
   this.notices.show(gcErrorMessage(e),'error',0);
  }finally{this.articleBusy.set(false)}
 }
 protected async createLot(){
  if(this.lotBusy()||!this.articleId()||!this.newLotCode().trim()||!this.access.canLotManage())return;
  if(this.article()?.requiereVencimiento&&!this.newExpiry()){
   this.error.set('Este artículo necesita fecha de vencimiento.');return;
  }
  this.lotBusy.set(true);this.error.set('');
  try{
   const lot=await firstValueFrom(this.inv.createLot({
    articuloId:this.articleId(),codigoLote:this.newLotCode().trim(),
    ...(this.newExpiry()?{fechaVencimiento:this.newExpiry()}:{})
   }));
   this.lotId.set(lot.id);this.newLotCode.set('');this.newExpiry.set('');
   this.changed();this.notices.show('Lote creado.','success');
  }catch(e){this.error.set(gcErrorMessage(e));this.notices.show(gcErrorMessage(e),'error',0)}
  finally{this.lotBusy.set(false)}
 }
 protected async submit(){
  if(!this.ready()||this.busy()||!this.access.canQuickEntry())return;
  const amount=decimal(this.quantity()),unit=decimal(this.cost(),true);
  if(!amount||unit===null)return;
  const accepted=await this.confirm.confirm({
   title:'Registrar entrada de inventario',
   message:'Se sumarán '+amount+' unidades base al inventario. Este movimiento no se podrá editar después.',
   confirmText:'Registrar entrada'
  });
  if(!accepted)return;
  this.busy.set(true);this.error.set('');
  try{
   await firstValueFrom(this.inv.manual('inbound',{
    articuloId:this.articleId(),ubicacionId:this.locationId(),
    ...(this.lotId()?{loteId:this.lotId()}:{}),
    cantidad:amount,costoUnitario:unit,claveOperacion:this.requestKey,
    motivo:this.reason().trim()
   }));
   this.notices.show('Entrada registrada en Inventario.','success');
   this.quantity.set('');this.cost.set('');this.reason.set('');
   this.changed(false);this.dirty=false;
  }catch(e){
   this.error.set(gcErrorMessage(e));this.notices.show(gcErrorMessage(e),'error',0);
  }finally{this.busy.set(false)}
 }
 hasUnsavedChanges(){return this.dirty&&!this.busy()}
}
