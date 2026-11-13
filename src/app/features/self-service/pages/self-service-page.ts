import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { gcErrorMessage } from '../../../core/http/api-error';
import { SelfServiceApi } from '../data-access/self-service.api';
import { SelfServiceSessionStore } from '../data-access/self-service-session.store';
import type {
  SelfServiceMenuItem, SelfServiceModifierGroup, SelfServiceMenuResponse, SelfServiceCart,
  SelfServiceOrderLine, SelfServiceMenuCard,
} from '../data-access/self-service.models';

type PickerSelection = Record<string, string[]>; // grupoId -> opcionId[]

@Component({
  selector: 'gc-self-service-page',
  styles: [`
    @keyframes ss-pop-in{from{opacity:0;transform:scale(.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes ss-fade-in{from{opacity:0}to{opacity:1}}
    @keyframes ss-slide-in-right{from{transform:translateX(100%)}to{transform:translateX(0)}}
    @keyframes ss-bump{0%{transform:scale(1)}30%{transform:scale(1.06)}55%{transform:scale(.98)}100%{transform:scale(1)}}
    @keyframes ss-check-pop{0%{transform:scale(1)}45%{transform:scale(1.35)}100%{transform:scale(1)}}
    @keyframes ss-flash{0%{background:var(--gc-primary-container)}100%{background:transparent}}
    @keyframes ss-ring{0%{box-shadow:0 0 0 0 rgba(0,0,0,.18)}100%{box-shadow:0 0 0 10px rgba(0,0,0,0)}}

    .ss-page{min-height:100vh;background:var(--gc-surface);color:var(--gc-on-surface);
      font-size:16px;display:flex;flex-direction:column;padding-bottom:5.5rem}
    .ss-center{min-height:100vh;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:.75rem;padding:2rem;text-align:center}
    .ss-header{position:sticky;top:0;z-index:5;background:var(--gc-primary);color:var(--gc-on-primary);
      padding:.9rem 1.1rem;display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem}
    .ss-header .ss-identity{display:flex;flex-direction:column;gap:.15rem;min-width:0}
    .ss-header h1{font-size:1.1rem;margin:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ss-header .ss-sub{font-size:.82rem;opacity:.85}
    .ss-waiter{display:flex;flex-direction:column;align-items:flex-end;gap:.25rem;flex-shrink:0}
    .ss-waiter button{background:rgba(255,255,255,.18);color:var(--gc-on-primary);border:1px solid rgba(255,255,255,.4);
      border-radius:999px;padding:.45rem .8rem;font-size:.78rem;font-weight:600;cursor:pointer;
      display:flex;align-items:center;gap:.35rem;white-space:nowrap}
    .ss-waiter button:disabled{opacity:.55;cursor:default}
    .ss-waiter .ss-waiter-note{font-size:.72rem;opacity:.9}

    .ss-layout{display:flex;flex:1;min-height:0}
    .ss-sidebar{flex-shrink:0;width:132px;display:flex;flex-direction:column;gap:.4rem;padding:.9rem .6rem;
      background:var(--gc-surface-container-low);border-right:1px solid var(--gc-outline-variant);
      position:sticky;top:3.6rem;align-self:flex-start;max-height:calc(100vh - 3.6rem);overflow-y:auto}
    .ss-cat{border:1px solid transparent;background:transparent;border-radius:14px;padding:.65rem .5rem;
      display:flex;flex-direction:column;align-items:center;gap:.3rem;cursor:pointer;text-align:center;
      color:var(--gc-on-surface-variant);transition:background .18s,color .18s,border-color .18s}
    .ss-cat .ss-cat-dot{width:2.4rem;height:2.4rem;border-radius:999px;background:var(--gc-surface-container);
      display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;color:var(--gc-primary)}
    .ss-cat .ss-cat-label{font-size:.76rem;font-weight:600;line-height:1.2}
    .ss-cat--active{background:var(--gc-primary-container);color:var(--gc-on-primary-container);
      border-color:var(--gc-primary)}
    .ss-cat--active .ss-cat-dot{background:var(--gc-primary);color:var(--gc-on-primary)}

    .ss-content{flex:1;min-width:0;padding:1rem;padding-bottom:6.5rem}
    .ss-content h2{font-size:1.25rem;margin:0 0 .25rem}
    .ss-content .ss-menu-desc{font-size:.88rem;color:var(--gc-on-surface-variant);margin:0 0 1rem}
    .ss-section h3{font-size:1rem;margin:1.1rem 0 .5rem;color:var(--gc-on-surface-variant)}
    .ss-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.75rem}
    .ss-item{background:var(--gc-surface-container-low);border:1px solid var(--gc-outline-variant);
      border-radius:var(--gc-radius);padding:.75rem;text-align:left;cursor:pointer;
      display:flex;flex-direction:column;gap:.35rem;min-height:5.5rem;transition:transform .12s,box-shadow .12s}
    .ss-item:active{transform:scale(.96)}
    .ss-item img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:calc(var(--gc-radius) - 6px);background:var(--gc-surface-container)}
    .ss-item .ss-name{font-weight:600;font-size:.92rem;line-height:1.25}
    .ss-item .ss-price{color:var(--gc-primary);font-weight:600;font-size:.9rem}

    /* Floating cart trigger: tall, easy to tap; bumps + briefly rings when an item is added. */
    .ss-bar{position:fixed;bottom:0;left:0;right:0;background:var(--gc-primary);color:var(--gc-on-primary);
      padding:1.25rem 1.2rem;min-height:3.6rem;display:flex;align-items:center;justify-content:space-between;
      border-top-left-radius:var(--gc-radius);border-top-right-radius:var(--gc-radius);
      box-shadow:0 -4px 16px rgba(0,0,0,.18);cursor:pointer;z-index:8;font-size:1.05rem}
    .ss-bar--bump{animation:ss-bump .38s ease}
    .ss-bar .ss-bar-count{display:flex;align-items:center;gap:.6rem;font-weight:700}
    .ss-bar .ss-bar-badge{background:var(--gc-on-primary);color:var(--gc-primary);border-radius:999px;
      min-width:1.7rem;height:1.7rem;display:flex;align-items:center;justify-content:center;font-size:.88rem;font-weight:700}

    /* Centered item-detail dialog with image carousel. Deliberately NOT closed by a backdrop tap —
       on a tablet/kiosk a thumb brushing the edge while scrolling toppings must never silently
       discard the customer's picks; closing is only ever the explicit ✕ / Cancelar buttons. */
    .ss-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;
      justify-content:center;z-index:20;padding:1rem;animation:ss-fade-in .15s ease}
    .ss-dialog{position:relative;background:var(--gc-surface);width:100%;max-width:520px;border-radius:20px;
      max-height:92vh;overflow:hidden;display:flex;flex-direction:column;
      animation:ss-pop-in .2s cubic-bezier(.2,.9,.3,1.2)}
    .ss-dialog-close{position:absolute;top:.6rem;right:.6rem;z-index:3;width:2.3rem;height:2.3rem;
      border-radius:999px;border:none;background:rgba(0,0,0,.48);color:#fff;font-size:1.05rem;
      cursor:pointer;display:flex;align-items:center;justify-content:center}
    /* Fixed head + scrollable middle (grows with many toppings) + fixed action footer, so a long
       modifier list never pushes the Agregar/Cancelar buttons out of reach. */
    .ss-dialog-scroll{flex:1;min-height:0;overflow-y:auto;padding:1rem 1.15rem;
      display:flex;flex-direction:column;gap:.9rem}
    .ss-dialog-actions{flex-shrink:0;padding:.9rem 1.15rem;border-top:1px solid var(--gc-outline-variant);
      display:flex;gap:.75rem}
    .ss-dialog h2{margin:0;font-size:1.2rem;padding-right:2.2rem}

    .ss-carousel{position:relative;width:100%;aspect-ratio:4/3;background:var(--gc-surface-container);
      border-radius:20px 20px 0 0;overflow:hidden;flex-shrink:0}
    .ss-carousel img{width:100%;height:100%;object-fit:cover;display:block}
    .ss-carousel .ss-carousel-arrow{position:absolute;top:50%;transform:translateY(-50%);
      width:2.1rem;height:2.1rem;border-radius:999px;border:none;background:rgba(0,0,0,.45);
      color:#fff;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center}
    .ss-carousel .ss-carousel-arrow--prev{left:.6rem}
    .ss-carousel .ss-carousel-arrow--next{right:.6rem}
    .ss-carousel .ss-carousel-dots{position:absolute;bottom:.6rem;left:0;right:0;display:flex;
      justify-content:center;gap:.35rem}
    .ss-carousel .ss-dot{width:.45rem;height:.45rem;border-radius:999px;background:rgba(255,255,255,.55);
      border:none;padding:0;cursor:pointer}
    .ss-carousel .ss-dot--active{background:#fff;width:.65rem}

    .ss-row{display:flex;align-items:center;justify-content:space-between;gap:.75rem}
    .ss-qty{display:flex;align-items:center;gap:.7rem}
    .ss-qty button{width:2.6rem;height:2.6rem;border-radius:999px;border:1px solid var(--gc-outline-variant);
      background:var(--gc-surface-container-low);font-size:1.25rem;cursor:pointer;transition:transform .1s}
    .ss-qty button:active{transform:scale(.88)}
    .ss-qty button:disabled{opacity:.4;cursor:not-allowed}
    .ss-group{display:flex;flex-direction:column;gap:.4rem}
    .ss-group .ss-group-title{font-weight:600;font-size:.9rem}
    .ss-group .ss-group-hint{font-size:.78rem;color:var(--gc-on-surface-variant)}
    .ss-opt{display:flex;align-items:center;gap:.65rem;padding:.75rem .45rem;border-bottom:1px solid var(--gc-outline-variant);
      border-radius:10px;transition:background .15s;min-height:2.6rem}
    .ss-opt--on{background:var(--gc-primary-container)}
    .ss-opt .ss-opt-check{width:1.5rem;height:1.5rem;flex-shrink:0}
    .ss-opt--on .ss-opt-check{animation:ss-check-pop .22s ease}
    .ss-notes textarea{width:100%;border-radius:10px;border:1px solid var(--gc-outline-variant);
      padding:.6rem;font:inherit;resize:vertical;min-height:3rem}
    .ss-primary{background:var(--gc-primary);color:var(--gc-on-primary);border:none;border-radius:999px;
      padding:.95rem 1.2rem;font-weight:600;font-size:1.02rem;cursor:pointer;transition:transform .1s}
    .ss-primary:active{transform:scale(.97)}
    .ss-primary:disabled{opacity:.5;cursor:not-allowed}
    .ss-ghost{background:transparent;border:1px solid var(--gc-outline-variant);border-radius:999px;
      padding:.8rem 1rem;font-size:.95rem;cursor:pointer;color:var(--gc-on-surface)}
    /* Action rows (dialog footer, cart footer): both buttons share the row evenly and stay tall
       enough to tap confidently — not the confirm screen, whose single button stays its own size. */
    .ss-dialog-actions .ss-primary,.ss-dialog-actions .ss-ghost,
    .ss-cart-foot .ss-row .ss-primary,.ss-cart-foot .ss-row .ss-ghost{flex:1}
    .ss-banner{background:var(--gc-primary-container);color:var(--gc-on-primary-container);
      border-radius:var(--gc-radius);padding:.7rem .9rem;font-size:.9rem}
    .ss-error{color:var(--gc-error)}

    /* Cart drawer: shadcn-sheet style, slides in from the right. */
    .ss-cart-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:25;animation:ss-fade-in .15s ease}
    .ss-cart-drawer{position:fixed;top:0;right:0;bottom:0;width:min(440px,94vw);background:var(--gc-surface);
      z-index:26;display:flex;flex-direction:column;box-shadow:-8px 0 24px rgba(0,0,0,.2);
      animation:ss-slide-in-right .22s cubic-bezier(.2,.85,.3,1.1)}
    .ss-cart-head{padding:1.1rem 1.15rem .6rem;display:flex;align-items:center;justify-content:space-between;
      border-bottom:1px solid var(--gc-outline-variant)}
    .ss-cart-head h2{margin:0;font-size:1.15rem}
    .ss-cart-close{background:transparent;border:none;font-size:1.3rem;cursor:pointer;line-height:1;
      color:var(--gc-on-surface-variant);padding:.2rem .5rem}
    .ss-cart-body{flex:1;overflow-y:auto;padding:.6rem 1.15rem}
    .ss-cart-foot{padding:.9rem 1.15rem 1.1rem;border-top:1px solid var(--gc-outline-variant);
      display:flex;flex-direction:column;gap:.7rem}
    .ss-cart-line{display:flex;gap:.65rem;padding:.75rem 0;border-bottom:1px solid var(--gc-outline-variant);
      transition:opacity .15s}
    .ss-cart-line--busy{opacity:.55}
    .ss-cart-line-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:.25rem}
    .ss-cart-line-name{font-weight:600;font-size:.94rem;display:flex;justify-content:space-between;gap:.5rem}
    .ss-cart-line-mods{font-size:.78rem;color:var(--gc-on-surface-variant);line-height:1.35}
    .ss-cart-line-notes{font-size:.78rem;color:var(--gc-on-surface-variant);font-style:italic}
    .ss-cart-line-sent{font-size:.74rem;color:var(--gc-primary);font-weight:600;display:inline-flex;align-items:center;gap:.25rem}
    .ss-cart-line-foot{display:flex;align-items:center;justify-content:space-between;margin-top:.3rem}
    .ss-cart-qty{display:flex;align-items:center;gap:.5rem}
    .ss-cart-qty button{width:1.9rem;height:1.9rem;border-radius:999px;border:1px solid var(--gc-outline-variant);
      background:var(--gc-surface-container-low);font-size:1rem;cursor:pointer}
    .ss-cart-qty button:disabled{opacity:.4;cursor:not-allowed}
    .ss-cart-remove{background:transparent;border:none;color:var(--gc-error);font-size:.82rem;font-weight:600;
      cursor:pointer;padding:.3rem .2rem;display:flex;align-items:center;gap:.3rem}
    .ss-cart-remove:disabled{opacity:.4;cursor:not-allowed}
    .ss-cart-empty{padding:2rem 0;text-align:center;color:var(--gc-on-surface-variant)}

    /* Full-screen "enviado a cocina" confirmation. */
    .ss-confirm{position:fixed;inset:0;background:var(--gc-surface);z-index:30;display:flex;
      flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:2rem;
      text-align:center;animation:ss-fade-in .18s ease}
    .ss-confirm .ss-confirm-check{width:4.2rem;height:4.2rem;border-radius:999px;background:var(--gc-primary-container);
      color:var(--gc-primary);display:flex;align-items:center;justify-content:center;font-size:2.2rem;
      animation:ss-check-pop .3s ease}
    .ss-confirm h1{margin:0;font-size:1.3rem}
    .ss-confirm p{margin:0;color:var(--gc-on-surface-variant)}

    @media (max-width:640px){
      .ss-layout{flex-direction:column}
      .ss-sidebar{position:sticky;top:3.1rem;width:100%;flex-direction:row;overflow-x:auto;
        max-height:none;border-right:none;border-bottom:1px solid var(--gc-outline-variant);padding:.6rem .5rem}
      .ss-cat{flex-direction:row;padding:.45rem .7rem;white-space:nowrap}
      .ss-cat .ss-cat-dot{width:1.8rem;height:1.8rem;font-size:.82rem}
    }
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
          <div class="ss-identity">
            <h1>{{ access()!.sucursal.nombre }}</h1>
            <span class="ss-sub">Mesa {{ access()!.mesa.numero }} · {{ access()!.mesa.sala }}</span>
          </div>
          <div class="ss-waiter">
            <button type="button" [disabled]="waiterBusy() || waiterCooldown()" (click)="callWaiter()">
              🔔 {{ waiterBusy() ? 'Llamando…' : waiterCooldown() ? 'Solicitud enviada' : 'Llamar a un mesero' }}
            </button>
            @if (waiterSent()) { <span class="ss-waiter-note">Solicitud enviada</span> }
            @if (waiterError()) { <span class="ss-waiter-note">{{ waiterError() }}</span> }
          </div>
        </header>

        @if (actionError()) {
          <div class="ss-content">
            <p class="ss-error">{{ actionError() }}</p>
            <button class="ss-ghost" type="button" (click)="retryLoad()">Reintentar</button>
          </div>
        }

        <div class="ss-layout">
          @if ((menu()?.menus ?? []).length > 1) {
            <nav class="ss-sidebar">
              <button class="ss-cat" type="button" [class.ss-cat--active]="activeMenuId() === null"
                (click)="selectMenu(null)">
                <span class="ss-cat-dot">🍽</span>
                <span class="ss-cat-label">Todos</span>
              </button>
              @for (card of menu()!.menus; track card.id) {
                <button class="ss-cat" type="button" [class.ss-cat--active]="card.id === activeMenuId()"
                  (click)="selectMenu(card.id)">
                  <span class="ss-cat-dot">{{ initials(card.nombre) }}</span>
                  <span class="ss-cat-label">{{ card.nombre }}</span>
                </button>
              }
            </nav>
          }

          <section class="ss-content">
            @for (card of visibleMenus(); track card.id) {
              <h2>{{ card.nombre }}</h2>
              @if (card.descripcion) { <p class="ss-menu-desc">{{ card.descripcion }}</p> }
              @for (section of card.secciones; track section.id) {
                <div class="ss-section">
                  <h3>{{ section.nombre }}</h3>
                  <div class="ss-grid">
                    @for (item of section.items; track item.id) {
                      <button class="ss-item" type="button" (click)="openItem(item)">
                        @if (item.imagenUrl) { <img [src]="item.imagenUrl" [alt]="item.nombre" loading="lazy"> }
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
        </div>

        <footer class="ss-bar" [class.ss-bar--bump]="cartBump()" role="button" tabindex="0"
          (click)="cartOpen.set(true)" (keydown.enter)="cartOpen.set(true)"
          (keydown.space)="cartOpen.set(true); $event.preventDefault()">
          <span class="ss-bar-count">
            <span class="ss-bar-badge">{{ cartCount() }}</span>
            Ver mi pedido
          </span>
          <span>{{ cartTotal() }}</span>
        </footer>
      </div>

      @if (selectedItem(); as item) {
        <div class="ss-overlay">
          <div class="ss-dialog">
            <button type="button" class="ss-dialog-close" (click)="closeItem()" aria-label="Cerrar">✕</button>
            @if (carouselImages(item).length) {
              <div class="ss-carousel">
                <img [src]="carouselImages(item)[carouselIndex()]" [alt]="item.nombre">
                @if (carouselImages(item).length > 1) {
                  <button type="button" class="ss-carousel-arrow ss-carousel-arrow--prev" (click)="carouselStep(item, -1)">‹</button>
                  <button type="button" class="ss-carousel-arrow ss-carousel-arrow--next" (click)="carouselStep(item, 1)">›</button>
                  <div class="ss-carousel-dots">
                    @for (src of carouselImages(item); track $index) {
                      <button type="button" class="ss-dot" [class.ss-dot--active]="$index === carouselIndex()"
                        (click)="carouselIndex.set($index)" [attr.aria-label]="'Foto ' + ($index + 1)"></button>
                    }
                  </div>
                }
              </div>
            }
            <div class="ss-dialog-scroll">
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
                    <label class="ss-opt" [class.ss-opt--on]="isChecked(group.grupoId, opt.id)">
                      <input class="ss-opt-check"
                        [type]="group.maximo === 1 && group.minimo > 0 ? 'radio' : 'checkbox'"
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
            </div>
            <div class="ss-dialog-actions">
              <button class="ss-ghost" type="button" (click)="closeItem()">Cancelar</button>
              <button class="ss-primary" type="button" [disabled]="adding()" (click)="confirmAdd(item)">
                {{ adding() ? 'Agregando…' : 'Agregar al pedido' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (cartOpen()) {
        <div class="ss-cart-overlay" role="presentation" (click)="closeCart()"></div>
        <aside class="ss-cart-drawer" role="presentation" (click)="$event.stopPropagation()">
          <div class="ss-cart-head">
            <h2>Tu pedido</h2>
            <button class="ss-cart-close" type="button" (click)="closeCart()" aria-label="Cerrar">✕</button>
          </div>
          <div class="ss-cart-body">
            @for (line of cart()?.orden?.lineas ?? []; track line.id) {
              <div class="ss-cart-line" [class.ss-cart-line--busy]="isLineBusy(line.id)">
                <div class="ss-cart-line-main">
                  <div class="ss-cart-line-name">
                    <span>{{ line.cantidad }}× {{ line.nombre }}</span>
                    <span>{{ line.subtotal }}</span>
                  </div>
                  @if (line.modificadores.length) {
                    <div class="ss-cart-line-mods">
                      {{ modifierSummary(line) }}
                    </div>
                  }
                  @if (line.notasCocina) { <div class="ss-cart-line-notes">“{{ line.notasCocina }}”</div> }
                  <div class="ss-cart-line-foot">
                    @if (line.enviada) {
                      <span class="ss-cart-line-sent">✓ Enviado a cocina</span>
                    } @else if (orderMutable()) {
                      <div class="ss-cart-qty">
                        <button type="button" [disabled]="isLineBusy(line.id)"
                          (click)="changeLineQty(line, -1)">−</button>
                        <span>{{ line.cantidad }}</span>
                        <button type="button" [disabled]="isLineBusy(line.id)"
                          (click)="changeLineQty(line, 1)">+</button>
                      </div>
                    }
                    @if (orderMutable()) {
                      <button class="ss-cart-remove" type="button" [disabled]="isLineBusy(line.id)"
                        (click)="removeLine(line)">🗑 Quitar</button>
                    }
                  </div>
                </div>
              </div>
            } @empty {
              <p class="ss-cart-empty">Todavía no has agregado nada.</p>
            }
            @if (lineError()) { <p class="ss-error">{{ lineError() }}</p> }
          </div>
          <div class="ss-cart-foot">
            <div class="ss-row"><strong>Total</strong><strong>{{ cart()?.orden?.total ?? '0.00' }}</strong></div>
            @if (sendError()) { <p class="ss-error">{{ sendError() }}</p> }
            <div class="ss-row">
              <button class="ss-ghost" type="button" (click)="closeCart()">Seguir viendo el menú</button>
              <button class="ss-primary" type="button"
                [disabled]="sending() || !cart()?.ordenId || !orderMutable()" (click)="sendOrder()">
                {{ sending() ? 'Enviando…' : 'Enviar pedido a cocina' }}
              </button>
            </div>
          </div>
        </aside>
      }

      @if (orderSentConfirm()) {
        <div class="ss-confirm">
          <div class="ss-confirm-check">✓</div>
          <h1>¡Pedido enviado a cocina!</h1>
          <p>Pedido {{ cart()?.orden?.numero }} · Total {{ cartTotal() }}</p>
          <p>Puedes seguir agregando más artículos si quieres — se enviarán por separado.</p>
          <button class="ss-primary" type="button" (click)="dismissConfirm()">Seguir viendo el menú</button>
        </div>
      }

      @if (closedNotice(); as notice) {
        <div class="ss-confirm">
          <div class="ss-confirm-check">{{ notice.estado === 'CERRADA' ? '✓' : '✕' }}</div>
          @if (notice.estado === 'CERRADA') {
            <h1>¡Gracias por tu visita!</h1>
            <p>Pedido {{ notice.numero }} · Total {{ notice.total }}</p>
            <p>Tu pedido fue cobrado y cerrado por el personal.</p>
          } @else {
            <h1>Pedido cancelado</h1>
            <p>Pedido {{ notice.numero }}</p>
            <p>El personal canceló este pedido. Si fue un error, avísale a un mesero.</p>
          }
          <button class="ss-primary" type="button" (click)="dismissClosedNotice()">Hacer un nuevo pedido</button>
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

  /** null = "Todos" (every menu, scrollable) — the default, so nothing is hidden behind a
   * category tap unless the customer picks one. */
  protected readonly activeMenuId = signal<string | null>(null);
  protected readonly visibleMenus = computed<SelfServiceMenuCard[]>(() => {
    const menus = this.menu()?.menus ?? [];
    const id = this.activeMenuId();
    return id === null ? menus : menus.filter(m => m.id === id);
  });

  protected readonly selectedItem = signal<SelfServiceMenuItem | null>(null);
  protected readonly qty = signal(1);
  protected readonly picks = signal<PickerSelection>({});
  protected readonly notes = signal('');
  protected readonly adding = signal(false);
  protected readonly pickerError = signal<string | null>(null);
  protected readonly carouselIndex = signal(0);

  protected readonly cartOpen = signal(false);
  protected readonly cartBump = signal(false);
  protected readonly sending = signal(false);
  protected readonly sendError = signal<string | null>(null);
  protected readonly orderSentConfirm = signal(false);

  /** Set when loadMenuAndCart() finds the table's order already CERRADA (paid/closed by staff)
   * or CANCELADA (voided) — a customer refreshing must always see the true current state of their
   * order rather than a stale "open" cart, and once acknowledged the table is free to start a new
   * one (addItems() on the backend already starts a fresh Orden once the old one isn't ABIERTA). */
  protected readonly closedNotice = signal<{ numero: string; total: string; estado: 'CERRADA' | 'CANCELADA' } | null>(null);
  protected readonly orderMutable = computed(() => {
    const estado = this.cart()?.orden?.estado;
    return estado === undefined || estado === null || estado === 'ABIERTA';
  });

  protected readonly lineBusyIds = signal<ReadonlySet<string>>(new Set());
  protected readonly lineError = signal<string | null>(null);

  protected readonly waiterBusy = signal(false);
  protected readonly waiterCooldown = signal(false);
  protected readonly waiterSent = signal(false);
  protected readonly waiterError = signal<string | null>(null);

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
      const estado = cart.orden?.estado;
      if (estado === 'CERRADA' || estado === 'CANCELADA') {
        this.closedNotice.set({ numero: cart.orden!.numero, total: cart.orden!.total, estado });
      }
    } catch (e) {
      this.actionError.set(gcErrorMessage(e));
    }
  }

  protected retryLoad(): void { void this.loadMenuAndCart(); }

  protected selectMenu(id: string | null): void { this.activeMenuId.set(id); }

  protected initials(nombre: string): string {
    const words = nombre.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '•';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  protected carouselImages(item: SelfServiceMenuItem): string[] {
    if (item.imagenes?.length) return item.imagenes;
    return item.imagenUrl ? [item.imagenUrl] : [];
  }
  protected carouselStep(item: SelfServiceMenuItem, delta: number): void {
    const images = this.carouselImages(item);
    if (!images.length) return;
    const next = (this.carouselIndex() + delta + images.length) % images.length;
    this.carouselIndex.set(next);
  }

  protected openItem(item: SelfServiceMenuItem): void {
    this.selectedItem.set(item);
    this.qty.set(1);
    this.notes.set('');
    this.pickerError.set(null);
    this.carouselIndex.set(0);
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
      // An optional single-pick group (minimo 0, e.g. "¿porta vasos?") can legitimately end
      // with nothing chosen, so clicking its already-selected option clears it back to that —
      // a required one (minimo > 0) always needs exactly one, so there's nothing valid to
      // clear it to. The template only uses a real (unclearable-by-click) radio input for the
      // required case; this optional case renders as a checkbox so the click always fires.
      const next = group.minimo === 0 && have.includes(opcionId) ? [] : [opcionId];
      this.picks.set({ ...current, [group.grupoId]: next });
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
      this.closeItem();
      this.bumpCart();
    } catch (e) {
      this.pickerError.set(gcErrorMessage(e));
    } finally {
      this.adding.set(false);
    }
  }

  private bumpCart(): void {
    this.cartBump.set(false);
    // Restart the animation even if a previous bump is still mid-flight.
    requestAnimationFrame(() => {
      this.cartBump.set(true);
      setTimeout(() => this.cartBump.set(false), 420);
    });
  }

  protected closeCart(): void { this.cartOpen.set(false); this.lineError.set(null); }

  protected modifierSummary(line: SelfServiceOrderLine): string {
    return line.modificadores
      .map(m => m.cantidad > 1 ? `${m.cantidad}× ${m.nombre}` : m.nombre)
      .join(', ');
  }

  protected isLineBusy(lineId: string): boolean { return this.lineBusyIds().has(lineId); }
  private setLineBusy(lineId: string, busy: boolean): void {
    const next = new Set(this.lineBusyIds());
    if (busy) next.add(lineId); else next.delete(lineId);
    this.lineBusyIds.set(next);
  }

  protected async changeLineQty(line: SelfServiceOrderLine, delta: number): Promise<void> {
    if (this.isLineBusy(line.id)) return;
    const next = Math.round(Number(line.cantidad)) + delta;
    if (next < 1) { void this.removeLine(line); return; }
    this.lineError.set(null);
    this.setLineBusy(line.id, true);
    try {
      const result = await firstValueFrom(
        this.api.updateLineQuantity(this.access()!.sessionToken, line.id, String(next)));
      this.cart.set(result);
    } catch (e) {
      this.lineError.set(gcErrorMessage(e));
    } finally {
      this.setLineBusy(line.id, false);
    }
  }

  protected async removeLine(line: SelfServiceOrderLine): Promise<void> {
    if (this.isLineBusy(line.id)) return;
    this.lineError.set(null);
    this.setLineBusy(line.id, true);
    try {
      const result = await firstValueFrom(this.api.removeLine(this.access()!.sessionToken, line.id));
      this.cart.set(result);
    } catch (e) {
      this.lineError.set(gcErrorMessage(e));
    } finally {
      this.setLineBusy(line.id, false);
    }
  }

  protected async sendOrder(): Promise<void> {
    this.sendError.set(null);
    this.sending.set(true);
    try {
      const result = await firstValueFrom(this.api.send(this.access()!.sessionToken));
      this.cart.set(result);
      this.cartOpen.set(false);
      this.orderSentConfirm.set(true);
    } catch (e) {
      this.sendError.set(gcErrorMessage(e));
    } finally {
      this.sending.set(false);
    }
  }
  protected dismissConfirm(): void { this.orderSentConfirm.set(false); }

  /** Acknowledging a closed/cancelled order clears the local cart view too (not just the
   * notice) — the next item they add will transparently start a brand-new Orden server-side
   * (see addItems()'s self-heal in self-service.store.ts), so the UI should look like a fresh
   * table, not keep showing the old receipt's total on the "Ver mi pedido" bar. */
  protected dismissClosedNotice(): void {
    this.closedNotice.set(null);
    this.cart.set({ ordenId: null, orden: null });
  }

  protected async callWaiter(): Promise<void> {
    if (this.waiterBusy() || this.waiterCooldown()) return;
    this.waiterError.set(null);
    this.waiterBusy.set(true);
    try {
      await firstValueFrom(this.api.callWaiter(this.access()!.sessionToken));
      this.waiterSent.set(true);
      this.waiterCooldown.set(true);
      setTimeout(() => this.waiterSent.set(false), 4000);
      setTimeout(() => this.waiterCooldown.set(false), 60000);
    } catch (e) {
      this.waiterError.set(gcErrorMessage(e));
      setTimeout(() => this.waiterError.set(null), 5000);
    } finally {
      this.waiterBusy.set(false);
    }
  }
}
