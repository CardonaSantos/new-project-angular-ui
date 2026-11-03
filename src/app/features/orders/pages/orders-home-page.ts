import {Component,computed,effect,inject} from '@angular/core';
import {Router,RouterLink} from '@angular/router';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {OrdersAccess} from '../data-access/orders-access';
/** Route user to the shortest authorized operational flow. Never show a dead POS to KDS-only staff. */
@Component({
 selector:'gc-orders-home-page',
 imports:[RouterLink],
 template:`<main class="ord-page">
  <section class="ord-card">
   <h1>Órdenes</h1>
   @if(!branch.branchId()){<p>Selecciona una sucursal para continuar.</p>}
   @else if(!target()){<p>No tienes acceso a una estación de trabajo en esta sucursal.</p>}
   @else {<p>Abriendo tu estación de trabajo…</p>
    <a [routerLink]="target()">Continuar</a>}
  </section>
 </main>`
})
export class GcOrdersHomePage{
 protected readonly branch=inject(GcBranchContext);
 private readonly router=inject(Router);
 private readonly access=inject(OrdersAccess);
 protected readonly target=computed(()=>
  this.access.canCreate()?'/orders/pos':
  this.access.canKitchenRead()?'/orders/kitchen':
  this.access.canTablesRead()?'/orders/tables':
  this.access.canRead()?'/orders/list':'');
 constructor(){effect(()=>{
  const dest=this.target();
  if(dest&&this.branch.branchId())void this.router.navigateByUrl(dest,{replaceUrl:true});
 })}
}
