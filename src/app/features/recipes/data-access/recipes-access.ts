import {inject,Injectable} from '@angular/core';
import {OrganizationAccess} from '../../organization/data-access/organization-access';
@Injectable({providedIn:'root'})
export class RecipesAccess {
 private readonly org=inject(OrganizationAccess);
 canRead(){return this.org.canGlobal('recipes.read')}
 canManage(){return this.org.canGlobal('recipes.manage')}
 canPublish(){return this.org.canGlobal('recipes.publish')}
 canEnter(){return this.canRead()||this.canManage()||this.canPublish()}
}
