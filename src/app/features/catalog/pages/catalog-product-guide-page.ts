import {Component,computed,inject,OnInit,signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {firstValueFrom,Subject,debounceTime,distinctUntilChanged} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CatalogApi} from '../data-access/catalog.api';
import {CatalogAccess} from '../data-access/catalog-access';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcCatalogNav} from '../catalog-nav';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {RecipesAccess} from '../../recipes/data-access/recipes-access';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {gcErrorMessage} from '../../../core/http/api-error';
import {PRODUCT_KINDS,type CatalogKind,type CatalogProduct,type CatalogCategoryOption,
 type CatalogProductReadiness} from '../data-access/catalog.models';
import {guidedProductDto,suggestedProductCode,validateGuidedProduct,validPrice,
 type GuidedVariant} from '../data-access/catalog-product-guide';
import type {GcDirtyAware} from '../../../core/ux/gc-unsaved-changes.guard';

interface PriceResult {state:'saved'|'review';amount:string}

/** A task-oriented entry point; advanced product editing remains at /catalog/products/:id. */
@Component({
 selector:'gc-catalog-product-guide-page',
 imports:[RouterLink,GcCatalogNav,GcSearchSelect,GcInventoryPicker],
 template:`
 <main class="cat-page cat-guide">
  <gc-catalog-nav/>
  <div class="cat-guide-top">
   <div><a routerLink="/catalog/products">← Productos</a><h1>{{created()?'Producto creado':'Nuevo producto'}}</h1></div>
   @if(created();as product){<a class="cat-primary" [routerLink]="['/catalog/products',product.id]">Editar producto</a>}
  </div>
  @if(created();as product){
   <section class="cat-card cat-guide-created" role="status">
    <h2>{{product.nombre}}</h2>
    <p class="cat-muted">{{product.varianteProductosComoProducto?.length??0}} presentaciones guardadas</p>
    <div class="cat-guide-prices">
     @for(variant of product.varianteProductosComoProducto??[];track variant.id){
      <div><strong>{{variant.nombre}}</strong>
       @if(prices()[variant.id];as price){
        <span [class.cat-guide-price-error]="price.state==='review'">
         {{price.state==='saved'?'Q '+price.amount:'Precio por revisar'}}</span>
       }@else{<span>Sin precio registrado</span>}
      </div>
     }
    </div>
    @if(priceError()){
     <p class="cat-alert" role="alert">{{priceError()}}
      <a routerLink="/catalog/prices">Revisar precios</a>
     </p>
    }
    @if(readiness();as result){
     @if(!result.lista){<p class="cat-muted">Para venderlo todavía debes completar la fotografía, visibilidad y publicación en la carta.</p>}
    }
   </section>
   <section class="cat-card">
    <h2>¿Qué sigue?</h2>
    <div class="cat-guide-next">
     <a [routerLink]="['/catalog/products',product.id]"><strong>Fotografía y extras</strong><small>Configurar detalles y disponibilidad</small></a>
     @if(product.tipo==='PREPARADO'){
      @for(variant of product.varianteProductosComoProducto??[];track variant.id){
       @if(recipesAccess.canManage()){
        <a routerLink="/recipes/list/new" [queryParams]="{varianteId:variant.id}">
         <strong>Receta · {{variant.nombre}}</strong><small>Ingredientes y cantidades</small></a>
       }@else{
        <span class="cat-guide-next-disabled"><strong>Receta · {{variant.nombre}}</strong><small>Solicita acceso a gestión de recetas</small></span>
       }
      }
     }
     @if(access.canPrices()){
      <a routerLink="/catalog/prices"><strong>Precios</strong><small>Historial y otras sucursales</small></a>
     }
     @if(access.canMenus()){
      <a routerLink="/catalog/menus"><strong>Agregar a carta</strong><small>Seleccionar menú y sección</small></a>
     }
    </div>
    <p class="cat-muted">Crear el producto no lo publica automáticamente en el POS.</p>
    <div class="cat-actions"><a class="cat-primary" routerLink="/catalog/products/new">Crear otro producto</a>
     <a routerLink="/catalog/products">Volver al catálogo</a></div>
   </section>
  }@else{
   <form class="cat-guide-form" (submit)="create($event)" novalidate>
    <section class="cat-card">
     <div class="cat-guide-title"><span>1</span><h2>Qué vas a vender</h2></div>
     <label class="cat-guide-field">Nombre comercial
      <input [value]="name()" (input)="name.set($any($event.target).value)"
       [attr.aria-invalid]="submitted()&&!name().trim()" [disabled]="saving()"
       maxlength="160" required placeholder="Ej. Capuchino clásico"/></label>
     <fieldset class="cat-guide-types">
      <legend>Tipo de producto</legend>
      <div class="cat-guide-type-grid">
       @for(option of types;track option.value){
        <label [class.active]="kind()===option.value">
         <input type="radio" name="tipoProducto" [value]="option.value"
          [checked]="kind()===option.value" [disabled]="saving()"
          (change)="selectKind(option.value)"/>
         <strong>{{option.label}}</strong>
         <small>{{kindHint(option.value)}}</small>
        </label>
       }
      </div>
     </fieldset>
     <div class="cat-guide-two">
      <gc-search-select id="guide-category" label="Categoría (opcional)"
       [items]="categoryChoices()" [value]="categoryId()" [remote]="true"
       [loading]="categoryLoading()" [disabled]="saving()"
       placeholder="Buscar categoría" (searchChange)="searchCategory($event)"
       (valueChange)="categoryId.set($event)"/>
      <div class="cat-guide-category-action">
       <button type="button" [disabled]="saving()" (click)="addingCategory.set(!addingCategory())">
        {{addingCategory()?'Cancelar':'Nueva categoría'}}</button>
       @if(addingCategory()){
        <label class="cat-guide-field">Nombre de categoría
         <input maxlength="130" [value]="categoryName()"
          (input)="categoryName.set($any($event.target).value)" [disabled]="categorySaving()"/></label>
        <button type="button" class="cat-primary" [disabled]="!categoryName().trim()||categorySaving()"
         (click)="createCategory()">{{categorySaving()?'Creando…':'Crear y seleccionar'}}</button>
       }
      </div>
     </div>
     @if(categoryError()){<p role="alert" class="cat-alert">{{categoryError()}}</p>}
     <details class="cat-guide-options">
      <summary>Descripción y código (opcional)</summary>
      <div class="cat-guide-two">
       <label class="cat-guide-field">Descripción
        <textarea rows="2" maxlength="1500" [disabled]="saving()" [value]="description()"
         (input)="description.set($any($event.target).value)"></textarea></label>
       <label class="cat-guide-field">Código comercial
        <input maxlength="50" [value]="code()" [disabled]="saving()"
         [attr.aria-invalid]="submitted()&&!codeValid()"
         (input)="setCode($any($event.target).value)"/>
        <small>Propuesto automáticamente; editable.</small></label>
      </div>
     </details>
    </section>

    <section class="cat-card">
     <div class="cat-guide-title"><span>2</span><h2>Presentaciones y precios</h2></div>
     <div class="cat-actions cat-guide-presets">
      <button type="button" [disabled]="saving()||variants().length>=50" (click)="addVariant()">+ Presentación</button>
      <button type="button" [disabled]="saving()||variants().length>47" (click)="addSizes()">Pequeño, Mediano y Grande</button>
     </div>
     @if(branch.branchId()&&access.canPrices()){
      <p class="cat-muted">Precios en <strong>{{branch.active()?.nombre}}</strong> · GTQ. Déjalo vacío para agregarlo después.</p>
     }@else{
      <p class="cat-muted">Podrás registrar precios cuando tengas permisos y una sucursal seleccionada.</p>
     }
     <div class="cat-guide-variants">
      @for(variant of variants();track variant.key;let i=$index){
       <fieldset class="cat-guide-variant">
        <legend>Presentación {{i+1}}</legend>
        <div class="cat-guide-variant-row">
         <label class="cat-guide-field">Nombre
          <input maxlength="120" required [value]="variant.nombre" [disabled]="saving()"
           [attr.aria-invalid]="submitted()&&!variant.nombre.trim()"
           (input)="editVariant(variant.key,{nombre:$any($event.target).value})"
           placeholder="Única, Mediano, Grande…"/></label>
         @if(branch.branchId()&&access.canPrices()){
          <label class="cat-guide-field">Precio (Q)
           <input inputmode="decimal" maxlength="19" [value]="variant.precio" [disabled]="saving()"
            [attr.aria-invalid]="submitted()&&!!variant.precio&&!validPrice(variant.precio)"
            (input)="editVariant(variant.key,{precio:$any($event.target).value})"
            placeholder="24.00"/></label>
         }
         @if(kind()==='INVENTARIABLE'){
          <gc-inventory-picker [id]="'guide-article-'+variant.key" label="Artículo físico"
           kind="article" articleKind="PRODUCTO_TERMINADO"
           [value]="variant.articuloInventarioId" [disabled]="saving()"
           (valueChange)="editVariant(variant.key,{articuloInventarioId:$event})"/>
         }
         <button type="button" [disabled]="saving()||variants().length===1"
          [attr.aria-label]="'Quitar presentación '+(i+1)"
          (click)="removeVariant(variant.key)">Quitar</button>
        </div>
       </fieldset>
      }
     </div>
     @if(kind()==='INVENTARIABLE'){
      <p class="cat-muted">Vincula un artículo terminado por presentación.
       <a routerLink="/inventory/articles/new">Crear artículo en Inventario</a></p>
     }
    </section>

    <section class="cat-card cat-guide-footer">
     <div class="cat-guide-title"><span>3</span><h2>Guardar y continuar</h2></div>
     @if(submitted()&&issues().length){
      <div class="cat-alert" role="alert">
       <strong>Corrige estos campos:</strong>
       <ul>@for(issue of issues();track issue){<li>{{issue}}</li>}</ul>
      </div>
     }
     @if(error()){<p class="cat-alert" role="alert">{{error()}}
      <span> Si la respuesta se perdió, comprueba la lista antes de repetir el alta.</span></p>}
     <div class="cat-guide-actions">
      <span class="cat-muted">{{variants().length}} presentaciones · {{branch.active()?.nombre??'Sin sucursal'}}</span>
      <button type="submit" class="cat-primary" [disabled]="saving()||!access.canManage()">
       {{saving()?'Guardando…':'Crear producto y presentaciones'}}</button>
     </div>
    </section>
   </form>
  }
 </main>`,
 styleUrls:['../catalog.scss','./catalog-product-guide.scss']
})
export class GcCatalogProductGuidePage implements OnInit,GcDirtyAware {
 protected readonly access=inject(CatalogAccess);
 protected readonly branch=inject(GcBranchContext);
 protected readonly recipesAccess=inject(RecipesAccess);
 private readonly api=inject(CatalogApi);
 private readonly notify=inject(GcNotificationService);
 protected readonly types=PRODUCT_KINDS;
 protected readonly kind=signal<CatalogKind>('PREPARADO');
 protected readonly name=signal('');
 protected readonly description=signal('');
 protected readonly categoryId=signal('');
 protected readonly customCode=signal('');
 protected readonly editedCode=signal(false);
 protected readonly variants=signal<GuidedVariant[]>([
  {key:1,nombre:'Única',precio:'',articuloInventarioId:''}
 ]);
 private nextKey=2;
 protected readonly code=computed(()=>this.editedCode()?this.customCode():suggestedProductCode(this.name()));
 protected readonly codeValid=computed(()=>/^[A-Za-z][A-Za-z0-9_-]{0,49}$/.test(this.code().trim()));
 protected readonly categories=signal<CatalogCategoryOption[]>([]);
 protected readonly categoryChoices=computed(()=>this.categories().map(x=>({id:x.id,label:x.label})));
 protected readonly categoryLoading=signal(false);
 protected readonly categoryError=signal('');
 protected readonly addingCategory=signal(false);
 protected readonly categoryName=signal('');
 protected readonly categorySaving=signal(false);
 protected readonly saving=signal(false);
 protected readonly submitted=signal(false);
 protected readonly error=signal('');
 protected readonly created=signal<CatalogProduct|null>(null);
 protected readonly prices=signal<Record<string,PriceResult>>({});
 protected readonly priceError=signal('');
 protected readonly readiness=signal<CatalogProductReadiness|null>(null);
 protected readonly draft=computed(()=>({
  nombre:this.name(),codigo:this.code(),tipo:this.kind(),categoriaId:this.categoryId(),
  descripcion:this.description(),variantes:this.variants()
 }));
 protected readonly issues=computed(()=>validateGuidedProduct(this.draft()));
 protected readonly validPrice=validPrice;
 private readonly categorySearch=new Subject<string>();
 private categoryGeneration=0;
 constructor(){
  this.categorySearch.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed())
   .subscribe(text=>void this.loadCategories(text));
 }
 async ngOnInit(){await this.loadCategories('')}
 hasUnsavedChanges(){
  return !this.created()&&(
   !!this.name().trim()||!!this.description().trim()||!!this.categoryId()||
   this.editedCode()||this.kind()!=='PREPARADO'||this.variants().length!==1||
   this.variants()[0].nombre!=='Única'||!!this.variants()[0].precio||
   !!this.variants()[0].articuloInventarioId
  );
 }
 protected kindHint(kind:CatalogKind){
  return kind==='PREPARADO'?'Se hace en Cocina':kind==='INVENTARIABLE'?'Se entrega del inventario':'Sin preparación';
 }
 protected setCode(value:string){this.editedCode.set(true);this.customCode.set(value.toUpperCase())}
 protected selectKind(value:CatalogKind){
  this.kind.set(value);this.submitted.set(false);
  if(value!=='INVENTARIABLE')
   this.variants.update(list=>list.map(x=>({...x,articuloInventarioId:''})));
 }
 protected addVariant(){
  if(this.variants().length>=50)return;
  this.variants.update(list=>[...list,{key:this.nextKey++,nombre:'',precio:'',articuloInventarioId:''}]);
 }
 protected addSizes(){
  const current=this.variants();
  if(current.length===1&&current[0].nombre==='Única'&&!current[0].precio&&!current[0].articuloInventarioId){
   this.variants.set(['Pequeño','Mediano','Grande'].map(nombre=>({
    key:this.nextKey++,nombre,precio:'',articuloInventarioId:''
   })));return;
  }
  for(const nombre of ['Pequeño','Mediano','Grande']){
   if(this.variants().length>=50)break;
   if(!this.variants().some(x=>x.nombre.trim().toLowerCase()===nombre.toLowerCase())){
    this.variants.update(list=>[...list,{key:this.nextKey++,nombre,precio:'',articuloInventarioId:''}]);
   }
  }
 }
 protected editVariant(key:number,patch:Partial<GuidedVariant>){
  this.variants.update(list=>list.map(item=>item.key===key?{...item,...patch}:item));
 }
 protected removeVariant(key:number){
  if(this.variants().length>1)this.variants.update(list=>list.filter(item=>item.key!==key));
 }
 protected searchCategory(value:string){this.categorySearch.next(value)}
 private async loadCategories(search:string){
  const version=++this.categoryGeneration;this.categoryLoading.set(true);this.categoryError.set('');
  try{
   const result=await firstValueFrom(this.api.categoryOptions({search,limit:50}));
   if(version!==this.categoryGeneration)return;
   const selected=this.categories().find(x=>x.id===this.categoryId());
   this.categories.set([...result.data,...(selected&&!result.data.some(x=>x.id===selected.id)?[selected]:[])]);
  }catch(e){if(version===this.categoryGeneration)this.categoryError.set(gcErrorMessage(e))}
  finally{if(version===this.categoryGeneration)this.categoryLoading.set(false)}
 }
 protected async createCategory(){
  if(!this.access.canManage()||!this.categoryName().trim()||this.categorySaving())return;
  this.categorySaving.set(true);this.categoryError.set('');
  try{
   const item=await firstValueFrom(this.api.createCategory({nombre:this.categoryName().trim()}));
   this.categories.update(list=>[{id:item.id,label:item.nombre,parentId:item.parentId},...list]);
   this.categoryId.set(item.id);this.categoryName.set('');this.addingCategory.set(false);
   this.notify.show('Categoría creada y seleccionada.','success');
  }catch(e){this.categoryError.set(gcErrorMessage(e))}
  finally{this.categorySaving.set(false)}
 }
 protected async create(event:Event){
  event.preventDefault();this.submitted.set(true);
  if(!this.access.canManage()||this.saving()||this.created()||this.issues().length)return;
  const branchId=this.branch.branchId();
  const canPrice=!!branchId&&this.access.canPrices();
  const items=this.variants().map(x=>({...x}));
  this.saving.set(true);this.error.set('');
  try{
   const product=await firstValueFrom(this.api.createProduct(guidedProductDto(this.draft())));
   // The persisted ID is committed before prices. Do not create the product twice if a price fails.
   this.created.set(product);
   this.notify.show('Producto y presentaciones creados.','success');
   if(branchId&&canPrice)await this.savePrices(product,items,branchId);
   try{if(branchId)this.readiness.set(await firstValueFrom(this.api.productReadiness(product.id,branchId)))}
   catch{/* Readiness is optional for the completed creation. */}
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.saving.set(false)}
 }
 private async savePrices(product:CatalogProduct,items:GuidedVariant[],branchId:string){
  const variants=product.varianteProductosComoProducto??[];
  const since=new Date().toISOString();
  let failed=false;
  for(const item of items.filter(x=>x.precio.trim())){
   const v=variants.find(x=>x.nombre.trim().toLowerCase()===item.nombre.trim().toLowerCase());
   if(!v){failed=true;continue}
   try{
    await firstValueFrom(this.api.createVariantPrice({
     entityId:v.id,sucursalId:branchId,importe:item.precio.trim(),vigenteDesde:since
    }));
    this.prices.update(old=>({...old,[v.id]:{state:'saved',amount:item.precio.trim()}}));
   }catch{
    // No automatic retry: a timeout may still have committed this tariff.
    this.prices.update(old=>({...old,[v.id]:{state:'review',amount:item.precio.trim()}}));
    failed=true;
   }
  }
  if(failed)this.priceError.set('Algunos precios necesitan revisión. El producto ya se creó; revisa los precios vigentes antes de registrar otro.');
 }
}
