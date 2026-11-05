import {inject,Injectable} from '@angular/core';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {OrganizationAccess} from '../../organization/data-access/organization-access';
@Injectable({providedIn:'root'})
export class PurchasesAccess {
 private readonly branch=inject(GcBranchContext);
 private readonly global=inject(OrganizationAccess);
 private can(permission:string){return this.branch.has(permission)||this.global.canGlobal(permission)}
 canRead(){return this.can('purchases.read')}
 canSupplierManage(){return this.global.canGlobal('purchases.suppliers.manage')}
 canPresentationsManage(){return this.global.canGlobal('purchases.presentations.manage')}
 canOrdersCreate(){return this.can('purchases.orders.create')}
 canOrdersApprove(){return this.can('purchases.orders.approve')}
 canReceiptsCreate(){return this.can('purchases.receipts.create')}
 canReceiptsConfirm(){return this.can('purchases.receipts.confirm')}
 canQuickEntry(){return this.can('inventory.adjust')&&this.can('inventory.costs.manage')}
 canArticleManage(){return this.global.canGlobal('inventory.articles.manage')}
 canLotManage(){return this.global.canGlobal('inventory.articles.manage')}
 canSupplyRead(){return this.can('supply.read')}
 canSupplyRequest(){return this.can('supply.request')}
 canSupplySend(){return this.can('supply.send')}
 canSupplyReceive(){return this.can('supply.receive')}
 canSupplyCancel(){return this.can('supply.cancel')}
 canEnter(){return this.canRead()||this.canQuickEntry()||this.canReceiptsCreate()||
  this.canSupplierManage()||this.canPresentationsManage()||this.canOrdersCreate()||
  this.canSupplyRead()||this.canSupplyRequest()}
}
