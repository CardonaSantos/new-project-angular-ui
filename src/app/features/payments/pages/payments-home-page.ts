import {Component,computed,effect,inject} from '@angular/core';
import {Router,RouterLink} from '@angular/router';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {PaymentsAccess} from '../data-access/payments-access';
@Component({
 selector:'gc-payments-home-page',imports:[RouterLink],
 template:`<main class="ord-page pay-page"><section class="ord-card">
  <h1>Pagos y caja</h1>
  @if(!branch.branchId()){<p>Selecciona una sucursal.</p>}
  @else if(!target()){<p>No tienes acceso a estas operaciones.</p>}
  @else {<p>Abriendo tu área de trabajo…</p><a [routerLink]="target()">Continuar</a>}
 </section></main>`
})
export class GcPaymentsHomePage{
 protected readonly branch=inject(GcBranchContext);
 private readonly access=inject(PaymentsAccess);
 private readonly router=inject(Router);
 protected readonly target=computed(()=>this.access.canCashRead()?'/payments/cash':
  this.access.canSalesRead()?'/payments/sales':
  this.access.canRead()?'/orders/list':'');
 constructor(){effect(()=>{const t=this.target();if(t&&this.branch.branchId())void this.router.navigateByUrl(t,{replaceUrl:true})})}
}
