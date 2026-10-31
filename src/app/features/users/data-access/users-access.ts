
import { Injectable,inject,signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GcBranchesApi } from '../../../core/organization/gc-branches.api';
import { GcBranchContext } from '../../../core/organization/gc-branch-context';

/** UI hints only. Server enforces all administrative and branch permissions. */
@Injectable({providedIn:'root'})
export class UsersAccess {
  private readonly api=inject(GcBranchesApi);
  private readonly branch=inject(GcBranchContext);
  private readonly global=signal<readonly string[]>([]);
  readonly loaded=signal(false);
  canGlobal(permission:string){return this.loaded()&&this.global().includes(permission)}
  canBranch(permission:string){return this.branch.has(permission)}
  canRead(){return this.canGlobal('users.read')||this.canBranch('users.read')}
  isGlobalAdmin(){return this.canGlobal('users.create')&&this.canGlobal('users.update')}
  async load():Promise<void>{
    this.loaded.set(false);this.global.set([]);
    try {const result=await firstValueFrom(this.api.capabilities(null));this.global.set(result.permissions);}
    finally{this.loaded.set(true)}
  }
  clear(){this.global.set([]);this.loaded.set(false)}
}
