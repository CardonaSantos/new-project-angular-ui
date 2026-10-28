import { Component, input, output } from '@angular/core';
import { GcBreadcrumbs } from './gc-breadcrumbs';

@Component({
  selector: 'gc-topbar',
  imports: [GcBreadcrumbs],
  template: `
    <header class="gc-topbar">
      <div class="gc-topbar-left">
        <button type="button" class="gc-icon-button gc-mobile-toggle"
          [attr.aria-expanded]="mobileOpen()" aria-label="Abrir o cerrar menú"
          aria-controls="gc-primary-navigation" (click)="mobileToggle.emit()">
          <span aria-hidden="true">☰</span>
        </button>
        <button type="button" class="gc-icon-button gc-desktop-toggle"
          aria-label="Expandir o contraer barra lateral"
          [attr.aria-pressed]="collapsed()" (click)="collapseToggle.emit()">
          <span aria-hidden="true">☰</span>
        </button>
        <gc-breadcrumbs />
      </div>
      <div class="gc-topbar-actions"><ng-content select="[gcTopbarActions]" /></div>
    </header>
  `,
  styles: [ `
    .gc-topbar {
      min-height:4rem; padding:.65rem clamp(.75rem,2.5vw,1.75rem);
      display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:.75rem;
      background:var(--gc-surface); border-bottom:1px solid var(--gc-outline-variant);
    }
    .gc-topbar-left,.gc-topbar-actions { display:flex; align-items:center; gap:.75rem; min-width:0; }
    .gc-icon-button {
      flex:none; display:grid; place-items:center; width:2.75rem; height:2.75rem;
      padding:0; background:transparent; color:var(--gc-on-surface);
      border:1px solid var(--gc-outline-variant); border-radius:calc(var(--gc-radius) * .65);
      cursor:pointer; transition:background-color var(--gc-motion-fast,140ms) ease;
    }
    .gc-icon-button:hover { background:var(--gc-surface-container); }
    .gc-mobile-toggle { display:none; }
    @media (max-width:820px) { .gc-mobile-toggle { display:grid; } .gc-desktop-toggle { display:none; } }
  ` ],
})
export class GcTopbar {
  readonly collapsed = input(false);
  readonly mobileOpen = input(false);
  readonly mobileToggle = output<void>();
  readonly collapseToggle = output<void>();
}
