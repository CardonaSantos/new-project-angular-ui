import {Component,inject} from '@angular/core';
import {RouterLink,RouterLinkActive} from '@angular/router';
import {OrdersAccess} from './data-access/orders-access';
import {PaymentsAccess} from '../payments/data-access/payments-access';
@Component({
 selector:'gc-orders-nav',imports:[RouterLink,RouterLinkActive],
 template:`<nav class="ord-nav" aria-label="Navegación de órdenes">
  @if(access.canCreate()){<a routerLink="/orders/pos" routerLinkActive="active" ariaCurrentWhenActive="page">Punto de venta</a>}
  @if(access.canRead()){<a routerLink="/orders/list" routerLinkActive="active" ariaCurrentWhenActive="page">Órdenes</a>}
  @if(access.canTablesRead()){<a routerLink="/orders/tables" routerLinkActive="active" ariaCurrentWhenActive="page">Mesas</a>}
  @if(access.canKitchenRead()){<a routerLink="/orders/kitchen" routerLinkActive="active" ariaCurrentWhenActive="page">Cocina</a>}
  @if(paymentsAccess.canRead()){<a routerLink="/payments/cash" routerLinkActive="active" ariaCurrentWhenActive="page">Cobros y caja</a>}
  @if(access.canKitchenManage()&&access.canKitchenRead()){
   <a routerLink="/orders/settings" routerLinkActive="active" ariaCurrentWhenActive="page">Configuración</a>}
 </nav>`,
})
export class GcOrdersNav{
 protected readonly access=inject(OrdersAccess);
 protected readonly paymentsAccess=inject(PaymentsAccess);
}
