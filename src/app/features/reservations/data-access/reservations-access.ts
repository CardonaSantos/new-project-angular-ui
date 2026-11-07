
import {inject,Injectable} from '@angular/core';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {OrganizationAccess} from '../../organization/data-access/organization-access';
@Injectable({providedIn:'root'})
export class ReservationsAccess{
 private readonly branch=inject(GcBranchContext);
 private readonly global=inject(OrganizationAccess);
 private can(permission:string){return this.branch.has(permission)||this.global.canGlobal(permission)}
 canRead(){return this.can('reservations.read')}
 canManage(){return this.can('reservations.manage')}
 canEnter(){return this.canRead()||this.canManage()}
}
