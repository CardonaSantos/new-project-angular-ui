import {Injectable,inject} from '@angular/core';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {OrganizationAccess} from '../../organization/data-access/organization-access';
import type {CatalogPermission} from './catalog.models';

/** UI capabilities are for affordances only. NestJS remains the authority for every request. */
@Injectable({providedIn:'root'})
export class CatalogAccess {
 private readonly org=inject(OrganizationAccess);
 private readonly branch=inject(GcBranchContext);
 global(permission:CatalogPermission){return this.org.canGlobal(permission)}
 branchHas(permission:CatalogPermission){return this.branch.has(permission)}
 canRead(){return this.global('catalog.read')||this.branchHas('catalog.read')}
 canManage(){return this.global('catalog.manage')}
 canManageBranch(){return this.global('catalog.manage')||this.branchHas('catalog.manage')}
 canPrices(){return this.global('catalog.prices.manage')||this.branchHas('catalog.prices.manage')}
 canMenus(){return this.global('catalog.menus.manage')}
 canReports(){return this.global('catalog.reports.read')||this.branchHas('catalog.reports.read')}
 canEnter(){return this.canRead()||this.canReports()}
}
