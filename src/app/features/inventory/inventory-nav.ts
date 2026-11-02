
import {Component,inject,signal} from '@angular/core';
import {Router,NavigationEnd} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {filter} from 'rxjs';
import {RouterLink,RouterLinkActive} from '@angular/router';
@Component({
 selector:'gc-inventory-nav',imports:[RouterLink,RouterLinkActive],
 template:`
 <nav class="inv-tabs" aria-label="Módulo de inventario">
  <a routerLink="/inventory/summary" routerLinkActive="active" ariaCurrentWhenActive="page">Resumen</a>
  <a routerLink="/inventory/articles" routerLinkActive="active" ariaCurrentWhenActive="page">Artículos</a>
  <a routerLink="/inventory/stock" routerLinkActive="active" ariaCurrentWhenActive="page">Existencias</a>
  <a routerLink="/inventory/operations/movements"
   [class.active]="current().startsWith('/inventory/operations')"
   [attr.aria-current]="current().startsWith('/inventory/operations')?'page':null">Operaciones</a>
  <a routerLink="/inventory/settings/warehouses"
   [class.active]="current().startsWith('/inventory/settings')"
   [attr.aria-current]="current().startsWith('/inventory/settings')?'page':null">Configuración</a>
  <a routerLink="/inventory/reports" routerLinkActive="active" ariaCurrentWhenActive="page">Reportes</a>
 </nav>`,
 styleUrl:'./inventory.scss'
})
export class GcInventoryNav {
 private readonly router=inject(Router);
 protected readonly current=signal(this.router.url);
 constructor(){
  this.router.events.pipe(
   filter((e):e is NavigationEnd=>e instanceof NavigationEnd),
   takeUntilDestroyed()
  ).subscribe(e=>this.current.set(e.urlAfterRedirects));
 }
}
