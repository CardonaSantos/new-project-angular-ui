import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GcBranchesApi } from '../../../core/organization/gc-branches.api';
import { GcBranchContext } from '../../../core/organization/gc-branch-context';

@Injectable({ providedIn: 'root' })
export class OrganizationAccess {
  private readonly branchApi = inject(GcBranchesApi);
  private readonly context = inject(GcBranchContext);
  private readonly global = signal<readonly string[]>([]);
  readonly loaded = signal(false);
  readonly globalPermissions = computed(() => this.global());
  canGlobal(permission: string) { return this.loaded() && this.global().includes(permission); }
  canBranch(permission: string, branchId: string) {
    return this.context.branchId() === branchId && this.context.has(permission);
  }

  async load(): Promise<void> {
    this.loaded.set(false);
    try {
      const response = await firstValueFrom(this.branchApi.capabilities(null));
      this.global.set(response.permissions);
    } finally {
      this.loaded.set(true);
    }
  }
}
