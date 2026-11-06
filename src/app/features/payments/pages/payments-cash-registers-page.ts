import {Component,effect,inject,untracked} from '@angular/core';
import {RouterLink} from '@angular/router';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPaymentsNav} from '../payments-nav';
import {GcPaymentsCashNav} from '../payments-cash-nav';
import {CashContext} from '../data-access/cash-context';
import {PaymentsAccess} from '../data-access/payments-access';
@Component({
 selector:'gc-payments-cash-registers-page',
 imports:[RouterLink,GcPaymentsNav,GcPaymentsCashNav],
 template:`<main class="ord-page pay-page pay-cash-page">
  <gc-payments-nav/><gc-payments-cash-nav/>
  <div class="ord-heading">
   <h1>Administrar cajas</h1>
   @if(access.canCashManage()){
    <a class="ord-primary" routerLink="/payments/cash/registers/new">Nueva caja</a>
   }
  </div>
  <section class="ord-card">
   @if(cash.error()){<p class="ord-alert" role="alert">{{cash.error()}}</p>}
   @if(cash.loading()){<p role="status">Consultando cajas…</p>}
   <div class="pay-cash-history">
    @for(register of cash.registers();track register.id){
     <div class="pay-cash-ledger-row">
      <div><strong>{{register.nombre}}</strong>
       <small>{{register.codigo}} · {{register.activa?'Activa':'Inactiva'}}</small></div>
      @if(access.canCashManage()){
       <a [routerLink]="['/payments/cash/registers',register.id]"
        [attr.aria-label]="'Configurar '+register.nombre">Configurar</a>
      }
     </div>
    } @empty {
     @if(!cash.loading()){<p class="ord-muted">No hay cajas configuradas en esta sucursal.</p>}
    }
   </div>
  </section>
 </main>`
})
export class GcPaymentsCashRegistersPage{
 private readonly branch=inject(GcBranchContext);
 protected readonly access=inject(PaymentsAccess);
 protected readonly cash=inject(CashContext);
 constructor(){effect(()=>{if(this.branch.branchId())void untracked(()=>this.cash.refresh(true))})}
}
