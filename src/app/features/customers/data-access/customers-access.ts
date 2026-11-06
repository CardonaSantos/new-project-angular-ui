
import {inject,Injectable} from '@angular/core';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {OrganizationAccess} from '../../organization/data-access/organization-access';
@Injectable({providedIn:'root'})
export class CustomersAccess{
 private readonly branch=inject(GcBranchContext);
 private readonly global=inject(OrganizationAccess);
 private can(permission:string){return this.branch.has(permission)||this.global.canGlobal(permission)}
 canRead(){return this.can('customers.read')}
 canCreate(){return this.can('customers.create')}
 canManage(){return this.can('customers.manage')}
 canGlobalManage(){return this.can('customers.global.manage')}
 canEnter(){return this.canRead()||this.canCreate()||this.canManage()}
}
