import {Component,computed,effect,inject,signal} from '@angular/core';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {toSignal} from '@angular/core/rxjs-interop';
import {firstValueFrom} from 'rxjs';
import {MatDialog} from '@angular/material/dialog';
import {GcImagePreviewDialog} from '../../../design-system/media/gc-image-preview-dialog';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcCatalogNav} from '../catalog-nav';
import {CatalogApi} from '../data-access/catalog.api';
import {CatalogAccess} from '../data-access/catalog-access';
import {PRODUCT_KINDS,type CatalogProduct,type CatalogCategory,type CatalogPage} from '../data-access/catalog.models';

@Component({
 selector:'gc-catalog-products-page',imports:[RouterLink,GcCatalogNav,GcErrorState],
 template:`
 <main class="cat-page">
  <gc-catalog-nav/>
  <section class="cat-card">
   <div class="cat-row"><h2>Productos comerciales</h2>
    @if(access.canManage()){<a class="cat-primary" routerLink="/catalog/products/new">Nuevo producto</a>}
   </div>
   <div class="cat-toolbar">
    <label class="cat-field">Buscar producto
     <input [value]="search()" (input)="search.set($any($event.target).value)" (keyup.enter)="applySearch()"
      maxlength="120" placeholder="Nombre o código"/>
    </label>
    <button type="button" (click)="applySearch()">Buscar</button>
    <label class="cat-field">Categoría
     <select [value]="category()" (change)="patch({categoriaId:$any($event.target).value||null,page:null})">
      <option value="" [selected]="!category()">Todas</option>
      @for(item of categories();track item.id){<option [value]="item.id" [selected]="item.id===category()">{{item.nombre}}</option>}
     </select>
    </label>
    <label class="cat-field">Tipo
     <select [value]="kind()" (change)="patch({tipo:$any($event.target).value||null,page:null})">
      <option value="">Todos</option>
      @for(item of kinds;track item.value){<option [value]="item.value">{{item.label}}</option>}
     </select>
    </label>
    <label class="cat-field">Estado
     <select [value]="state()" (change)="patch({activo:$any($event.target).value||null,page:null})">
      <option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option>
     </select>
    </label>
   </div>
   @if(page.busy()){<p role="status" class="cat-muted">Consultando productos…</p>}
   @if(page.status()==='error'){<gc-error-state [message]="error()" (retry)="reload()"/>}
   @if(page.data();as result){
    <div class="cat-table-wrap">
     <table class="cat-table"><thead><tr>
      <th>Fotografía</th><th>Producto</th><th>Categoría</th><th>Tipo</th>
      <th>Variantes</th><th>Estado</th><th>Acción</th>
     </tr></thead><tbody>
      @for(item of result.data;track item.id){
       <tr><td>
        @if(item.imagenPrincipalUrl){
         <button type="button" class="cat-photo-button" (click)="preview(item.imagenPrincipalUrl,item.nombre)">
          <img [src]="item.imagenPrincipalUrl" [alt]="'Ampliar '+item.nombre" loading="lazy"/>
         </button>
        } @else {<span class="cat-photo-empty" aria-label="Sin fotografía">IMG</span>}
       </td><td><strong>{{item.nombre}}</strong><div class="cat-muted">{{item.codigo}}</div></td>
       <td>{{item.categoria?.nombre??'Sin categoría'}}</td>
       <td>{{kindLabel(item.tipo)}}</td>
       <td>{{item.varianteProductosComoProducto?.length??0}}</td>
       <td>{{item.activo?(item.visibleEnMenu?'Visible en menú':'Activo, no visible'):'Inactivo'}}</td>
       <td><a [routerLink]="['/catalog/products',item.id]">Detalles</a></td></tr>
      } @empty {<tr><td colspan="7">No hay productos con estos filtros.</td></tr>}
     </tbody></table>
    </div>
    <div class="cat-row cat-muted"><span>{{result.meta.total}} registros · Página {{result.meta.page}} / {{result.meta.totalPages||1}}</span>
     <div class="cat-actions">
      <button type="button" (click)="changePage(-1)" [disabled]="currentPage()<=1">Anterior</button>
      <button type="button" (click)="changePage(1)" [disabled]="currentPage()>=result.meta.totalPages">Siguiente</button>
     </div>
    </div>
   }
  </section>
 </main>`,
 styleUrl:'../catalog.scss'
})
export class GcCatalogProductsPage {
 protected readonly access=inject(CatalogAccess);
 private readonly api=inject(CatalogApi);
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly dialog=inject(MatDialog);
 private readonly query=toSignal(this.route.queryParamMap,{initialValue:this.route.snapshot.queryParamMap});
 protected readonly page=new GcPageState<CatalogPage<CatalogProduct>>();
 protected readonly search=signal('');
 protected readonly categories=signal<CatalogCategory[]>([]);
 protected readonly kinds=PRODUCT_KINDS;
 protected readonly currentPage=computed(()=>Math.max(1,Number(this.query().get('page')||1)||1));
 protected readonly kind=computed(()=>this.query().get('tipo')??'');
 protected readonly category=computed(()=>this.query().get('categoriaId')??'');
 protected readonly state=computed(()=>this.query().get('activo')??'');
 constructor(){
  effect(()=>{
   const q=this.query(),page=this.currentPage(),tipo=this.kind(),cat=this.category(),state=this.state();
   const search=q.get('search')??'';this.search.set(search);
   void this.load(page,search,tipo,cat,state);
  });
  void this.loadCategories();
 }
 private async loadCategories(){
  try{this.categories.set((await firstValueFrom(this.api.categoryTree())).data.flatMap(x=>this.flatten(x)))}catch{/* optional filter */}
 }
 private flatten(x:CatalogCategory):CatalogCategory[]{return [x,...(x.children??[]).flatMap(c=>this.flatten(c))]}
 private async load(page:number,search:string,tipo:string,categoriaId:string,activo:string){
  if(!this.access.canRead())return;
  await this.page.load(()=>firstValueFrom(this.api.products({page,limit:20,search,
   tipo:PRODUCT_KINDS.find(x=>x.value===tipo)?.value,categoriaId:categoriaId||undefined,
   activo:activo===''?undefined:activo==='true'
  })));
 }
 protected reload(){void this.load(this.currentPage(),this.query().get('search')??'',this.kind(),this.category(),this.state())}
 protected error(){return gcErrorMessage(this.page.error())}
 protected kindLabel(v:string){return PRODUCT_KINDS.find(x=>x.value===v)?.label??v}
 protected applySearch(){void this.patch({search:this.search().trim()||null,page:null})}
 protected changePage(d:number){void this.patch({page:String(Math.max(1,this.currentPage()+d))})}
 protected patch(values:Record<string,string|null>){void this.router.navigate([],{
  relativeTo:this.route,queryParams:values,queryParamsHandling:'merge'
 })}
 protected preview(url:string,alt:string){this.dialog.open(GcImagePreviewDialog,{
  data:{url,alt},width:'min(94vw,720px)',maxWidth:'94vw',restoreFocus:true,
  ariaLabel:'Fotografía de producto'
 })}
}
