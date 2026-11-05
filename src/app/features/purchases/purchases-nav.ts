import {Component,inject} from '@angular/core';
import {RouterLink,RouterLinkActive} from '@angular/router';
import {PurchasesAccess} from './data-access/purchases-access';
@Component({
 selector:'gc-purchases-nav',
 imports:[RouterLink,RouterLinkActive],
 template:`<nav class="pur-tabs" aria-label="Compras y abastecimiento">
  @if(access.canQuickEntry()){
   <a routerLink="/purchases/quick" routerLinkActive="active" ariaCurrentWhenActive="page">Entrada rápida</a>
  }
  @if(access.canRead()||access.canReceiptsCreate()){
   <a routerLink="/purchases/receipts" routerLinkActive="active" ariaCurrentWhenActive="page">Recepciones</a>
  }
  @if(access.canRead()||access.canSupplierManage()){
   <a routerLink="/purchases/suppliers" routerLinkActive="active" ariaCurrentWhenActive="page">Proveedores</a>
  }
  @if(access.canRead()||access.canOrdersCreate()){
   <a routerLink="/purchases/orders" routerLinkActive="active" ariaCurrentWhenActive="page">Órdenes de compra</a>
  }
  @if(access.canRead()||access.canPresentationsManage()){
   <a routerLink="/purchases/presentations" routerLinkActive="active" ariaCurrentWhenActive="page">Presentaciones</a>
  }
  @if(access.canSupplyRead()||access.canSupplyRequest()){
   <a routerLink="/purchases/requisitions" routerLinkActive="active" ariaCurrentWhenActive="page">Requisiciones</a>
  }
 </nav>`,
 styleUrl:'./purchases.scss'
})
export class GcPurchasesNav {
 protected readonly access=inject(PurchasesAccess);
}
