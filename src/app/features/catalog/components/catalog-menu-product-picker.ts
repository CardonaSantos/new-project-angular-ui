import {Component,computed,inject,input,OnInit,output,signal} from '@angular/core';
import {Subject,debounceTime,distinctUntilChanged,firstValueFrom} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CatalogApi} from '../data-access/catalog.api';
import type {CatalogCategoryOption,CatalogProduct} from '../data-access/catalog.models';
import {gcErrorMessage} from '../../../core/http/api-error';

/** Bulk choice without losing selection as product search or category changes. */
export interface MenuPickedVariant {varianteId:string;nombre:string}
@Component({
 selector:'gc-catalog-menu-product-picker',
 template:`
 <section class="menu-picker" aria-label="Seleccionar productos para la sección">
  <div class="menu-picker-heading">
   <div><h4>Agregar productos</h4><p>Busca por nombre o categoría y marca los tamaños que quieres mostrar.</p></div>
   <button type="button" class="menu-picker-btn menu-picker-btn--outline"
    (click)="dismissed.emit()">Cerrar selector</button>
  </div>
  <div class="menu-picker-filters">
   <label>Buscar producto
    <input type="search" [value]="term()" (input)="search($any($event.target).value)"
     placeholder="Hamburguesa, capuchino, flan…" aria-label="Buscar productos por nombre"/></label>
   <label>Filtrar por categoría
    <select [value]="categoryId()" (change)="changeCategory($any($event.target).value)">
     <option value="">Todas las categorías</option>
     @for(c of categories();track c.id){<option [value]="c.id">{{c.label}}</option>}
    </select></label>
  </div>
  @if(loading()){<p role="status">Buscando productos…</p>}
  @if(error()){<p class="menu-picker-error" role="alert">{{error()}}</p>}
  <div class="menu-picker-results" role="group" aria-label="Productos encontrados">
   @for(product of products();track product.id){
    <div class="menu-picker-product">
     <div class="menu-picker-product-head">
      @if(product.imagenPrincipalUrl){
       <img [src]="product.imagenPrincipalUrl" alt="" loading="lazy" width="48" height="48"/>
      }@else{<span class="menu-picker-image" aria-hidden="true"><span>Sin foto</span></span>}
      <div><strong>{{product.nombre}}</strong>
       <span>{{product.varianteProductosComoProducto?.length??0}} presentaciones disponibles</span>
      </div>
     </div>
     <div class="menu-picker-variants">
      @for(v of product.varianteProductosComoProducto??[];track v.id){
       <label class="menu-picker-variant" [class.menu-picker-variant--checked]="!!selected()[v.id]">
        <input type="checkbox" [checked]="!!selected()[v.id]"
         [disabled]="existingVariantIds().includes(v.id)"
         (change)="toggle(v.id,product.nombre+' · '+v.nombre,$any($event.target).checked)"/>
        <span>{{v.nombre}}</span>
        @if(existingVariantIds().includes(v.id)){<small>Ya incluido</small>}
       </label>
      }@empty{<p class="menu-picker-muted">Este producto no tiene presentaciones activas.</p>}
     </div>
    </div>
   }@empty{
    @if(!loading()&&!error()){<p class="menu-picker-empty">No encontramos productos con esos filtros. Prueba otra búsqueda.</p>}
   }
  </div>
  @if(more()){<p class="menu-picker-muted">Hay más resultados. Escribe un nombre más específico para encontrarlos.</p>}
  <div class="menu-picker-footer">
   <strong aria-live="polite">{{selectionCount()}} seleccionadas</strong>
   <button type="button" class="menu-picker-btn menu-picker-btn--primary"
    [disabled]="selectionCount()===0" (click)="confirmSelection()">
    Agregar {{selectionCount()}} {{selectionCount()===1?'presentación':'presentaciones'}} a la sección
   </button>
  </div>
 </section>`,
 styleUrl:'./catalog-menu-product-picker.scss'
})
export class GcCatalogMenuProductPicker implements OnInit {
 readonly existingVariantIds=input<string[]>([]);
 readonly added=output<MenuPickedVariant[]>();
 readonly dismissed=output<void>();
 private readonly api=inject(CatalogApi);
 private readonly searchEvents=new Subject<string>();
 private generation=0;
 protected readonly term=signal('');
 protected readonly categoryId=signal('');
 protected readonly categories=signal<CatalogCategoryOption[]>([]);
 protected readonly products=signal<CatalogProduct[]>([]);
 protected readonly selected=signal<Record<string,MenuPickedVariant>>({});
 protected readonly loading=signal(false);
 protected readonly error=signal('');
 protected readonly more=signal(false);
 protected readonly selectionCount=computed(()=>Object.keys(this.selected()).length);
 constructor(){
  this.searchEvents.pipe(debounceTime(250),distinctUntilChanged(),takeUntilDestroyed())
   .subscribe(()=>void this.loadProducts());
 }
 ngOnInit(){void this.loadCategories();void this.loadProducts()}
 protected search(v:string){this.term.set(v);this.searchEvents.next(v)}
 protected changeCategory(v:string){this.categoryId.set(v);void this.loadProducts()}
 private async loadCategories(){
  try{
   const result=await firstValueFrom(this.api.categoryOptions({limit:50}));
   this.categories.set(result.data);
  }catch{ /* Product search remains usable without the category filter. */ }
 }
 private async loadProducts(){
  const request=++this.generation;
  this.loading.set(true);this.error.set('');
  try{
   const response=await firstValueFrom(this.api.productOptions({
    limit:50,search:this.term().trim(),...(this.categoryId()?{categoriaId:this.categoryId()}: {})
   }));
   if(request!==this.generation)return;
   this.products.set(response.data);this.more.set(response.meta.hasMore);
  }catch(e){if(request===this.generation){this.products.set([]);this.error.set(gcErrorMessage(e))}}
  finally{if(request===this.generation)this.loading.set(false)}
 }
 protected toggle(varianteId:string,nombre:string,checked:boolean){
  this.selected.update(current=>{
   const next={...current};
   if(checked&&!this.existingVariantIds().includes(varianteId))
    next[varianteId]={varianteId,nombre};
   else delete next[varianteId];
   return next;
  });
 }
 protected confirmSelection(){
  const items=Object.values(this.selected())
   .filter(x=>!this.existingVariantIds().includes(x.varianteId));
  if(!items.length)return;
  this.added.emit(items);
  this.selected.set({});
 }
}
