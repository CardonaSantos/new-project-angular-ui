import {Component,inject} from '@angular/core';
import {RouterLink,RouterLinkActive} from '@angular/router';
import {PaymentsAccess} from './data-access/payments-access';
@Component({
 selector:'gc-payments-nav',imports:[RouterLink,RouterLinkActive],
 template:`<nav class="ord-nav pay-nav" aria-label="Pagos y caja">
  @if(access.canCashRead()){<a routerLink="/payments/cash" routerLinkActive="active" ariaCurrentWhenActive="page">Caja y turnos</a>}
  @if(access.canSalesRead()){<a routerLink="/payments/sales" routerLinkActive="active" ariaCurrentWhenActive="page">Ventas</a>}
  @if(access.canCashRead()){<a routerLink="/payments/reports" routerLinkActive="active" ariaCurrentWhenActive="page">Resumen</a>}
  <a routerLink="/orders/list">Órdenes</a>
 </nav>`
})
export class GcPaymentsNav{protected readonly access=inject(PaymentsAccess)}
