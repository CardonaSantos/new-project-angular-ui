import {inject,Injectable} from '@angular/core';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {OrganizationAccess} from '../../organization/data-access/organization-access';

@Injectable({providedIn:'root'})
export class OrdersAccess{
 private readonly branch=inject(GcBranchContext);
 private readonly org=inject(OrganizationAccess);
 private has(perm:string){return this.branch.has(perm)||this.org.canGlobal(perm)}
 canRead(){return this.has('orders.read')||this.has('orders.manage')||this.has('orders.create')}
 canCreate(){return this.has('orders.create')}
 canManage(){return this.has('orders.manage')}
 canDiscount(){return this.has('orders.discount')}
 canCancelPrepared(){return this.has('orders.cancel.prepared')}
 canTablesRead(){return this.has('tables.read')||this.has('tables.manage')}
 canTablesManage(){return this.has('tables.manage')}
 canKitchenRead(){return this.has('kitchen.read')||this.has('kitchen.manage')}
 canKitchenManage(){return this.has('kitchen.manage')}
 canEnter(){return this.canRead()||this.canTablesRead()||this.canKitchenRead()}
}
