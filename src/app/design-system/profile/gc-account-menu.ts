import { Component, DestroyRef, inject, viewChild } from '@angular/core';
import { Router, RouterLink, NavigationStart } from '@angular/router';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { filter, firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GcSessionService } from '../../core/auth/gc-session.service';
import { gcErrorMessage } from '../../core/http/api-error';
import { GcNotificationService } from '../../core/ux/gc-notification.service';
import { GcAsyncAction } from '../../core/ux/gc-async-action';
import { ConfirmDialogService } from '../confirm-dialog/confirm-dialog.service';

@Component({
  selector: 'gc-account-menu',
  imports: [MatMenuModule, RouterLink],
  template: `
    <button type="button" class="gc-account-trigger"
      [matMenuTriggerFor]="menu"
      [attr.aria-label]="'Cuenta de ' + (session.user()?.nombre ?? '')"
      [disabled]="action.pending()">
      <span class="gc-avatar" aria-hidden="true">{{ initials() }}</span>
      <span class="gc-account-label">{{ session.user()?.nombre }}</span>
    </button>
    <mat-menu #menu="matMenu" xPosition="before" [hasBackdrop]="true"
      panelClass="gc-profile-panel">
      <div class="gc-profile-info" role="presentation">
        <strong>{{ session.user()?.nombre }}</strong>
        <small>{{ session.user()?.email }}</small>
      </div>
      <a mat-menu-item routerLink="/account/security">Cambiar contraseña</a>
      <button type="button" mat-menu-item [disabled]="action.pending()" (click)="logout(false)">
        Cerrar sesión
      </button>
      <button type="button" mat-menu-item [disabled]="action.pending()" (click)="logout(true)">
        Cerrar todas las sesiones
      </button>
    </mat-menu>
  `,
  styles: [`
    :host { display:inline-flex; min-width:0; }
    .gc-account-trigger { display:flex; align-items:center; gap:.6rem;
      min-height:44px; padding:.25rem .4rem; border:0; border-radius:.55rem;
      background:transparent; color:var(--gc-on-surface); cursor:pointer; }
    .gc-account-trigger:hover { background:var(--gc-surface-container); }
    .gc-account-trigger:disabled { opacity:.6; cursor:wait; }
    .gc-avatar { display:grid; place-items:center; width:2.15rem; height:2.15rem;
      border-radius:50%; flex:none; background:var(--gc-primary-container);
      color:var(--gc-on-primary-container); font-weight:700; font-size:.85rem; }
    .gc-account-label { max-width:9rem; overflow:hidden; text-overflow:ellipsis;
      white-space:nowrap; font-weight:500; font-size:.875rem; }
    @media(max-width:480px) { .gc-account-label { display:none; } }
  `],
})
export class GcAccountMenu {
  protected readonly session = inject(GcSessionService);
  protected readonly action = new GcAsyncAction();
  private readonly router = inject(Router);
  private readonly confirmations = inject(ConfirmDialogService);
  private readonly notifications = inject(GcNotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly menuTrigger = viewChild(MatMenuTrigger);

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationStart => event instanceof NavigationStart),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.menuTrigger()?.closeMenu());
  }

  protected initials(): string {
    return (this.session.user()?.nombre ?? '')
      .trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
  }

  protected async logout(all: boolean): Promise<void> {
    if (this.action.pending()) return;
    const accepted = await this.confirmations.confirm({
      title: all ? 'Cerrar todas las sesiones' : 'Cerrar sesión',
      message: all
        ? 'Se cerrarán las sesiones abiertas en todos tus dispositivos.'
        : '¿Quieres cerrar tu sesión?',
      confirmText: 'Cerrar sesión',
    });
    if (!accepted) return;
    const result = await this.action.run(() => firstValueFrom(this.session.logout(all)));
    if (!result.ok && result.reason === 'error') {
      this.notifications.show('No se pudo confirmar el cierre en el servidor. ' +
        gcErrorMessage(result.error), 'error');
    }
    await this.router.navigateByUrl('/login');
  }
}
