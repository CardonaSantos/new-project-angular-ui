import {Component,computed,inject,signal,OnInit} from '@angular/core';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {GcCatalogGallery} from '../components/catalog-gallery';
import {GcCatalogNav} from '../catalog-nav';
import {CatalogApi} from '../data-access/catalog.api';
import {CatalogAccess} from '../data-access/catalog-access';
import type {CatalogProduct,CatalogCategory,CatalogVariant,CatalogGroup,CatalogGroupAttachment,CatalogProductReadiness} from '../data-access/catalog.models';
import {PRODUCT_KINDS} from '../data-access/catalog.models';
import {keepSelected,readableCategory} from '../data-access/catalog-selection';
import {catalogProductRoute} from '../data-access/catalog-product-route';
import type {GcDirtyAware} from '../../../core/ux/gc-unsaved-changes.guard';

@Component({
 selector:'gc-catalog-product-detail-page',
 imports:[RouterLink,GcCatalogNav,GcErrorState,GcInventoryPicker,GcCatalogGallery],
 template:`
 <main class="cat-page">
  <gc-catalog-nav/>
  <a routerLink="/catalog/products">Volver a productos</a>
  @if(page.busy()){<p role="status" class="cat-muted">Consultando detalles del producto…</p>}
  @if(page.status()==='error'){<gc-error-state [message]="error()" (retry)="reload()"/>}
  @if(isNew||page.data()){
   <section class="cat-card">
    <h2>{{isNew?'Nuevo producto':'Datos comerciales'}}</h2>
    <form class="cat-form" (submit)="save($event)">
     <label>Código
      <input [value]="code()" (input)="code.set($any($event.target).value)" [disabled]="!isNew||!access.canManage()"
       required pattern="[A-Za-z][A-Za-z0-9_-]*" maxlength="50" placeholder="CAFE-LATTE"/>
     </label>
     <label>Nombre comercial
      <input [value]="name()" (input)="name.set($any($event.target).value)" maxlength="160"
       [disabled]="!access.canManage()" required/>
     </label>
     <label>Tipo de producto
      <select [value]="kind()" (change)="kind.set($any($event.target).value)" [disabled]="!isNew||!access.canManage()">
       @for(k of kinds;track k.value){<option [value]="k.value">{{k.label}}</option>}
      </select>
     </label>
     <div class="cat-category-picker">
      <label for="catalog-category">Categoría</label>
      <div class="cat-search-inline">
       <input id="catalog-category-search" aria-label="Buscar por nombre de categoría"
        placeholder="Buscar categoría" [value]="categorySearch()" maxlength="120"
        (input)="categorySearch.set($any($event.target).value)"
        (keydown.enter)="$event.preventDefault();searchCategories()"/>
       <button type="button" (click)="searchCategories()">Buscar</button>
      </div>
      <select id="catalog-category" [value]="category()" (change)="category.set($any($event.target).value)"
       [disabled]="!access.canManage()" aria-label="Categoría asignada al producto">
       <option value="" [selected]="!category()">Sin categoría</option>
       @for(c of categories();track c.id){<option [value]="c.id" [selected]="c.id===category()">{{c.nombre}}{{c.activa?'':' (inactiva)'}}</option>}
      </select>
     </div>
     <label class="cat-wide">Descripción para el menú
      <textarea [value]="description()" (input)="description.set($any($event.target).value)" rows="3"
       maxlength="1500" [disabled]="!access.canManage()"></textarea>
     </label>
     @if(!isNew){
      <label class="cat-check"><input type="checkbox" [checked]="visible()" (change)="visible.set($any($event.target).checked)"
       [disabled]="!access.canManage()"/> Mostrar en menú comercial</label>
     }
     @if(saveError()){<p class="cat-alert" role="alert">{{saveError()}}</p>}
     <div class="cat-actions">
      @if(access.canManage()){<button class="cat-primary" type="submit"
       [disabled]="busy()||!name().trim()||(isNew&&!validCode())">{{busy()?'Guardando…':'Guardar producto'}}</button>}
     </div>
    </form>
    <p class="cat-muted">El código y el tipo no se modifican después de crear el producto. Las existencias físicas se administran en Inventario.</p>
   </section>
   @if(page.data();as product){
    <gc-catalog-gallery [entityId]="product.id" kind="product" [photos]="product.imagenes??[]"
     [editable]="access.canManage()" (updated)="reload()"/>
    <section class="cat-card">
     <div class="cat-row"><h2>Presentaciones y tamaños</h2>
      <span class="cat-muted">{{variants().length}} presentaciones</span></div>
     <p class="cat-muted">Agrega opciones como pequeño, mediano o grande. Cada una puede tener su propio precio y extras.</p>
     <div class="cat-table-wrap"><table class="cat-table"><thead><tr>
      <th>Presentación</th><th>Artículo de inventario</th><th>Estado</th><th>Acción</th>
     </tr></thead><tbody>
      @for(v of variants();track v.id){
       <tr><td>{{v.nombre}} @if(v.sku){<span class="cat-muted">· {{v.sku}}</span>}</td>
       <td>{{product.tipo==='INVENTARIABLE'?(v.articuloInventario?.nombre??'Sin artículo asociado'):'No corresponde'}}</td>
       <td>{{v.activo?'Activa':'Inactiva'}}</td>
       <td><button type="button" (click)="chooseVariant(v)">Configurar</button></td></tr>
      } @empty {<tr><td colspan="4">Todavía no hay presentaciones.</td></tr>}
     </tbody></table></div>
     @if(access.canManage()){<button type="button" (click)="newVariant()">Agregar presentación</button>}
    </section>
    @if(editVariant()||creatingVariant()){
     <section class="cat-card">
      <h2>{{creatingVariant()?'Nueva presentación':'Editar presentación'}}</h2>
      <form class="cat-form" (submit)="saveVariant($event)">
       <label>Nombre
        <input [value]="variantName()" (input)="variantName.set($any($event.target).value)"
         [disabled]="!access.canManage()" maxlength="120" required/>
       </label>
       <label>Código de presentación (opcional)
        <input [value]="variantSku()" (input)="variantSku.set($any($event.target).value)"
         [disabled]="!access.canManage()" maxlength="50"/>
       </label>
       <label>Orden de presentación
        <input type="number" min="0" step="1" [value]="variantOrder()" (input)="variantOrder.set(+$any($event.target).value)"
         [disabled]="!access.canManage()"/>
       </label>
       @if(product.tipo==='INVENTARIABLE'){
        @if(editVariant()?.articuloInventario?.nombre){<p class="cat-muted">Artículo asociado: {{editVariant()?.articuloInventario?.nombre}}</p>}
        <gc-inventory-picker id="catalog-linked-article" label="Artículo físico de Inventario"
         kind="article" [value]="articleId()"
         [selectedLabel]="editVariant()?.articuloInventario?.nombre??''"
         (valueChange)="articleId.set($event)"
         [disabled]="!access.canManage()"/>
       }
       @if(editVariant()){
        <label class="cat-check"><input type="checkbox" [checked]="variantActive()"
         (change)="variantActive.set($any($event.target).checked)" [disabled]="!access.canManage()"/> Presentación activa</label>
       }
       @if(variantError()){<p role="alert" class="cat-alert">{{variantError()}}</p>}
       <div class="cat-actions">
        @if(access.canManage()){<button class="cat-primary" [disabled]="busy()||!variantName().trim()" type="submit">
         {{busy()?'Guardando…':'Guardar presentación'}}</button>}
        <button type="button" (click)="cancelVariant()">Cerrar</button>
       </div>
      </form>
      @if(editVariant();as v){
       <hr/>
       <h2>Extras disponibles para {{v.nombre}}</h2>
       <div class="cat-toolbar">
        <label class="cat-field">Buscar grupos de extras
         <input [value]="groupSearch()" maxlength="120"
          (input)="groupSearch.set($any($event.target).value)" (keyup.enter)="searchGroups()"/>
        </label>
        <button type="button" (click)="searchGroups()">Buscar grupos</button>
       </div>
       <p class="cat-muted">Elige qué opciones adicionales estarán disponibles para esta presentación.</p>
       <div class="cat-form">
        @for(link of links();track link.grupoId){
         <div class="cat-row">
          <strong>{{groupName(link.grupoId)}}</strong>
          <label class="cat-check"><input type="checkbox" [checked]="link.obligatorio"
           [disabled]="!access.canManage()" (change)="toggleRequired(link.grupoId,$any($event.target).checked)"/> Obligatorio</label>
          <button type="button" [disabled]="!access.canManage()" (click)="removeGroup(link.grupoId)">Quitar</button>
         </div>
        }
        <label>Agregar grupo
         <select [value]="groupId()" (change)="groupId.set($any($event.target).value)" [disabled]="!access.canManage()">
          <option value="">Seleccionar grupo</option>
          @for(group of groups();track group.id){
           @if(group.activo&&!linked(group.id)){<option [value]="group.id" [selected]="group.id===groupId()">{{group.nombre}}</option>}
          }
         </select>
        </label>
        <div class="cat-actions">
         <button type="button" [disabled]="!access.canManage()||!groupId()" (click)="addGroup()">Agregar grupo</button>
         <button type="button" class="cat-primary" [disabled]="!access.canManage()||busy()" (click)="saveGroups()">
          Guardar extras</button>
        </div>
       </div>
       <gc-catalog-gallery [entityId]="v.id" kind="variant" [photos]="v.imagenes??[]"
        [editable]="access.canManage()" (updated)="refreshVariant(v.id)"/>
       @if(branch.branchId()){
        <section class="cat-subsection">
         <h2>Disponibilidad en {{branch.active()?.nombre}}</h2>
         <label class="cat-check"><input type="checkbox" [checked]="branchEnabled()"
          (change)="branchEnabled.set($any($event.target).checked)" [disabled]="!access.canManageBranch()"/>
          Habilitada para vender en esta sucursal</label>
         <label class="cat-field">Pausa hasta (opcional, hora de este equipo)
          <input type="datetime-local" [value]="branchPause()" (input)="branchPause.set($any($event.target).value)"
           [disabled]="!access.canManageBranch()"/>
         </label>
         <label class="cat-field">Motivo (opcional)
          <input [value]="branchReason()" (input)="branchReason.set($any($event.target).value)" maxlength="500"
           [disabled]="!access.canManageBranch()"/>
         </label>
         <button type="button" [disabled]="!access.canManageBranch()||busy()" (click)="saveBranch()">
          Guardar disponibilidad</button>
        </section>
       }
      }
     </section>
    }
    <section class="cat-card">
     <h2>Revisión del producto</h2>
     <p class="cat-muted">Comprueba qué falta para mostrar este producto en la carta de la sucursal.</p>
     @if(readiness();as r){
      <strong>{{r.lista?'Listo para publicar':'Requiere atención'}}</strong>
      @for(v of r.variantes;track v.varianteId){
       @for(code of v.advertencias;track code){<p class="cat-muted">{{warning(code)}}</p>}
      }
     } @else {<p class="cat-muted">Selecciona una sucursal para revisar este producto.</p>}
    </section>
    <section class="cat-card">
     <h2>Estado del producto</h2>
     <strong>{{product.activo?'Activo':'Inactivo'}}</strong>
     <label class="cat-field">Motivo del cambio
      <input [value]="reason()" maxlength="500" (input)="reason.set($any($event.target).value)" [disabled]="!access.canManage()"/>
     </label>
     @if(access.canManage()){<button type="button" [disabled]="busy()||reason().trim().length<3" (click)="changeStatus()">
      {{product.activo?'Desactivar':'Reactivar'}} producto</button>}
    </section>
   }
  }
 </main>`,
 styleUrl:'../catalog.scss'
})
export class GcCatalogProductDetailPage implements OnInit,GcDirtyAware {
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly api=inject(CatalogApi);
 private readonly confirm=inject(ConfirmDialogService);
 private readonly notice=inject(GcNotificationService);
 protected readonly access=inject(CatalogAccess);
 protected readonly branch=inject(GcBranchContext);
 private readonly productRoute=catalogProductRoute(
  this.route.snapshot.routeConfig?.path,this.route.snapshot.paramMap.get('id'));
 protected readonly isNew=this.productRoute.isNew;
 private readonly id=this.productRoute.id??'';
 private committed=false;
 protected readonly page=new GcPageState<CatalogProduct>();
 protected readonly categories=signal<CatalogCategory[]>([]);
 protected readonly categorySearch=signal('');
 protected readonly groupSearch=signal('');
 protected readonly groups=signal<CatalogGroup[]>([]);
 protected readonly readiness=signal<CatalogProductReadiness|null>(null);
 protected readonly kinds=PRODUCT_KINDS;
 protected readonly code=signal('');
 protected readonly name=signal('');
 protected readonly description=signal('');
 protected readonly kind=signal('PREPARADO');
 protected readonly category=signal('');
 protected readonly visible=signal(false);
 protected readonly reason=signal('');
 protected readonly saving=signal(false);
 protected readonly saveError=signal<string|null>(null);
 protected readonly editVariant=signal<CatalogVariant|null>(null);
 protected readonly creatingVariant=signal(false);
 protected readonly variantName=signal('');
 protected readonly variantSku=signal('');
 protected readonly variantOrder=signal(0);
 protected readonly variantActive=signal(true);
 protected readonly articleId=signal('');
 protected readonly variantError=signal<string|null>(null);
 protected readonly branchEnabled=signal(true);
 protected readonly branchReason=signal('');
 protected readonly branchPause=signal('');
 protected readonly links=signal<CatalogGroupAttachment[]>([]);
 protected readonly groupId=signal('');
 protected readonly busy=computed(()=>this.saving());
 protected readonly validCode=computed(()=>/^[A-Za-z][A-Za-z0-9_-]{0,49}$/.test(this.code().trim()));
 protected readonly variants=computed(()=>this.page.data()?.varianteProductosComoProducto??[]);
 hasUnsavedChanges(){
  const d=this.page.data();
  return this.committed?false:this.isNew?!!this.code()||!!this.name():!!d&&(
   this.name()!==d.nombre||this.description()!==(d.descripcion??'')||
   this.category()!==(d.categoriaId??d.categoria?.id??'')||this.visible()!==d.visibleEnMenu);
 }
 async ngOnInit(){
  await Promise.all([this.searchCategories(),this.searchGroups()]);
  if(!this.isNew)await this.reload();
 }
 protected async searchCategories(){
  try{
   const result=await firstValueFrom(this.api.categoryOptions({search:this.categorySearch().trim(),limit:50}));
   const options:CatalogCategory[]=result.data.map(x=>({
    id:x.id,nombre:x.label,parentId:x.parentId,orden:0,activa:true
   }));
   const currentId=this.category();
   const existing=this.categories().find(x=>x.id===currentId)??null;
   const saved=readableCategory(this.page.data()?.categoria);
   const selected=existing??(saved?.id===currentId?saved:null);
   this.categories.set(keepSelected(options,selected));
  }catch(e){this.saveError.set(gcErrorMessage(e))}
 }
 protected async searchGroups(){
  try{
   const result=await firstValueFrom(this.api.modifierGroupOptions({search:this.groupSearch().trim(),limit:50}));
   const attached=this.editVariant()?.varianteGrupoModificadoresComoVariante??[];
   const prior=attached.flatMap(link=>link.grupo?[link.grupo]:[]);
   const selected=this.groups().find(x=>x.id===this.groupId());
   const all:CatalogGroup[]=[...result.data];
   for(const item of [...prior,...(selected?[selected]:[])]){
    if(!all.some(x=>x.id===item.id))all.unshift(item);
   }
   this.groups.set(all);
  }catch(e){this.variantError.set(gcErrorMessage(e))}
 }
 protected error(){return gcErrorMessage(this.page.error())}
 protected async reload(){
  await this.page.load(()=>firstValueFrom(this.api.product(this.id,this.branch.branchId()??undefined)));
  const d=this.page.data();if(!d)return;
  this.code.set(d.codigo);this.name.set(d.nombre);this.description.set(d.descripcion??'');
  this.kind.set(d.tipo);this.category.set(d.categoriaId??d.categoria?.id??'');
  // Product details arrive after the first search. Always restore their saved category.
  let saved=readableCategory(d.categoria);
  if(!saved&&this.category()){
   try{saved=readableCategory(await firstValueFrom(this.api.category(this.category())))}catch{/* unavailable category */}
  }
  this.categories.set(keepSelected(this.categories(),saved));
  this.visible.set(d.visibleEnMenu);this.editVariant.set(null);
  await this.fetchReadiness();
 }
 private async fetchReadiness(){
  const id=this.branch.branchId();if(!id||this.isNew)return;
  try{this.readiness.set(await firstValueFrom(this.api.productReadiness(this.id,id)))}
  catch{this.readiness.set(null)}
 }
 protected warning(code:string){
  const labels:Record<string,string>={
   SIN_PRECIO:'Configura el precio para esta sucursal.',
   SIN_FOTOGRAFIA_CONFIRMADA:'Agrega una fotografía al producto o a su presentación.',
   PAUSADA_EN_SUCURSAL:'La venta está pausada en esta sucursal.',
   PRODUCTO_O_VARIANTE_INACTIVA:'Activa el producto y su presentación.',
   OCULTA_EN_MENU:'Habilita la visibilidad del producto.',
   ARTICULO_FISICO_INVALIDO:'Revisa el artículo de inventario asociado.',
   SUCURSAL_INACTIVA:'La sucursal no está activa.',
  };
  return labels[code]??'Revisa la configuración de esta presentación antes de publicarla.';
 }
 protected async save(event:Event){
  event.preventDefault();if(!this.access.canManage()||this.busy()||!this.name().trim()||
   (this.isNew&&!this.validCode()))return;
  const dto={nombre:this.name().trim(),descripcion:this.description().trim()||null,
   categoriaId:this.category()||null};
  this.saving.set(true);this.saveError.set(null);
  try{
   if(this.isNew){
    const k=PRODUCT_KINDS.find(x=>x.value===this.kind())?.value??'PREPARADO';
    const result=await firstValueFrom(this.api.createProduct({...dto,codigo:this.code().trim(),tipo:k}));
    this.committed=true;
    await this.router.navigate(['/catalog/products',result.id]);
   }else{
    const original=this.page.data();
    if(!original)return;
    const update={
     ...(dto.nombre===original.nombre?{}:{nombre:dto.nombre}),
     ...(dto.descripcion===original.descripcion?{}:{descripcion:dto.descripcion}),
     ...(dto.categoriaId===(original.categoriaId??original.categoria?.id??null)?{}:{categoriaId:dto.categoriaId}),
     ...(this.visible()===original.visibleEnMenu?{}:{visibleEnMenu:this.visible()})
    };
    if(Object.keys(update).length){await firstValueFrom(this.api.updateProduct(this.id,update));await this.reload()}
   }
   this.notice.show('Producto guardado.','success');
  }catch(e){this.saveError.set(gcErrorMessage(e))}finally{this.saving.set(false)}
 }
 protected newVariant(){this.editVariant.set(null);this.creatingVariant.set(true);
  this.variantName.set('');this.variantSku.set('');this.variantOrder.set(this.variants().length);
  this.articleId.set('');this.variantActive.set(true);this.links.set([]);
 }
 protected async chooseVariant(v:CatalogVariant){
  this.creatingVariant.set(false);this.editVariant.set(v);
  this.variantName.set(v.nombre);this.variantSku.set(v.sku??'');this.variantOrder.set(v.orden);
  this.variantActive.set(v.activo);this.articleId.set(v.articuloInventarioId??v.articuloInventario?.id??'');
  const attached=v.varianteGrupoModificadoresComoVariante??[];
  this.links.set(attached.map(x=>({
   grupoId:x.grupoId,orden:x.orden,obligatorio:x.obligatorio
  })));
  // Preserve each associated group even if it is absent from the current search.
  this.groups.update(current=>{
   const all=[...current];
   for(const link of attached){
    if(link.grupo&&!all.some(x=>x.id===link.grupoId))all.push(link.grupo);
   }
   return all;
  });
  if(this.branch.branchId())try{
   const response=await firstValueFrom(this.api.variant(v.id,this.branch.branchId()!));
   this.branchEnabled.set(response.habilitadaSucursal??true);
   this.branchPause.set(response.pausadaHasta?this.localInput(response.pausadaHasta):'');
  }catch{this.branchEnabled.set(true);this.branchPause.set('')}
 }
 protected cancelVariant(){this.creatingVariant.set(false);this.editVariant.set(null)}
 protected async saveVariant(event:Event){
  event.preventDefault();if(!this.access.canManage()||this.saving()||!this.variantName().trim())return;
  const d=this.editVariant(),original=this.page.data();if(!original)return;
  if(original.tipo==='INVENTARIABLE'&&!this.articleId()){
   this.variantError.set('Selecciona un artículo de Inventario de tipo Producto terminado.');return;
  }
  this.saving.set(true);this.variantError.set(null);
  try{
   const dto={
    nombre:this.variantName().trim(),sku:this.variantSku().trim()||null,
    orden:this.variantOrder(),...(original.tipo==='INVENTARIABLE'?{articuloInventarioId:this.articleId()||null}:{})
   };
   if(d)await firstValueFrom(this.api.updateVariant(d.id,{...dto,activo:this.variantActive()}));
   else await firstValueFrom(this.api.createVariant(original.id,dto));
   await this.reload();this.notice.show('Variante guardada.','success');
  }catch(e){this.variantError.set(gcErrorMessage(e))}finally{this.saving.set(false)}
 }
 protected groupName(id:string){return this.groups().find(g=>g.id===id)?.nombre??'Grupo no disponible'}
 protected linked(id:string){return this.links().some(x=>x.grupoId===id)}
 protected addGroup(){const id=this.groupId();if(!id||this.linked(id)||this.links().length>=20)return;
  this.links.update(a=>[...a,{grupoId:id,orden:a.length,obligatorio:false}]);this.groupId.set('')}
 protected removeGroup(id:string){this.links.update(a=>a.filter(v=>v.grupoId!==id).map((v,orden)=>({...v,orden})))}
 protected toggleRequired(id:string,required:boolean){this.links.update(a=>a.map(x=>x.grupoId===id?{...x,obligatorio:required}:x))}
 protected async saveGroups(){
  const v=this.editVariant();if(!v||!this.access.canManage()||this.busy())return;
  this.saving.set(true);this.variantError.set(null);
  try{await firstValueFrom(this.api.attachVariantGroups(v.id,this.links()));
   await this.refreshVariant(v.id);this.notice.show('Extras asociados.','success');
  }catch(e){this.variantError.set(gcErrorMessage(e))}finally{this.saving.set(false)}
 }
 protected async refreshVariant(id:string){
  await this.reload();const v=this.variants().find(x=>x.id===id);
  if(v)await this.chooseVariant(v);
 }
 private localInput(iso:string):string{
  const d=new Date(iso);
  return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
 }
 protected async saveBranch(){
  const v=this.editVariant(),sucursalId=this.branch.branchId();
  if(!v||!sucursalId||!this.access.canManageBranch()||this.busy())return;
  let pausadaHasta:string|null;
  try{pausadaHasta=this.branchPause()?new Date(this.branchPause()).toISOString():null}
  catch{this.variantError.set('Fecha de pausa inválida.');return}
  this.saving.set(true);this.variantError.set(null);
  try{await firstValueFrom(this.api.variantBranch(v.id,{
   sucursalId,habilitada:this.branchEnabled(),pausadaHasta,motivo:this.branchReason().trim()||null
  }));
   await this.fetchReadiness();this.notice.show('Disponibilidad actualizada.','success');
  }catch(e){this.variantError.set(gcErrorMessage(e))}finally{this.saving.set(false)}
 }
 protected async changeStatus(){
  const d=this.page.data();if(!d||!this.access.canManage()||this.reason().trim().length<3)return;
  const ok=await this.confirm.confirm({title:d.activo?'Desactivar producto':'Reactivar producto',
   message:'Se revisarán sus relaciones con menús y órdenes.',confirmText:'Confirmar',danger:d.activo});
  if(!ok)return;
  this.saving.set(true);this.saveError.set(null);
  try{await firstValueFrom(this.api.productStatus(d.id,!d.activo,this.reason().trim()));
   await this.reload();this.notice.show('Estado de producto actualizado.','success')
  }catch(e){this.saveError.set(gcErrorMessage(e))}finally{this.saving.set(false)}
 }
}
