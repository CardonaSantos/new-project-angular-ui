
import {Component} from '@angular/core';
import {RouterLink,RouterLinkActive} from '@angular/router';
@Component({
 selector:'gc-inventory-nav',imports:[RouterLink,RouterLinkActive],
 template:`
 <nav class="inv-tabs" aria-label="Módulo de inventario">
  <a routerLink="/inventory/summary" routerLinkActive="active" ariaCurrentWhenActive="page">Resumen</a>
  <a routerLink="/inventory/articles" routerLinkActive="active" ariaCurrentWhenActive="page">Artículos</a>
  <a routerLink="/inventory/stock" routerLinkActive="active" ariaCurrentWhenActive="page">Existencias</a>
  <a routerLink="/inventory/operations/movements" routerLinkActive="active" ariaCurrentWhenActive="page">Operaciones</a>
  <a routerLink="/inventory/settings/warehouses" routerLinkActive="active" ariaCurrentWhenActive="page">Configuración</a>
  <a routerLink="/inventory/reports" routerLinkActive="active" ariaCurrentWhenActive="page">Reportes</a>
 </nav>`,
 styleUrl:'./inventory.scss'
})
export class GcInventoryNav {}
