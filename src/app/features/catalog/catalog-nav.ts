import {Component,inject} from '@angular/core';
import {CatalogAccess} from './data-access/catalog-access';
import {RouterLink,RouterLinkActive} from '@angular/router';
@Component({
 selector:'gc-catalog-nav',imports:[RouterLink,RouterLinkActive],
 template:`
 <nav class="cat-nav" aria-label="Navegación de catálogo comercial">
  <a routerLink="/catalog/summary" routerLinkActive="active" ariaCurrentWhenActive="page">Resumen</a>
  @if(access.canRead()){
   <a routerLink="/catalog/products" routerLinkActive="active" ariaCurrentWhenActive="page">Productos</a>
   <a routerLink="/catalog/categories" routerLinkActive="active" ariaCurrentWhenActive="page">Categorías</a>
   <a routerLink="/catalog/extras" routerLinkActive="active" ariaCurrentWhenActive="page">Extras</a>
   <a routerLink="/catalog/menus" routerLinkActive="active" ariaCurrentWhenActive="page">Cartas</a>
   <a routerLink="/catalog/preview" routerLinkActive="active" ariaCurrentWhenActive="page">Vista de la carta</a>
   <details class="cat-nav-advanced">
    <summary>Más opciones</summary>
    <div class="cat-nav-advanced-links">
     <a routerLink="/catalog/prices" routerLinkActive="active" ariaCurrentWhenActive="page">
      Tarifas e historial de precios</a>
    </div>
   </details>
  }
  @if(access.canReports()){
   <a routerLink="/catalog/reports" routerLinkActive="active" ariaCurrentWhenActive="page">Reportes</a>
  }
 </nav>`,
 styleUrl:'./catalog.scss'
})
export class GcCatalogNav {protected readonly access=inject(CatalogAccess)}
