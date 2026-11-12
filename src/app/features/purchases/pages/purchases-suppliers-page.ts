import { Component, inject, signal, effect, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GcBranchContext } from '../../../core/organization/gc-branch-context';
import { gcErrorMessage } from '../../../core/http/api-error';
import { GcNotificationService } from '../../../core/ux/gc-notification.service';
import { ConfirmDialogService } from '../../../design-system/confirm-dialog/confirm-dialog.service';
import { PurchasesApi } from '../data-access/purchases.api';
import { PurchasesAccess } from '../data-access/purchases-access';
import type { PurchaseSupplier } from '../data-access/purchases.models';
import { GcPurchasesNav } from '../purchases-nav';
@Component({
  selector: 'gc-purchases-suppliers-page',
  imports: [GcPurchasesNav],
  template: `<main class="pur-page">
    <gc-purchases-nav />
    <header class="pur-heading">
      <div><h1>Proveedores</h1></div>
      @if (access.canSupplierManage()) {
        <button type="button" class="pur-primary" (click)="startNew()">Nuevo proveedor</button>
      }
    </header>
    @if (editing() && access.canSupplierManage()) {
      <section class="pur-card">
        <div class="pur-heading">
          <h2>{{ editId() ? 'Editar proveedor' : 'Nuevo proveedor' }}</h2>
          <button type="button" (click)="cancelEdit()" [disabled]="saving()">Cerrar</button>
        </div>
        <form (submit)="$event.preventDefault(); save()">
          <div class="pur-grid">
            <div class="pur-field">
              <label for="pur-sup-name">Nombre</label>
              <input
                id="pur-sup-name"
                [value]="name()"
                maxlength="160"
                required
                (input)="name.set($any($event.target).value)"
                placeholder="Ej. Distribuidora Central"
              />
            </div>
            <div class="pur-field">
              <label for="pur-sup-nit">NIT (opcional)</label>
              <input
                id="pur-sup-nit"
                [value]="nit()"
                maxlength="60"
                (input)="nit.set($any($event.target).value)"
              />
            </div>
            <div class="pur-field">
              <label for="pur-sup-phone">Teléfono</label>
              <input
                id="pur-sup-phone"
                [value]="phone()"
                maxlength="80"
                (input)="phone.set($any($event.target).value)"
              />
            </div>
            <div class="pur-field">
              <label for="pur-sup-email">Correo</label>
              <input
                id="pur-sup-email"
                type="email"
                [value]="email()"
                maxlength="160"
                (input)="email.set($any($event.target).value)"
              />
            </div>
          </div>
          <div class="pur-field">
            <label for="pur-sup-address">Dirección (opcional)</label>
            <textarea
              id="pur-sup-address"
              rows="2"
              [value]="address()"
              maxlength="500"
              (input)="address.set($any($event.target).value)"
            ></textarea>
          </div>
          @if (formError()) {
            <p class="pur-alert" role="alert">{{ formError() }}</p>
          }
          <div class="pur-actions" style="margin-top: 16px;">
            <button
              type="submit"
              class="pur-primary p-2"
              [disabled]="saving() || name().trim().length < 2"
            >
              {{ saving() ? 'Guardando…' : 'Guardar proveedor' }}
            </button>

            <button type="button" (click)="cancelEdit()" [disabled]="saving()">Cancelar</button>
          </div>
        </form>
      </section>
    }
    <section class="pur-card">
      <div class="pur-heading">
        <h2>Directorio</h2>
        <button type="button" (click)="load()" [disabled]="busy()">Actualizar</button>
      </div>
      <div class="pur-grid">
        <div class="pur-field">
          <label for="pur-sup-search">Buscar nombre o NIT</label>
          <input
            id="pur-sup-search"
            type="search"
            [value]="search()"
            (input)="search.set($any($event.target).value)"
            (keyup.enter)="apply()"
            placeholder="Nombre o NIT"
            maxlength="100"
          />
        </div>
        <div class="pur-actions">
          <button type="button" (click)="apply()" [disabled]="busy()">Buscar</button>
          @if (search() || applied()) {
            <button type="button" (click)="clear()">Limpiar</button>
          }
        </div>
      </div>
      @if (error()) {
        <p class="pur-alert" role="alert">{{ error() }}</p>
      }
      @if (busy()) {
        <p class="pur-muted" role="status">Consultando proveedores…</p>
      }
      <div class="pur-table-scroll">
        <table class="pur-table">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>NIT</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (s of rows(); track s.id) {
              <tr class="pur-data-row">
                <td data-label="Nombre">
                  <strong>{{ s.nombre }}</strong>
                </td>
                <td data-label="NIT">{{ s.nit || '—' }}</td>
                <td data-label="Teléfono">{{ s.telefono || '—' }}</td>
                <td data-label="Estado">
                  <span class="pur-badge">{{ s.activo ? 'Activo' : 'Inactivo' }}</span>
                </td>
                <td data-label="Acción">
                  <div class="pur-actions">
                    @if (access.canSupplierManage()) {
                      <button type="button" (click)="startEdit(s)">Editar</button>
                      <button type="button" (click)="toggle(s)" [disabled]="saving()">
                        {{ s.activo ? 'Desactivar' : 'Activar' }}
                      </button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              @if (!busy()) {
                <tr>
                  <td colspan="5" class="pur-empty">No hay proveedores.</td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
      <div class="pur-pagination">
        <span class="pur-muted"
          >{{ total() }} proveedores · Página {{ page() }} de {{ pages() || 1 }}</span
        >
        <div class="pur-actions">
          <button type="button" [disabled]="page() <= 1 || busy()" (click)="changePage(-1)">
            Anterior
          </button>
          <button type="button" [disabled]="page() >= pages() || busy()" (click)="changePage(1)">
            Siguiente
          </button>
        </div>
      </div>
    </section>
  </main>`,
  styleUrl: '../purchases.scss',
})
export class GcPurchasesSuppliersPage {
  private readonly api = inject(PurchasesApi);
  private readonly context = inject(GcBranchContext);
  protected readonly access = inject(PurchasesAccess);
  private readonly notice = inject(GcNotificationService);
  private readonly confirm = inject(ConfirmDialogService);
  protected readonly rows = signal<PurchaseSupplier[]>([]);
  protected readonly page = signal(1);
  protected readonly pages = signal(0);
  protected readonly total = signal(0);
  protected readonly search = signal('');
  protected readonly applied = signal('');
  protected readonly busy = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly formError = signal('');
  protected readonly editing = signal(false);
  protected readonly editId = signal('');
  protected readonly name = signal('');
  protected readonly nit = signal('');
  protected readonly email = signal('');
  protected readonly phone = signal('');
  protected readonly address = signal('');
  private generation = 0;
  constructor() {
    effect(() => {
      this.context.branchId();
      untracked(() => {
        this.page.set(1);
        void this.load();
      });
    });
  }
  protected startNew() {
    this.editId.set('');
    this.name.set('');
    this.nit.set('');
    this.phone.set('');
    this.email.set('');
    this.address.set('');
    this.formError.set('');
    this.editing.set(true);
  }
  protected startEdit(s: PurchaseSupplier) {
    this.editId.set(s.id);
    this.name.set(s.nombre);
    this.nit.set(s.nit ?? '');
    this.phone.set(s.telefono ?? '');
    this.email.set(s.email ?? '');
    this.address.set(s.direccion ?? '');
    this.formError.set('');
    this.editing.set(true);
  }
  protected cancelEdit() {
    this.editing.set(false);
    this.formError.set('');
  }
  protected apply() {
    this.applied.set(this.search().trim());
    this.page.set(1);
    void this.load();
  }
  protected clear() {
    this.search.set('');
    this.applied.set('');
    this.page.set(1);
    void this.load();
  }
  protected changePage(d: number) {
    const next = this.page() + d;
    if (next < 1 || next > this.pages() || this.busy()) return;
    this.page.set(next);
    void this.load();
  }
  protected async load() {
    if (!this.access.canRead()) return;
    const gen = ++this.generation;
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(
        this.api.suppliers({
          sucursalId: this.context.branchId() ?? undefined,
          search: this.applied(),
          page: this.page(),
          limit: 20,
        }),
      );
      if (gen === this.generation) {
        this.rows.set(result.data);
        this.total.set(result.meta.total);
        this.pages.set(result.meta.totalPages);
      }
    } catch (e) {
      if (gen === this.generation) this.error.set(gcErrorMessage(e));
    } finally {
      if (gen === this.generation) this.busy.set(false);
    }
  }
  protected async save() {
    if (this.saving() || !this.access.canSupplierManage()) return;
    const name = this.name().trim();
    if (name.length < 2) return;
    this.saving.set(true);
    this.formError.set('');
    const body = {
      nombre: name,
      nit: this.nit().trim(),
      telefono: this.phone().trim(),
      email: this.email().trim(),
      direccion: this.address().trim(),
    };
    try {
      if (this.editId()) await firstValueFrom(this.api.updateSupplier(this.editId(), body));
      else await firstValueFrom(this.api.createSupplier(body));
      this.notice.show('Proveedor guardado.', 'success');
      this.cancelEdit();
      await this.load();
    } catch (e) {
      this.formError.set(gcErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }
  protected async toggle(s: PurchaseSupplier) {
    if (this.saving() || !this.access.canSupplierManage()) return;
    const approved = await this.confirm.confirm({
      title: (s.activo ? 'Desactivar' : 'Activar') + ' proveedor',
      message: s.activo
        ? 'No se podrá desactivar si tiene compras activas.'
        : 'El proveedor quedará disponible para nuevas compras.',
      confirmText: s.activo ? 'Desactivar' : 'Activar',
      danger: s.activo,
    });
    if (!approved) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.api.supplierStatus(s.id, !s.activo));
      this.notice.show('Estado del proveedor actualizado.', 'success');
      await this.load();
    } catch (e) {
      this.error.set(gcErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }
}
