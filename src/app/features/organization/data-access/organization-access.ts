import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GcBranchesApi } from '../../../core/organization/gc-branches.api';
import { GcBranchContext } from '../../../core/organization/gc-branch-context';

@Injectable({ providedIn: 'root' })
export class OrganizationAccess {
  private readonly branchApi = inject(GcBranchesApi);
  private readonly context = inject(GcBranchContext);
  private readonly global = signal<readonly string[]>([]);
  private generation = 0;
  readonly loaded = signal(false);
  readonly globalPermissions = computed(() => this.global());
  canGlobal(permission: string) { return this.loaded() && this.global().includes(permission); }
  canBranch(permission: string, branchId: string) {
    return this.context.branchId() === branchId && this.context.has(permission);
  }

  async load(): Promise<void> {
    const generation = ++this.generation;
    this.loaded.set(false);
    this.global.set([]);
    try {
      const response = await firstValueFrom(this.branchApi.capabilities(null));
      if (generation === this.generation) this.global.set(response.permissions);
    } finally {
      if (generation === this.generation) this.loaded.set(true);
    }
  }
  reset(): void {
    this.generation++;
    this.global.set([]);
    this.loaded.set(false);
  }
}
