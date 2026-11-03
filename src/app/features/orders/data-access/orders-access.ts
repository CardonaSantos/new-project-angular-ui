import {inject,Injectable} from '@angular/core';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {OrganizationAccess} from '../../organization/data-access/organization-access';

@Injectable({providedIn:'root'})
export class OrdersAccess{
 private readonly branch=inject(GcBranchContext);
 private readonly org=inject(OrganizationAccess);
 private has(perm:string){return this.branch.has(perm)||this.org.canGlobal(perm)}
 canRead(){return this.has('orders.read')}
 canViewDetail(){return this.canRead()||this.canCreate()||this.canManage()}
 canCreate(){return this.has('orders.create')}
 canManage(){return this.has('orders.manage')}
 canDiscount(){return this.has('orders.discount')}
 canCancelPrepared(){return this.has('orders.cancel.prepared')}
 // Read endpoints require read permissions; manage-only is not interchangeable.
 canTablesRead(){return this.has('tables.read')}
 canTablesManage(){return this.has('tables.manage')}
 canKitchenRead(){return this.has('kitchen.read')}
 canKitchenManage(){return this.has('kitchen.manage')}
 canEnter(){return this.canViewDetail()||this.canTablesRead()||this.canKitchenRead()}
}
