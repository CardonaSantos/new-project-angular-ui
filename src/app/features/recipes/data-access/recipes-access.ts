import {inject,Injectable} from '@angular/core';
import {OrganizationAccess} from '../../organization/data-access/organization-access';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
@Injectable({providedIn:'root'})
export class RecipesAccess {
 private readonly org=inject(OrganizationAccess);
 private readonly branch=inject(GcBranchContext);
 canRead(){return this.org.canGlobal('recipes.read')}
 canManage(){return this.org.canGlobal('recipes.manage')}
 canPublish(){return this.org.canGlobal('recipes.publish')}
 canProductionRead(){return this.org.canGlobal('recipes.production.read')||this.branch.has('recipes.production.read')}
 canProduce(){return this.org.canGlobal('recipes.produce')||this.branch.has('recipes.produce')}
 canSeeCosts(){return this.org.canGlobal('inventory.costs.read')||this.branch.has('inventory.costs.read')}
 canEnter(){return this.canRead()||this.canProductionRead()||this.canProduce()}
}
