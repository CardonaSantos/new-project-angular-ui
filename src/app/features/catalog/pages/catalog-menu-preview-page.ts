import {Component,computed,inject,signal,OnInit} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {formatCurrency} from '../../../shared/formatting';
import {GcCatalogNav} from '../catalog-nav';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {CatalogApi} from '../data-access/catalog.api';
import {CatalogAccess} from '../data-access/catalog-access';
import type {CatalogBranchMenu} from '../data-access/catalog.models';

@Component({
 selector:'gc-catalog-menu-preview-page',
 imports:[GcCatalogNav,GcErrorState,RouterLink,GcSearchSelect],
 template:`
 <main class="cat-page cat-menu-preview">
  <gc-catalog-nav/>
  <header class="cat-menu-preview-header">
   <div><h1>Vista de la carta publicada</h1>
    <p>Así verán los productos disponibles en el POS de la sucursal elegida.</p>
   </div>
   <a class="cat-menu-preview-button" routerLink="/catalog/menus">Editar cartas</a>
  </header>
  <section class="cat-card cat-menu-preview-filters">
   <div class="cat-menu-preview-filter-row">
    <gc-search-select id="cat-menu-preview-branch" label="Sucursal" [items]="branchChoices()"
     [value]="branchId()" [clearable]="false" (valueChange)="branchId.set($event)"/>
    <label class="cat-menu-preview-field">Fecha y hora
     <input type="datetime-local" [value]="localDate()"
      (change)="localDate.set($any($event.target).value)"/></label>
    <div class="cat-menu-preview-filter-actions">
     <button type="button" class="cat-menu-preview-button cat-menu-preview-button--primary"
      (click)="load()" [disabled]="busy()||!branchId()">Actualizar carta</button>
     <button type="button" class="cat-menu-preview-button" (click)="now()" [disabled]="busy()">
      Ver ahora</button>
    </div>
   </div>
   <p class="cat-muted">La carta refleja la publicación vigente para esa fecha; no muestra cambios de borradores.</p>
   @if(busy()){<p role="status" class="cat-muted">Consultando carta publicada…</p>}
   @if(error()){<gc-error-state [message]="error()!" (retry)="load()"/>}
  </section>
  @if(result();as data){
   <p class="cat-menu-preview-context">
    Sucursal: {{branchName()}} · Fecha local: {{data.horaLocal}}
   </p>
   @for(menu of visibleMenus();track menu.id){
    <section class="cat-menu-printed">
     <header class="cat-menu-printed-header">
      <div><h2>{{menu.nombre}}</h2>
       @if(menu.descripcion){<p>{{menu.descripcion}}</p>}
      </div>
      <a class="cat-menu-preview-button" [routerLink]="['/catalog/menus',menu.id]">Editar esta carta</a>
     </header>
     <nav class="cat-menu-preview-index" aria-label="Secciones de la carta">
      @for(section of menu.secciones;track section.id){
       <a [href]="'#menu-section-'+section.id">{{section.nombre}}</a>
      }
     </nav>
     @for(section of menu.secciones;track section.id){
      <section class="cat-menu-preview-section" [id]="'menu-section-'+section.id">
       <h3>{{section.nombre}}</h3>
       <div class="cat-menu-preview-grid">
        @for(item of section.items;track item.id){
         <article class="cat-menu-preview-card">
          @if(item.variante.imagenPrincipalUrl){
           <img [src]="item.variante.imagenPrincipalUrl" alt=""
            class="cat-menu-preview-photo" loading="lazy"/>
          }@else{
           <div class="cat-menu-preview-placeholder" aria-label="Producto sin fotografía">
            <span>Sin foto</span>
           </div>
          }
          <div class="cat-menu-preview-card-body">
           <h4>{{item.variante.producto?.nombre??'Producto'}}</h4>
           <p class="cat-menu-preview-variant">{{item.variante.nombre}}</p>
           <strong class="cat-menu-preview-price">{{money(item.precio,item.moneda)}}</strong>
           @if(item.gruposModificadores.length){
            <details class="cat-menu-preview-extras">
             <summary>Ver opciones y extras</summary>
             @for(group of item.gruposModificadores;track group.grupoId){
              <div class="cat-menu-preview-extras-group">
               <strong>{{group.grupo}}</strong>
               <span>{{group.minimo>0?'Debes elegir al menos '+group.minimo:'Opcional'}}</span>
               @for(option of group.opciones;track option.id){
                <div class="cat-menu-preview-extra">
                 <span>{{option.nombre}}</span>
                 <span>{{money(option.recargo,item.moneda)}}</span>
                </div>
               }
              </div>
             }
            </details>
           }
          </div>
         </article>
        }@empty{<p class="cat-menu-preview-empty">No hay productos disponibles en esta sección.</p>}
       </div>
      </section>
     }
    </section>
   }@empty{
    <section class="cat-card"><p role="status">No hay cartas publicadas y vigentes para esta sucursal y fecha.</p></section>
   }
   <p class="cat-muted">Las existencias pueden cambiar durante el día; el POS vuelve a validar cada venta.</p>
  }

 </main>`,
 styleUrl:'../catalog.scss'
})
export class GcCatalogMenuPreviewPage implements OnInit {
 protected readonly access=inject(CatalogAccess);
 private readonly route=inject(ActivatedRoute);
 private readonly selectedMenuId=this.route.snapshot.queryParamMap.get('menuId')??'';
 protected readonly branches=inject(GcBranchContext);
 private readonly api=inject(CatalogApi);
 protected readonly branchId=signal('');
 protected readonly branchChoices=computed(()=>this.branches.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly localDate=signal('');
 protected readonly result=signal<CatalogBranchMenu|null>(null);
 protected readonly visibleMenus=computed(()=>{
  const menus=this.result()?.menus??[];
  return this.selectedMenuId?menus.filter(m=>m.id===this.selectedMenuId):menus;
 });
 protected readonly branchName=computed(()=>
  this.branches.branches().find(b=>b.id===this.branchId())?.nombre??'Sin sucursal');
 protected readonly busy=signal(false);
 protected readonly error=signal<string|null>(null);
 private requestGeneration=0;
 ngOnInit(){this.branchId.set(this.branches.branchId()??this.branches.branches()[0]?.id??'');void this.load()}
 protected now(){this.localDate.set('');void this.load()}
 protected money(value:string,currency:string){
  try{return formatCurrency(value,currency==='USD'?'USD':'GTQ')}catch{return '—'}
 }
 private dateIso(){
  const value=this.localDate();
  if(!value)return undefined;
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))throw new Error('Introduce una fecha y hora válida.');
  return date.toISOString();
 }
 protected async load(){
  const id=this.branchId();if(!id||!this.access.canRead())return;
  const generation=++this.requestGeneration;
  this.busy.set(true);this.error.set(null);this.result.set(null);
  try{
   const result=await firstValueFrom(this.api.branchMenu(id,this.dateIso()));
   if(generation===this.requestGeneration)this.result.set(result);
  }catch(e){
   if(generation===this.requestGeneration)this.error.set(gcErrorMessage(e));
  }finally{if(generation===this.requestGeneration)this.busy.set(false)}
 }
}
