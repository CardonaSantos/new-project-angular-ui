import {inject,Injectable} from '@angular/core';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {OrganizationAccess} from '../../organization/data-access/organization-access';
@Injectable({providedIn:'root'})
export class PaymentsAccess{
 private readonly branch=inject(GcBranchContext);
 private readonly org=inject(OrganizationAccess);
 private has(p:string){return this.branch.has(p)||this.org.canGlobal(p)}
 canRead(){return this.has('payments.read')}
 canCollect(){return this.has('payments.collect')}
 canSplit(){return this.has('payments.split')}
 canVerify(){return this.has('payments.verify')}
 canRefund(){return this.has('payments.refund')}
 canCashRead(){return this.has('cash.read')}
 canOpen(){return this.has('cash.open')}
 canClose(){return this.has('cash.close')}
 canCashManage(){return this.has('cash.manage')}
 canSalesRead(){return this.has('sales.read')}
 canEnter(){return this.canRead()||this.canCollect()||this.canCashRead()||this.canSalesRead()}
}
