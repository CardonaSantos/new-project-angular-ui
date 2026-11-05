import {Component,inject} from '@angular/core';
import {RouterLink,RouterLinkActive} from '@angular/router';
import {PaymentsAccess} from './data-access/payments-access';
@Component({
 selector:'gc-payments-cash-nav',
 imports:[RouterLink,RouterLinkActive],
 template:`<nav class="pay-cash-nav" aria-label="Secciones de caja">
  <a routerLink="/payments/cash" routerLinkActive="active"
   [routerLinkActiveOptions]="{exact:true}" ariaCurrentWhenActive="page">Mi caja</a>
  @if(access.canCashRead()){
   <a routerLink="/payments/cash/history" routerLinkActive="active" ariaCurrentWhenActive="page">Historial</a>
  }
  @if(access.canCashManage()){
   <a routerLink="/payments/cash/registers" routerLinkActive="active" ariaCurrentWhenActive="page">Administrar cajas</a>
  }
 </nav>`
})
export class GcPaymentsCashNav{protected readonly access=inject(PaymentsAccess)}
