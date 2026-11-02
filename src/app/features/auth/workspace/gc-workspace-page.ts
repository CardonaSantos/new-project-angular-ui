import { Component, inject, signal } from '@angular/core';
import { GcSessionService } from '../../../core/auth/gc-session.service';
import { GcBranchContext } from '../../../core/organization/gc-branch-context';
import { GcButtonDirective } from '../../../design-system/components/button/gc-button.directive';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { gcErrorMessage } from '../../../core/http/api-error';

@Component({
  selector: 'gc-workspace-page',
  imports: [GcButtonDirective],
  template: `
    <section class="gc-page-enter gc-stack">
      <header>
        <p class="gc-muted">INICIO / SESIÓN REAL</p>
        <h1>Bienvenido, {{ session.user()?.nombre }}</h1>
        <p class="gc-muted">Infraestructura conectada a Gastro Core. Los módulos de negocio se integrarán aquí.</p>
      </header>
      <section class="gc-surface gc-stack">
        <h2>Sucursal activa</h2>
        <p>{{ branch.active()?.nombre ?? 'Sin sucursales asignadas' }}</p>
        <p class="gc-muted">Permisos efectivos: {{ branch.permissions().length }}. El servidor valida cada operación.</p>
        <label for="gc-real-branch">Cambiar sucursal</label>
        <select id="gc-real-branch" [value]="branch.branchId() ?? ''"
          [disabled]="branch.loading() || branch.branches().length === 0"
          (change)="chooseBranch($any($event.target).value)">
          @for (item of branch.branches(); track item.id) {
            <option [value]="item.id">{{ item.nombre }} ({{ item.codigo }})</option>
          }
        </select>
        @if (branch.loading()) { <p role="status">Consultando permisos de sucursal…</p> }
        @if (error()) { <p role="alert" class="gc-error-text">{{ error() }}</p> }
        <button gcButton variant="outline" type="button" [disabled]="busy()" (click)="logout()">
          Cerrar sesión
        </button>
      </section>
    </section>
  `,
  styles: [`
    :host { display:block; }
    .gc-stack { display:grid; gap:1rem; }
    h1,h2 { margin:.25rem 0; }
    select { width:min(100%,28rem); min-height:2.75rem; padding:.5rem;
      border:1px solid var(--gc-outline); border-radius:.5rem;
      color:var(--gc-on-surface); background:var(--gc-surface); }
    button { justify-self:start; }
    .gc-error-text { color:var(--gc-error); }
  `],
})
export class GcWorkspacePage {
  protected readonly session = inject(GcSessionService);
  protected readonly branch = inject(GcBranchContext);
  private readonly router = inject(Router);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected async chooseBranch(id: string): Promise<void> {
    this.error.set(null);
    try {
      await firstValueFrom(this.branch.select(id));
    } catch (error: unknown) {
      this.error.set(gcErrorMessage(error));
    }
  }

  protected async logout(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.session.logout());
      await this.router.navigateByUrl('/login');
    } catch (error: unknown) {
      this.error.set(gcErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
