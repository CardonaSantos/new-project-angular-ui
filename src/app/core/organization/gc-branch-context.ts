import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, switchMap, tap, throwError } from 'rxjs';
import type { GcBranch } from '../auth/gc-auth.models';
import { GcBranchesApi } from './gc-branches.api';

/** The selected branch is a scope selector, not proof of authorization. */
@Injectable({ providedIn: 'root' })
export class GcBranchContext {
  private readonly api = inject(GcBranchesApi);
  readonly branches = signal<readonly GcBranch[]>([]);
  readonly branchId = signal<string | null>(null);
  readonly permissions = signal<readonly string[]>([]);
  readonly loading = signal(false);
  readonly active = computed(() => this.branches().find(branch => branch.id === this.branchId()) ?? null);
  private generation = 0;

  has(permission: string): boolean { return this.permissions().includes(permission); }

  load(): Observable<void> {
    return this.api.myAccess().pipe(
      tap(branches => this.branches.set(branches)),
      switchMap(branches => {
        const chosen = branches.some(branch => branch.id === this.branchId())
          ? this.branchId() : branches[0]?.id ?? null;
        return this.select(chosen);
      }),
      map(() => undefined),
    );
  }

  select(id: string | null): Observable<boolean> {
    if (id !== null && !this.branches().some(branch => branch.id === id)) {
      return throwError(() => new Error('La sucursal no está entre tus accesos autorizados.'));
    }
    const generation = ++this.generation;
    this.branchId.set(id);
    this.permissions.set([]);
    this.loading.set(true);
    return this.api.capabilities(id).pipe(
      tap(result => {
        if (generation === this.generation && result.sucursalId === id) {
          this.permissions.set(result.permissions);
        }
      }),
      map(() => generation === this.generation),
      catchError(error => {
        if (generation === this.generation) this.permissions.set([]);
        return throwError(() => error);
      }),
      finalize(() => { if (generation === this.generation) this.loading.set(false); }),
    );
  }

  reset(): void {
    this.generation++;
    this.branches.set([]);
    this.branchId.set(null);
    this.permissions.set([]);
    this.loading.set(false);
  }
}
