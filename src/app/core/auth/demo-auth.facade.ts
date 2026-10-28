import { Injectable, computed, signal } from '@angular/core';

export type DemoRole = 'manager' | 'cashier' | 'viewer';
export type GcPermission =
  | 'catalog.read' | 'catalog.write'
  | 'orders.read' | 'orders.manage' | 'orders.cancel'
  | 'inventory.read' | 'inventory.adjust'
  | 'settings.manage';

export interface GcBranch { id: string; name: string }
export interface GcIdentity {
  id: string;
  name: string;
  email: string;
  role: DemoRole;
  branches: readonly GcBranch[];
  permissions: readonly GcPermission[];
}
export type GcAuthStatus = 'anonymous' | 'checking' | 'authenticated' | 'expired';

/**
 * UI-only session seam. Demo credentials and permissions are NOT security.
 * Replace with an API adapter when NestJS contracts are verified.
 */
@Injectable({ providedIn: 'root' })
export class GcAuthFacade {
  readonly status = signal<GcAuthStatus>('anonymous');
  readonly identity = signal<GcIdentity | null>(null);
  readonly branchId = signal<string | null>(null);

  readonly authenticated = computed(() => this.status() === 'authenticated' && this.identity() !== null);
  readonly branch = computed(() => this.identity()?.branches.find((b) => b.id === this.branchId()) ?? null);

  readonly permissions = computed<readonly GcPermission[]>(() =>
    this.authenticated() && this.branch() ? this.identity()?.permissions ?? [] : [],
  );

  has(permission: GcPermission): boolean { return this.permissions().includes(permission); }
  hasAny(permissions: readonly GcPermission[]): boolean { return permissions.some((p) => this.has(p)); }
  hasAll(permissions: readonly GcPermission[]): boolean { return permissions.every((p) => this.has(p)); }

  startDemo(role: DemoRole): void {
    const branches: readonly GcBranch[] = [
      { id: 'demo-central', name: 'Sucursal Central (demo)' },
      { id: 'demo-norte', name: 'Sucursal Norte (demo)' },
    ];
    const permissions: Record<DemoRole, readonly GcPermission[]> = {
      manager: ['catalog.read', 'catalog.write', 'orders.read', 'orders.manage', 'orders.cancel',
        'inventory.read', 'inventory.adjust', 'settings.manage'],
      cashier: ['catalog.read', 'orders.read', 'orders.manage', 'inventory.read'],
      viewer: ['catalog.read', 'orders.read', 'inventory.read'],
    };
    this.identity.set({
      id: 'demo-' + role,
      name: role === 'manager' ? 'Gerencia Demo' : role === 'cashier' ? 'Caja Demo' : 'Consulta Demo',
      email: role + '@example.invalid',
      role,
      branches,
      permissions: permissions[role],
    });
    this.branchId.set(branches[0].id);
    this.status.set('authenticated');
  }

  switchBranch(id: string): boolean {
    if (!this.authenticated() || !this.identity()?.branches.some((branch) => branch.id === id)) return false;
    this.branchId.set(id);
    return true;
  }

  expire(): void {
    this.identity.set(null);
    this.branchId.set(null);
    this.status.set('expired');
  }

  logout(): void {
    this.identity.set(null);
    this.branchId.set(null);
    this.status.set('anonymous');
  }
}
