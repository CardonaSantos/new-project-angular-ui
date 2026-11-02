import {Component} from '@angular/core';
import {RouterLink,RouterLinkActive} from '@angular/router';
@Component({
 selector:'gc-catalog-nav',imports:[RouterLink,RouterLinkActive],
 template:`
 <nav class="cat-nav" aria-label="Navegación de catálogo comercial">
  <a routerLink="/catalog/summary" routerLinkActive="active" ariaCurrentWhenActive="page">Resumen</a>
  <a routerLink="/catalog/products" routerLinkActive="active" ariaCurrentWhenActive="page">Productos</a>
  <a routerLink="/catalog/categories" routerLinkActive="active" ariaCurrentWhenActive="page">Categorías</a>
  <a routerLink="/catalog/extras" routerLinkActive="active" ariaCurrentWhenActive="page">Extras</a>
  <a routerLink="/catalog/prices" routerLinkActive="active" ariaCurrentWhenActive="page">Precios</a>
 </nav>`,
 styleUrl:'./catalog.scss'
})
export class GcCatalogNav {}
