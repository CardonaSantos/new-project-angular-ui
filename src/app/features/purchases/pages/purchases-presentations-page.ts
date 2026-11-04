import {Component,computed,effect,inject,signal,untracked} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {PurchasesApi} from '../data-access/purchases.api';
import {PurchasesAccess} from '../data-access/purchases-access';
import {decimal} from '../data-access/purchases.helpers';
import type {PurchasePresentation,PurchaseSupplier} from '../data-access/purchases.models';
import {GcPurchasesNav} from '../purchases-nav';
@Component({
 selector:'gc-purchases-presentations-page',
 imports:[GcPurchasesNav,GcInventoryPicker,GcSearchSelect],
 template:`<main class="pur-page"><gc-purchases-nav/>
  <header class="pur-heading"><h1>Presentaciones de compra</h1>
   @if(access.canPresentationsManage()){
    <button type="button" class="pur-primary" (click)="editing.update(v=>!v)">
     {{editing()?'Cerrar formulario':'Nueva presentación'}}
    </button>
   }
  </header>
  @if(editing()&&access.canPresentationsManage()){
   <section class="pur-card">
    <h2>Nueva presentación</h2>
    <div class="pur-grid">
     <gc-inventory-picker id="pur-pres-art" label="Artículo" kind="article"
      [value]="articleId()" (valueChange)="articleId.set($event)"/>
     <gc-search-select id="pur-pres-provider" label="Proveedor (opcional)" [items]="supplierChoices()"
      [value]="supplierId()" (valueChange)="supplierId.set($event)"
      placeholder="Cualquier proveedor"/>
     <div class="pur-field"><label for="pur-pres-name">Nombre de la presentación</label>
      <input id="pur-pres-name" [value]="name()" maxlength="120"
       (input)="name.set($any($event.target).value)" placeholder="Ej. Caja de 12 litros"/>
     </div>
     <gc-inventory-picker id="pur-pres-unit" label="Unidad de compra" kind="unit"
      [value]="unitId()" (valueChange)="unitId.set($event)"/>
     <div class="pur-field"><label for="pur-pres-factor">Unidades base por presentación</label>
      <input id="pur-pres-factor" inputmode="decimal" [value]="factor()"
       (input)="factor.set($any($event.target).value)" placeholder="Ej. 12"/>
     </div>
    </div>
    <p class="pur-note">La unidad de compra debe tener la misma dimensión que la unidad base del artículo.</p>
    @if(formError()){<p role="alert" class="pur-alert">{{formError()}}</p>}
    <div class="pur-actions">
     <button type="button" class="pur-primary" [disabled]="saving()||!articleId()||!unitId()||name().trim().length<2||!decimal(factor())"
      (click)="save()">Crear presentación</button>
     <button type="button" (click)="editing.set(false)">Cancelar</button>
    </div>
   </section>
  }
  <section class="pur-card">
   <div class="pur-heading"><h2>Presentaciones registradas</h2>
    <button type="button" [disabled]="busy()" (click)="load()">Actualizar</button>
   </div>
   <div class="pur-grid">
    <gc-search-select id="pur-pres-filter" label="Proveedor" [items]="supplierChoices()"
     [value]="filterSupplier()" (valueChange)="filterSupplier.set($event);page.set(1);load()"
     placeholder="Todos"/>
   </div>
   @if(error()){<p role="alert" class="pur-alert">{{error()}}</p>}
   @if(busy()){<p role="status" class="pur-muted">Consultando presentaciones…</p>}
   <div class="pur-table-scroll"><table class="pur-table">
    <thead><tr><th>Presentación</th><th>Artículo</th><th>Proveedor</th><th>Factor</th><th>Estado</th><th></th></tr></thead>
    <tbody>
     @for(p of rows();track p.id){
      <tr class="pur-data-row">
       <td data-label="Presentación"><strong>{{p.nombre}}</strong></td>
       <td data-label="Artículo">{{p.articulo?.nombre??p.articuloId}}</td>
       <td data-label="Proveedor">{{p.proveedor?.nombre??'General'}}</td>
       <td data-label="Factor">{{p.factorAUnidadBase}}</td>
       <td data-label="Estado"><span class="pur-badge">{{p.activa?'Activa':'Inactiva'}}</span></td>
       <td data-label="Acción">
        @if(access.canPresentationsManage()){
         <button type="button" [disabled]="saving()" (click)="toggle(p)">
          {{p.activa?'Desactivar':'Activar'}}
         </button>
        }
       </td>
      </tr>
     } @empty {@if(!busy()){<tr><td colspan="6" class="pur-empty">No hay presentaciones.</td></tr>}}
    </tbody>
   </table></div>
   <div class="pur-pagination">
    <span class="pur-muted">{{total()}} presentaciones · Página {{page()}} de {{pages()||1}}</span>
    <div class="pur-actions">
     <button type="button" [disabled]="page()<=1||busy()" (click)="change(-1)">Anterior</button>
     <button type="button" [disabled]="page()>=pages()||busy()" (click)="change(1)">Siguiente</button>
    </div>
   </div>
  </section>
 </main>`,
 styleUrl:'../purchases.scss'
})
export class GcPurchasesPresentationsPage {
 private readonly api=inject(PurchasesApi);
 private readonly context=inject(GcBranchContext);
 protected readonly access=inject(PurchasesAccess);
 private readonly notice=inject(GcNotificationService);
 private readonly confirm=inject(ConfirmDialogService);
 protected readonly rows=signal<PurchasePresentation[]>([]);
 protected readonly suppliers=signal<PurchaseSupplier[]>([]);
 protected readonly supplierChoices=computed(()=>this.suppliers().map(s=>({id:s.id,label:s.nombre})));
 protected readonly filterSupplier=signal('');
 protected readonly editing=signal(false);protected readonly articleId=signal('');
 protected readonly supplierId=signal('');protected readonly name=signal('');
 protected readonly unitId=signal('');protected readonly factor=signal('1');
 protected readonly page=signal(1);protected readonly pages=signal(0);protected readonly total=signal(0);
 protected readonly busy=signal(false);protected readonly saving=signal(false);
 protected readonly error=signal('');protected readonly formError=signal('');
 protected readonly decimal=decimal;
 private generation=0;
 constructor(){effect(()=>{
  const branch=this.context.branchId();
  untracked(()=>{this.page.set(1);this.filterSupplier.set('');if(branch){void this.loadSuppliers();void this.load()}});
 })}
 private async loadSuppliers(){
  try{
   const r=await firstValueFrom(this.api.suppliers({sucursalId:this.context.branchId()??undefined,limit:100}));
   this.suppliers.set(r.data.filter(x=>x.activo));
  }catch{this.suppliers.set([])}
 }
 protected change(d:number){
  const next=this.page()+d;if(next<1||next>this.pages()||this.busy())return;
  this.page.set(next);void this.load();
 }
 protected async load(){
  if(!this.access.canRead())return;
  const gen=++this.generation;this.busy.set(true);this.error.set('');
  try{
   const data=await firstValueFrom(this.api.presentations({sucursalId:this.context.branchId()??undefined,
    proveedorId:this.filterSupplier(),page:this.page(),limit:20}));
   if(gen===this.generation){this.rows.set(data.data);this.total.set(data.meta.total);this.pages.set(data.meta.totalPages)}
  }catch(e){if(gen===this.generation)this.error.set(gcErrorMessage(e))}
  finally{if(gen===this.generation)this.busy.set(false)}
 }
 protected async save(){
  if(this.saving()||!this.access.canPresentationsManage()||!this.articleId()||
   !this.unitId()||!decimal(this.factor()))return;
  this.saving.set(true);this.formError.set('');
  try{
   await firstValueFrom(this.api.createPresentation({
    articuloId:this.articleId(),...(this.supplierId()?{proveedorId:this.supplierId()}:{}),
    unidadCompraId:this.unitId(),nombre:this.name().trim(),factorAUnidadBase:decimal(this.factor())!
   }));
   this.notice.show('Presentación creada.','success');this.editing.set(false);
   this.articleId.set('');this.unitId.set('');this.factor.set('1');this.name.set('');await this.load();
  }catch(e){this.formError.set(gcErrorMessage(e))}
  finally{this.saving.set(false)}
 }
 protected async toggle(p:PurchasePresentation){
  if(this.saving()||!this.access.canPresentationsManage())return;
  if(!await this.confirm.confirm({title:p.activa?'Desactivar presentación':'Activar presentación',
   message:'Se actualizará la disponibilidad para futuras compras.',
   confirmText:p.activa?'Desactivar':'Activar'}))return;
  this.saving.set(true);this.error.set('');
  try{
   await firstValueFrom(this.api.presentationStatus(p.id,!p.activa));
   this.notice.show('Presentación actualizada.','success');await this.load();
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.saving.set(false)}
 }
}
