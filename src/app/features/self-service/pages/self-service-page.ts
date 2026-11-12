import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { gcErrorMessage } from '../../../core/http/api-error';
import { SelfServiceApi } from '../data-access/self-service.api';
import { SelfServiceSessionStore } from '../data-access/self-service-session.store';
import type {
  SelfServiceMenuItem, SelfServiceModifierGroup, SelfServiceMenuResponse, SelfServiceCart,
} from '../data-access/self-service.models';

type PickerSelection = Record<string, string[]>; // grupoId -> opcionId[]

@Component({
  selector: 'gc-self-service-page',
  styles: [`
    .ss-page{min-height:100vh;background:var(--gc-surface);color:var(--gc-on-surface);
      font-size:16px;display:flex;flex-direction:column;padding-bottom:5.5rem}
    .ss-center{min-height:100vh;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:.75rem;padding:2rem;text-align:center}
    .ss-header{position:sticky;top:0;z-index:5;background:var(--gc-primary);color:var(--gc-on-primary);
      padding:1rem 1.1rem;display:flex;flex-direction:column;gap:.15rem}
    .ss-header h1{font-size:1.15rem;margin:0;font-weight:600}
    .ss-header .ss-sub{font-size:.85rem;opacity:.85}
    .ss-menu{padding:1rem}
    .ss-menu h2{font-size:1.3rem;margin:1.4rem 0 .4rem}
    .ss-section h3{font-size:1rem;margin:1rem 0 .5rem;color:var(--gc-on-surface-variant)}
    .ss-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.75rem}
    .ss-item{background:var(--gc-surface-container-low);border:1px solid var(--gc-outline-variant);
      border-radius:var(--gc-radius);padding:.75rem;text-align:left;cursor:pointer;
      display:flex;flex-direction:column;gap:.35rem;min-height:5.5rem}
    .ss-item img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:calc(var(--gc-radius) - 6px)}
    .ss-item .ss-name{font-weight:600;font-size:.92rem;line-height:1.25}
    .ss-item .ss-price{color:var(--gc-primary);font-weight:600;font-size:.9rem}
    .ss-bar{position:fixed;bottom:0;left:0;right:0;background:var(--gc-primary);color:var(--gc-on-primary);
      padding:.9rem 1.1rem;display:flex;align-items:center;justify-content:space-between;
      border-top-left-radius:var(--gc-radius);border-top-right-radius:var(--gc-radius);
      box-shadow:0 -4px 16px rgba(0,0,0,.18);cursor:pointer}
    .ss-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;
      justify-content:center;z-index:20}
    .ss-sheet{background:var(--gc-surface);width:100%;max-width:560px;border-top-left-radius:16px;
      border-top-right-radius:16px;padding:1.1rem;max-height:88vh;overflow-y:auto;
      display:flex;flex-direction:column;gap:.9rem}
    .ss-sheet h2{margin:0;font-size:1.2rem}
    .ss-row{display:flex;align-items:center;justify-content:space-between;gap:.75rem}
    .ss-qty{display:flex;align-items:center;gap:.6rem}
    .ss-qty button{width:2.3rem;height:2.3rem;border-radius:999px;border:1px solid var(--gc-outline-variant);
      background:var(--gc-surface-container-low);font-size:1.1rem;cursor:pointer}
    .ss-group{display:flex;flex-direction:column;gap:.4rem}
    .ss-group .ss-group-title{font-weight:600;font-size:.9rem}
    .ss-group .ss-group-hint{font-size:.78rem;color:var(--gc-on-surface-variant)}
    .ss-opt{display:flex;align-items:center;gap:.6rem;padding:.55rem .2rem;border-bottom:1px solid var(--gc-outline-variant)}
    .ss-notes textarea{width:100%;border-radius:10px;border:1px solid var(--gc-outline-variant);
      padding:.6rem;font:inherit;resize:vertical;min-height:3rem}
    .ss-primary{background:var(--gc-primary);color:var(--gc-on-primary);border:none;border-radius:999px;
      padding:.8rem 1.1rem;font-weight:600;font-size:1rem;cursor:pointer}
    .ss-primary:disabled{opacity:.5;cursor:not-allowed}
    .ss-ghost{background:transparent;border:1px solid var(--gc-outline-variant);border-radius:999px;
      padding:.6rem 1rem;font-size:.9rem;cursor:pointer;color:var(--gc-on-surface)}
    .ss-cart-line{display:flex;justify-content:space-between;gap:.75rem;padding:.5rem 0;
      border-bottom:1px solid var(--gc-outline-variant);font-size:.92rem}
    .ss-banner{background:var(--gc-primary-container);color:var(--gc-on-primary-container);
      border-radius:var(--gc-radius);padding:.7rem .9rem;font-size:.9rem}
    .ss-error{color:var(--gc-error)}
  `],
  template: `
    @if (loading()) {
      <div class="ss-center"><p>Cargando tu mesa…</p></div>
    } @else if (fatalError()) {
      <div class="ss-center">
        <h1>No se pudo abrir tu pedido</h1>
        <p class="ss-error">{{ fatalError() }}</p>
        <p>Pide ayuda a un mesero o vuelve a escanear el código QR de tu mesa.</p>
      </div>
    } @else {
      <div class="ss-page">
        <header class="ss-header">
          <h1>{{ access()!.sucursal.nombre }}</h1>
          <span class="ss-sub">Mesa {{ access()!.mesa.numero }} · {{ access()!.mesa.sala }}</span>
        </header>

        @if (actionError()) {
          <div class="ss-menu">
            <p class="ss-error">{{ actionError() }}</p>
            <button class="ss-ghost" type="button" (click)="retryLoad()">Reintentar</button>
          </div>
        }
        @if (sentBanner()) {
          <div class="ss-menu"><p class="ss-banner">Tu pedido se envió a cocina. Puedes seguir agregando más.</p></div>
        }

        <section class="ss-menu">
          @for (card of menu()?.menus ?? []; track card.id) {
            <h2>{{ card.nombre }}</h2>
            @for (section of card.secciones; track section.id) {
              <div class="ss-section">
                <h3>{{ section.nombre }}</h3>
                <div class="ss-grid">
                  @for (item of section.items; track item.id) {
                    <button class="ss-item" type="button" (click)="openItem(item)">
                      @if (item.imagenUrl) { <img [src]="item.imagenUrl" [alt]="item.nombre"> }
                      <span class="ss-name">{{ item.nombre }}</span>
                      <span class="ss-price">{{ item.precio }} {{ item.moneda }}</span>
                    </button>
                  }
                </div>
              </div>
            }
          } @empty {
            <p>El menú no tiene artículos disponibles en este momento.</p>
          }
        </section>

        <footer class="ss-bar" (click)="cartOpen.set(true)">
          <span>{{ cartCount() }} artículo(s)</span>
          <span>{{ cartTotal() }}</span>
        </footer>
      </div>

      @if (selectedItem(); as item) {
        <div class="ss-overlay" (click)="closeItem()">
          <div class="ss-sheet" (click)="$event.stopPropagation()">
            <h2>{{ item.nombre }}</h2>
            @if (item.descripcion) { <p>{{ item.descripcion }}</p> }

            <div class="ss-row">
              <span>Cantidad</span>
              <div class="ss-qty">
                <button type="button" (click)="qty.set(Math.max(1, qty() - 1))">−</button>
                <span>{{ qty() }}</span>
                <button type="button" (click)="qty.set(qty() + 1)">+</button>
              </div>
            </div>

            @for (group of item.gruposModificadores; track group.grupoId) {
              <div class="ss-group">
                <span class="ss-group-title">{{ group.grupo }}</span>
                @if (group.minimo > 0) {
                  <span class="ss-group-hint">Elige {{ group.maximo > 1 ? ('entre ' + group.minimo + ' y ' + group.maximo) : group.minimo }}</span>
                }
                @for (opt of group.opciones; track opt.id) {
                  <label class="ss-opt">
                    <input [type]="group.maximo === 1 ? 'radio' : 'checkbox'"
                      [name]="group.grupoId"
                      [checked]="isChecked(group.grupoId, opt.id)"
                      (change)="toggleOption(group, opt.id)">
                    <span>{{ opt.nombre }}</span>
                    @if (opt.recargo !== '0.00') { <span>(+{{ opt.recargo }})</span> }
                  </label>
                }
              </div>
            }

            <div class="ss-notes">
              <label for="ss-notes">Notas para cocina (opcional)</label>
              <textarea id="ss-notes" [value]="notes()" (input)="notes.set($any($event.target).value)"
                maxlength="300" placeholder="Ej. sin cebolla"></textarea>
            </div>

            @if (pickerError()) { <p class="ss-error">{{ pickerError() }}</p> }

            <div class="ss-row">
              <button class="ss-ghost" type="button" (click)="closeItem()">Cancelar</button>
              <button class="ss-primary" type="button" [disabled]="adding()" (click)="confirmAdd(item)">
                {{ adding() ? 'Agregando…' : 'Agregar al pedido' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (cartOpen()) {
        <div class="ss-overlay" (click)="cartOpen.set(false)">
          <div class="ss-sheet" (click)="$event.stopPropagation()">
            <h2>Tu pedido</h2>
            @for (line of cart()?.orden?.lineas ?? []; track line.id) {
              <div class="ss-cart-line">
                <span>{{ line.cantidad }}× {{ line.nombre }}</span>
                <span>{{ line.subtotal }}</span>
              </div>
            } @empty {
              <p>Todavía no has agregado nada.</p>
            }
            <div class="ss-row"><strong>Total</strong><strong>{{ cart()?.orden?.total ?? '0.00' }}</strong></div>
            @if (sendError()) { <p class="ss-error">{{ sendError() }}</p> }
            <div class="ss-row">
              <button class="ss-ghost" type="button" (click)="cartOpen.set(false)">Seguir viendo el menú</button>
              <button class="ss-primary" type="button" [disabled]="sending() || !cart()?.ordenId" (click)="sendOrder()">
                {{ sending() ? 'Enviando…' : 'Enviar pedido a cocina' }}
              </button>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class GcSelfServicePage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(SelfServiceApi);
  private readonly sessionStore = inject(SelfServiceSessionStore);
  protected readonly Math = Math;

  protected readonly loading = signal(true);
  protected readonly fatalError = signal<string | null>(null);
  protected readonly access = this.sessionStore.access;
  protected readonly menu = signal<SelfServiceMenuResponse | null>(null);
  protected readonly cart = signal<SelfServiceCart | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly sentBanner = signal(false);

  protected readonly selectedItem = signal<SelfServiceMenuItem | null>(null);
  protected readonly qty = signal(1);
  protected readonly picks = signal<PickerSelection>({});
  protected readonly notes = signal('');
  protected readonly adding = signal(false);
  protected readonly pickerError = signal<string | null>(null);

  protected readonly cartOpen = signal(false);
  protected readonly sending = signal(false);
  protected readonly sendError = signal<string | null>(null);

  protected readonly cartCount = computed(() =>
    (this.cart()?.orden?.lineas ?? []).reduce((n, l) => n + Math.round(Number(l.cantidad)), 0));
  protected readonly cartTotal = computed(() => {
    const t = this.cart()?.orden?.total ?? '0.00';
    const moneda = this.access()?.sucursal.moneda ?? '';
    return moneda ? `${t} ${moneda}` : t;
  });

  private token = '';

  constructor() {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    void this.bootstrap();
  }

  private async bootstrap() {
    if (!this.token) { this.fatalError.set('Enlace inválido.'); this.loading.set(false); return; }
    try {
      const restored = this.sessionStore.restore(this.token);
      if (!restored) {
        const result = await firstValueFrom(this.api.access(this.token));
        this.sessionStore.save(this.token, result);
      }
    } catch (e) {
      this.sessionStore.clear();
      this.fatalError.set(gcErrorMessage(e));
      this.loading.set(false);
      return;
    }
    await this.loadMenuAndCart();
    this.loading.set(false);
  }

  /** Unlike an access() failure, a failed menu/cart fetch doesn't mean the
   * table session itself is invalid — keep it and let the customer retry. */
  private async loadMenuAndCart() {
    this.actionError.set(null);
    const token = this.access()!.sessionToken;
    try {
      const [menu, cart] = await Promise.all([
        firstValueFrom(this.api.menu(token)), firstValueFrom(this.api.cart(token)),
      ]);
      this.menu.set(menu);
      this.cart.set(cart);
    } catch (e) {
      this.actionError.set(gcErrorMessage(e));
    }
  }

  protected retryLoad(): void { void this.loadMenuAndCart(); }

  protected openItem(item: SelfServiceMenuItem): void {
    this.selectedItem.set(item);
    this.qty.set(1);
    this.notes.set('');
    this.pickerError.set(null);
    const initial: PickerSelection = {};
    for (const g of item.gruposModificadores) initial[g.grupoId] = [];
    this.picks.set(initial);
  }
  protected closeItem(): void { this.selectedItem.set(null); }

  protected isChecked(grupoId: string, opcionId: string): boolean {
    return (this.picks()[grupoId] ?? []).includes(opcionId);
  }
  protected toggleOption(group: SelfServiceModifierGroup, opcionId: string): void {
    const current = this.picks();
    const have = current[group.grupoId] ?? [];
    if (group.maximo === 1) {
      this.picks.set({ ...current, [group.grupoId]: [opcionId] });
      return;
    }
    const exists = have.includes(opcionId);
    const next = exists ? have.filter(id => id !== opcionId)
      : have.length < group.maximo ? [...have, opcionId] : have;
    this.picks.set({ ...current, [group.grupoId]: next });
  }

  protected async confirmAdd(item: SelfServiceMenuItem): Promise<void> {
    this.pickerError.set(null);
    const picks = this.picks();
    for (const g of item.gruposModificadores) {
      const chosen = picks[g.grupoId] ?? [];
      if (chosen.length < g.minimo) {
        this.pickerError.set(`Elige al menos ${g.minimo} opción(es) en «${g.grupo}».`);
        return;
      }
    }
    this.adding.set(true);
    try {
      const modificadores = Object.values(picks).flat().map(opcionId => ({ modificadorId: opcionId }));
      const result = await firstValueFrom(this.api.addItems(this.access()!.sessionToken, [{
        varianteId: item.varianteId, cantidad: String(this.qty()),
        modificadores: modificadores.length ? modificadores : undefined,
        notasCocina: this.notes().trim() || undefined,
      }]));
      this.cart.set(result);
      this.sentBanner.set(false);
      this.closeItem();
    } catch (e) {
      this.pickerError.set(gcErrorMessage(e));
    } finally {
      this.adding.set(false);
    }
  }

  protected async sendOrder(): Promise<void> {
    this.sendError.set(null);
    this.sending.set(true);
    try {
      const result = await firstValueFrom(this.api.send(this.access()!.sessionToken));
      this.cart.set(result);
      this.cartOpen.set(false);
      this.sentBanner.set(true);
    } catch (e) {
      this.sendError.set(gcErrorMessage(e));
    } finally {
      this.sending.set(false);
    }
  }
}
