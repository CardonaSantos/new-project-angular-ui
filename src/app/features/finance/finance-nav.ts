
import {Component,inject,signal} from '@angular/core';
import {Router,NavigationEnd} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {filter} from 'rxjs';
import {RouterLink,RouterLinkActive} from '@angular/router';
@Component({
 selector:'gc-finance-nav',imports:[RouterLink,RouterLinkActive],
 template:`
 <nav class="fin-tabs" aria-label="Módulo de finanzas">
  <a routerLink="/finance/accounts" routerLinkActive="active" ariaCurrentWhenActive="page">Cuentas</a>
  <a routerLink="/finance/expenses" routerLinkActive="active" ariaCurrentWhenActive="page">Gastos</a>
  <a routerLink="/finance/reconciliation" routerLinkActive="active" ariaCurrentWhenActive="page">Conciliación</a>
  <a routerLink="/finance/routing" routerLinkActive="active" ariaCurrentWhenActive="page">Enrutamiento</a>
 </nav>`,
 styleUrl:'./finance.scss'
})
export class GcFinanceNav {
 private readonly router=inject(Router);
 protected readonly current=signal(this.router.url);
 constructor(){
  this.router.events.pipe(
   filter((e):e is NavigationEnd=>e instanceof NavigationEnd),
   takeUntilDestroyed()
  ).subscribe(e=>this.current.set(e.urlAfterRedirects));
 }
}
