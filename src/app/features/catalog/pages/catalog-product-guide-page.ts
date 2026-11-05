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
import {OrganizationAccess} from '../../organization/data-access/organization-access';
import {GcCatalogInlineRecipe} from '../components/catalog-inline-recipe';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {gcErrorMessage} from '../../../core/http/api-error';
import {PRODUCT_KINDS,type CatalogKind,type CatalogProduct,type CatalogCategoryOption,
 type CatalogProductReadiness} from '../data-access/catalog.models';
import {guidedSetupDto,suggestedArticleCode,suggestedProductCode,validateGuidedProduct,validPrice,
 type GuidedVariant} from '../data-access/catalog-product-guide';
import type {GcDirtyAware} from '../../../core/ux/gc-unsaved-changes.guard';

interface PriceResult {state:'saved'|'review';amount:string}

/** A task-oriented entry point; advanced product editing remains at /catalog/products/:id. */
@Component({
 selector:'gc-catalog-product-guide-page',
 imports:[RouterLink,GcCatalogNav,GcSearchSelect,GcInventoryPicker,GcCatalogInlineRecipe],
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
    <p class="cat-muted">{{product.varianteProductosComoProducto?.length===1?'Producto único':(product.varianteProductosComoProducto?.length??0)+' presentaciones'}} · Guardado en una operación</p>
    @if(product.tipo==='INVENTARIABLE'&&createdNewArticle()){
     <p class="cat-guide-stock-note">Artículo de Inventario creado · <strong>stock inicial: 0</strong>. Registra una entrada cuando recibas mercancía.</p>
    }
    <div class="cat-guide-prices">
     @for(variant of product.varianteProductosComoProducto??[];track variant.id){
      <div><strong>{{product.varianteProductosComoProducto?.length===1?'Producto único':variant.nombre}}</strong>
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
     @if(!result.lista){
      <div class="cat-guide-diagnostics" role="status">
       <strong>Qué falta para venderlo</strong>
       <ul>@for(message of readinessMessages();track message){<li>{{message}}</li>}</ul>
      </div>
     }@else{<p class="cat-muted">Configuración válida. Comprueba la asignación del producto a la carta de la sucursal.</p>}
    }
   </section>
   <section class="cat-card">
    <h2>¿Qué sigue?</h2>
    <div class="cat-guide-next">
     <a [routerLink]="['/catalog/products',product.id]"><strong>Fotografía y extras</strong><small>Configurar detalles y disponibilidad</small></a>
     @if(product.tipo==='PREPARADO'){
      @for(variant of product.varianteProductosComoProducto??[];track variant.id){
       @if(recipesAccess.canRead()){
        <button type="button" class="cat-guide-recipe-trigger"
         (click)="selectRecipeVariant(variant.id)">
         <strong>Receta · {{variant.nombre}}</strong>
         <small>Configurar ingredientes y consumo sin salir</small></button>
       }@else{
        <span class="cat-guide-next-disabled"><strong>Receta · {{variant.nombre}}</strong>
         <small>Consulta de recetas no autorizada</small></span>
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
    @if(product.tipo==='PREPARADO'&&recipeVariant()){
     @for(variant of product.varianteProductosComoProducto??[];track variant.id){
      @if(recipeVariant()===variant.id){
       <gc-catalog-inline-recipe [variantId]="variant.id" [productName]="product.nombre"
        [variantName]="variant.nombre" (updated)="refreshReadiness(product.id)" (pendingChange)="recipePending.set($event)"/>
      }
     }
    }
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
     <div class="cat-guide-title"><span>2</span><h2>{{multiSize()?'Tamaños y precios':'Precio y existencias'}}</h2></div>
     @if(!multiSize()){
      <div class="cat-guide-single-head">
       <span>Se vende por unidad. La presentación «Única» se gestiona automáticamente.</span>
       <button type="button" [disabled]="saving()" (click)="addVariant()">+ Agregar tamaños</button>
      </div>
     }@else{
      <div class="cat-actions cat-guide-presets">
       <button type="button" [disabled]="saving()||variants().length>=50" (click)="addVariant()">+ Presentación</button>
       <button type="button" [disabled]="saving()||variants().length>47" (click)="addSizes()">Pequeño, Mediano y Grande</button>
      </div>
     }
     @if(branch.branchId()&&access.canPrices()){
      <p class="cat-muted">Precios en <strong>{{branch.active()?.nombre}}</strong> · GTQ. Déjalo vacío para agregarlo después.</p>
     }@else{
      <p class="cat-muted">Podrás registrar precios cuando tengas permisos y una sucursal seleccionada.</p>
     }
     <div class="cat-guide-variants">
      @for(variant of variants();track variant.key;let i=$index){
       <fieldset class="cat-guide-variant">
        <legend>{{multiSize()?'Presentación '+(i+1):'Producto único'}}</legend>
        <div class="cat-guide-variant-row" [class.cat-guide-variant-row--single]="!multiSize()">
         @if(multiSize()){
          <label class="cat-guide-field">Nombre del tamaño
           <input maxlength="120" required [value]="variant.nombre" [disabled]="saving()"
            [attr.aria-invalid]="submitted()&&!variant.nombre.trim()"
            (input)="editVariant(variant.key,{nombre:$any($event.target).value})"
            placeholder="Mediano, Grande…"/></label>
         }
         @if(branch.branchId()&&access.canPrices()){
          <label class="cat-guide-field">Precio (Q)
           <input inputmode="decimal" maxlength="19" [value]="variant.precio" [disabled]="saving()"
            [attr.aria-invalid]="submitted()&&!!variant.precio&&!validPrice(variant.precio)"
            (input)="editVariant(variant.key,{precio:$any($event.target).value})"
            placeholder="24.00"/></label>
         }
         @if(kind()==='INVENTARIABLE'){
          <div class="cat-guide-article-inline">
           @if(canCreateArticle()){
            <fieldset class="cat-guide-article-choice">
             <legend>Inventario</legend>
             <label><input type="radio" [name]="'article-'+variant.key" value="nuevo"
              [disabled]="saving()" [checked]="variant.articuloModo==='nuevo'"
              (change)="editVariant(variant.key,{articuloModo:'nuevo',articuloInventarioId:''})"/>
              Crear artículo ahora</label>
             <label><input type="radio" [name]="'article-'+variant.key" value="existente"
              [disabled]="saving()" [checked]="variant.articuloModo!=='nuevo'"
              (change)="editVariant(variant.key,{articuloModo:'existente'})"/>
              Usar uno existente</label>
            </fieldset>
           }
           @if(variant.articuloModo==='nuevo'&&canCreateArticle()){
            <p class="cat-muted">El artículo terminado se crea y vincula automáticamente con <strong>0 existencias</strong>.</p>
            <details class="cat-guide-article-advanced">
             <summary>Opciones del artículo (código y vencimientos)</summary>
             <label class="cat-guide-field">Código de inventario
              <input maxlength="50" [disabled]="saving()" [value]="variant.articuloCodigo||articleCode(i)"
               (input)="editVariant(variant.key,{articuloCodigo:$any($event.target).value})"/></label>
             <label><input type="checkbox" [checked]="!!variant.controlarLote" [disabled]="saving()"
               (change)="editVariant(variant.key,{controlarLote:$any($event.target).checked,
                 controlarVencimiento:$any($event.target).checked?variant.controlarVencimiento:false})"/>
               Controlar por lotes</label>
             <label><input type="checkbox" [checked]="!!variant.controlarVencimiento"
               [disabled]="saving()||!variant.controlarLote"
               (change)="editVariant(variant.key,{controlarVencimiento:$any($event.target).checked})"/>
               Controlar vencimientos</label>
            </details>
           }@else{
            <gc-inventory-picker [id]="'guide-article-'+variant.key" label="Artículo físico existente"
             kind="article" articleKind="PRODUCTO_TERMINADO"
             [value]="variant.articuloInventarioId" [disabled]="saving()"
             (valueChange)="editVariant(variant.key,{articuloInventarioId:$event})"/>
           }
          </div>
         }
         @if(multiSize()){
          <button type="button" [disabled]="saving()||variants().length===1"
           [attr.aria-label]="'Quitar presentación '+(i+1)"
           (click)="removeVariant(variant.key)">Quitar</button>
         }
        </div>
       </fieldset>
      }
     </div>
     @if(kind()==='INVENTARIABLE'&&!canCreateArticle()){
      <p class="cat-muted">Tu rol permite usar artículos existentes. Solicita el permiso de Inventario para crear uno nuevo sin salir de esta pantalla.</p>
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
      <span class="cat-muted">{{multiSize()?variants().length+' tamaños':'Producto único'}} · {{branch.active()?.nombre??'Sin sucursal'}}</span>
      <button type="submit" class="cat-primary" [disabled]="saving()||!access.canManage()">
       {{saving()?'Guardando…':'Crear producto'}}</button>
     </div>
    </section>
   </form>
  }
 </main>`,
 styleUrl:'../catalog.scss'
})
export class GcCatalogProductGuidePage implements OnInit,GcDirtyAware {
 protected readonly access=inject(CatalogAccess);
 protected readonly branch=inject(GcBranchContext);
 protected readonly recipesAccess=inject(RecipesAccess);
 private readonly org=inject(OrganizationAccess);
 protected readonly canCreateArticle=computed(()=>this.org.canGlobal('inventory.articles.manage'));
 protected readonly articleCode=(index:number)=>suggestedArticleCode(this.code(),index);
 private readonly api=inject(CatalogApi);
 private readonly notify=inject(GcNotificationService);
 private readonly confirm=inject(ConfirmDialogService);
 protected readonly types=PRODUCT_KINDS;
 protected readonly kind=signal<CatalogKind>('PREPARADO');
 protected readonly name=signal('');
 protected readonly description=signal('');
 protected readonly categoryId=signal('');
 protected readonly customCode=signal('');
 protected readonly editedCode=signal(false);
 protected readonly multiSize=signal(false);
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
 protected readonly recipeVariant=signal('');
 protected readonly recipePending=signal(false);
 protected readonly createdNewArticle=signal(false);
 protected readonly prices=signal<Record<string,PriceResult>>({});
 protected readonly priceError=signal('');
 protected readonly readiness=signal<CatalogProductReadiness|null>(null);
 protected readonly readinessMessages=computed(()=>{
  const labels:Record<string,string>={
   SIN_PRECIO:'Registrar precio de venta',SIN_RECETA_PUBLICADA:'Publicar la receta de preparación',
   SIN_RUTA_O_UBICACION_COCINA:'Configurar la estación de Cocina y su ubicación de consumo',
   SIN_FOTOGRAFIA_CONFIRMADA:'Agregar una fotografía',
   OCULTA_EN_MENU:'Habilitar visibilidad en la carta',
   ARTICULO_FISICO_INVALIDO:'Vincular un artículo físico activo',
   ARTICULO_UNIDAD_INCOMPATIBLE:'El artículo debe medirse por unidades',
   EXTRA_SIN_COMPOSICION_FISICA:'Un extra requiere ingredientes que faltan',
   EXTRA_FISICO_REQUIERE_PREPARADO:'Los extras físicos requieren un producto preparado',
   PRODUCTO_O_VARIANTE_INACTIVA:'Activar producto y presentación',
   PAUSADA_EN_SUCURSAL:'Habilitar el producto en esta sucursal'
  };
  return [...new Set((this.readiness()?.variantes??[])
   .flatMap(x=>x.advertencias).map(x=>labels[x]??x.replaceAll('_',' ').toLowerCase()))];
 });
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
  return this.recipePending()||!this.created()&&(
   !!this.name().trim()||!!this.description().trim()||!!this.categoryId()||
   this.editedCode()||this.kind()!=='PREPARADO'||this.variants().length!==1||
   this.variants()[0].nombre!=='Única'||!!this.variants()[0].precio||
   !!this.variants()[0].articuloInventarioId||
   this.variants().some(x=>!!x.articuloModo||!!x.articuloCodigo||
    !!x.controlarLote||!!x.controlarVencimiento)
  );
 }
 protected kindHint(kind:CatalogKind){
  return kind==='PREPARADO'?'Se hace en Cocina':kind==='INVENTARIABLE'?'Se entrega del inventario':'Sin preparación';
 }
 protected setCode(value:string){this.editedCode.set(true);this.customCode.set(value.toUpperCase())}
 protected selectKind(value:CatalogKind){
  this.kind.set(value);this.submitted.set(false);
  this.variants.update(list=>list.map(x=>({...x,articuloInventarioId:'',
   articuloModo:value==='INVENTARIABLE'?
    (this.canCreateArticle()?'nuevo':'existente'):undefined})));
 }
 protected addVariant(){
  if(this.variants().length>=50)return;
  const first=this.variants()[0];
  const firstIsUntouched= !this.multiSize()&&this.variants().length===1&&
   first.nombre==='Única'&&!first.precio&&!first.articuloInventarioId;
  this.multiSize.set(true);
  this.variants.update(list=>[
   ...(firstIsUntouched?list.map((v,i)=>i===0?{...v,nombre:'Pequeño'}:v):list),
   {key:this.nextKey++,nombre:firstIsUntouched?'Mediano':'',precio:'',articuloInventarioId:'',
    articuloModo:this.kind()==='INVENTARIABLE'?
     (this.canCreateArticle()?'nuevo':'existente'):undefined}
  ]);
 }
 protected addSizes(){
  this.multiSize.set(true);
  const current=this.variants();
  if(current.length===1&&current[0].nombre==='Única'&&!current[0].precio&&!current[0].articuloInventarioId){
   this.variants.set(['Pequeño','Mediano','Grande'].map(nombre=>({
    key:this.nextKey++,nombre,precio:'',articuloInventarioId:'',
    articuloModo:this.kind()==='INVENTARIABLE'?
     (this.canCreateArticle()?'nuevo':'existente'):undefined
   })));return;
  }
  for(const nombre of ['Pequeño','Mediano','Grande']){
   if(this.variants().length>=50)break;
   if(!this.variants().some(x=>x.nombre.trim().toLowerCase()===nombre.toLowerCase())){
    this.variants.update(list=>[...list,{key:this.nextKey++,nombre,precio:'',articuloInventarioId:'',
     articuloModo:this.kind()==='INVENTARIABLE'?
      (this.canCreateArticle()?'nuevo':'existente'):undefined}]);
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
 protected async selectRecipeVariant(id:string){
  if(this.recipePending()&&
   !await this.confirm.confirm({title:'Descartar receta sin guardar',
    message:'Los ingredientes escritos no se guardaron. ¿Cambiar de receta?',
    confirmText:'Descartar',danger:true}))return;
  this.recipeVariant.set(this.recipeVariant()===id?'':id);this.recipePending.set(false);
 }
 protected async refreshReadiness(productId:string){
  const branchId=this.branch.branchId();
  if(!branchId)return;
  try{this.readiness.set(await firstValueFrom(this.api.productReadiness(productId,branchId)))}
  catch{ /* Product is saved even when readiness cannot be refreshed. */ }
 }
 protected async create(event:Event){
  event.preventDefault();this.submitted.set(true);
  if(!this.access.canManage()||this.saving()||this.created()||this.issues().length)return;
  const branchId=this.branch.branchId();
  const canPrice=!!branchId&&this.access.canPrices();
  this.saving.set(true);this.error.set('');
  try{
   const product=await firstValueFrom(this.api.setupProduct(guidedSetupDto(
    this.draft(),canPrice?branchId:undefined)));
   this.created.set(product);
   this.createdNewArticle.set(this.kind()==='INVENTARIABLE'&&
    this.variants().some(v=>v.articuloModo==='nuevo'));
   this.prices.set(Object.fromEntries(product.preciosConfigurados.map(x=>[
    x.varianteId,{state:'saved' as const,amount:x.importe}])));
   this.notify.show('Producto y precios guardados en una operación.','success');
   try{if(branchId)this.readiness.set(await firstValueFrom(this.api.productReadiness(product.id,branchId)))}
   catch{/* Creation transaction is already completed; readiness is advisory. */}
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.saving.set(false)}
 }
}
