import { Component, DestroyRef, inject, viewChild } from '@angular/core';
import { Router, RouterLink, NavigationStart } from '@angular/router';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GcAuthFacade } from '../../core/auth/demo-auth.facade';
import { GcBrandingService } from '../../core/branding/gc-branding.service';
import { ConfirmDialogService } from '../confirm-dialog/confirm-dialog.service';

/**
 * A menu is an anchored overlay, NOT a confirmation dialog.
 * Material manages outside click, Escape, keyboard navigation and focus restoration.
 */
@Component({
  selector: 'gc-profile-menu',
  imports: [MatMenuModule, RouterLink],
  template: `
    <button
      type="button"
      class="gc-profile-trigger"
      [matMenuTriggerFor]="profileMenu"
      [attr.aria-label]="'Abrir menú de perfil: ' + (auth.identity()?.name ?? 'Invitado')">
      <span class="gc-profile-avatar" aria-hidden="true">{{ initials() }}</span>
      <span class="gc-profile-label">{{ auth.identity()?.name ?? 'Invitado' }}</span>
    </button>

    <mat-menu #profileMenu="matMenu" xPosition="before"
      [hasBackdrop]="true" class="gc-profile-panel">
      <div class="gc-profile-info" role="presentation">
        <strong>{{ auth.identity()?.name ?? 'Sin sesión activa' }}</strong>
        <small>{{ auth.identity()?.email ?? 'Modo local' }}</small>
        <span>{{ auth.identity()?.role ?? 'Sin rol' }} · {{ auth.branch()?.name ?? 'Sin sucursal' }}</span>
      </div>
      @if (auth.authenticated()) {
        <button type="button" mat-menu-item (click)="confirmLogout()">
          Cerrar sesión de prueba
        </button>
      } @else {
        <a mat-menu-item routerLink="/lab/behaviors">Iniciar sesión en UX Lab</a>
      }
    </mat-menu>
  `,
  styles: [ `
    :host { display:inline-flex; min-width:0; }
    .gc-profile-trigger {
      display:flex; align-items:center; gap:.5rem; min-height:44px;
      padding:.3rem .5rem; color:var(--gc-on-surface); background:transparent;
      border:0; cursor:pointer; border-radius:.6rem;
      transition:background-color var(--gc-motion-fast,140ms) ease;
    }
    .gc-profile-trigger:hover, .gc-profile-trigger[aria-expanded='true'] {
      background:var(--gc-surface-container);
    }
    .gc-profile-avatar {
      display:grid; place-items:center; width:2.2rem; height:2.2rem; flex:none;
      border-radius:100%; color:var(--gc-on-primary-container);
      background:var(--gc-primary-container); font-weight:700;
    }
    .gc-profile-label {
      max-width:10rem; overflow:hidden; white-space:nowrap;
      text-overflow:ellipsis; font-size:.85rem;
    }
    @media(max-width:460px) { .gc-profile-label { display:none; } }
    @media(prefers-reduced-motion:reduce) { .gc-profile-trigger { transition:none; } }
  ` ],
})
export class GcProfileMenu {
  protected readonly auth = inject(GcAuthFacade);
  private readonly branding = inject(GcBrandingService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly menuTrigger = viewChild(MatMenuTrigger);

  constructor() {
    // An open menu must not survive browser back/forward or programmatic navigation.
    this.router.events
      .pipe(
        filter((event): event is NavigationStart => event instanceof NavigationStart),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.menuTrigger()?.closeMenu());
  }

  protected initials(): string {
    return (this.auth.identity()?.name || this.branding.name())
      .split(/\s+/).slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase()).join('');
  }

  protected async confirmLogout(): Promise<void> {
    const accepted = await this.confirmDialog.confirm({
      title: 'Cerrar sesión',
      message: '¿Deseas cerrar la sesión de prueba actual?',
      confirmText: 'Cerrar sesión',
    });
    if (accepted) this.auth.logout();
  }
}
