import {inject,Injectable} from '@angular/core';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {OrganizationAccess} from '../../organization/data-access/organization-access';
@Injectable({providedIn:'root'})
export class DeliveryAccess{
 private readonly branch=inject(GcBranchContext);
 private readonly global=inject(OrganizationAccess);
 private can(permission:string){return this.branch.has(permission)||this.global.canGlobal(permission)}
 canRead(){return this.can('delivery.read')}
 canManage(){return this.can('delivery.manage')}
 canCourier(){return this.can('delivery.courier')}
 canCollectPayments(){return this.can('delivery.payments.collect')}
 canSettlementsRead(){return this.can('delivery.settlements.read')}
 canSettlementsManage(){return this.can('delivery.settlements.manage')}
 canPlatformManage(){return this.can('delivery.platform.manage')}
 canEnter(){return this.canRead()||this.canManage()||this.canCourier()}
}
