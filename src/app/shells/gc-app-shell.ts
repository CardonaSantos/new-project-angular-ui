import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { GcSidebar } from '../design-system/navigation/gc-sidebar';
import { GcTopbar } from '../design-system/navigation/gc-topbar';
import { GcProfileMenu } from '../design-system/profile/gc-profile-menu';
import { GcBranchSwitcher } from '../design-system/profile/gc-branch-switcher';
import { GcNotificationCenter } from '../design-system/feedback/gc-notification-center';
import { GcNavigationItem } from '../design-system/navigation/navigation.model';
import { GcAuthFacade } from '../core/auth/demo-auth.facade';
import { GcBrandingService } from '../core/branding/gc-branding.service';
import { GcRealtimeService } from '../core/realtime/gc-realtime.service';

@Component({
  selector: 'gc-app-shell',
  imports: [RouterOutlet, GcSidebar, GcTopbar, GcProfileMenu, GcBranchSwitcher, GcNotificationCenter],
  templateUrl: './gc-app-shell.html',
  styleUrl: './gc-app-shell.scss',
})
export class GcAppShell {
  protected readonly collapsed = signal(false);
  protected readonly mobileOpen = signal(false);
  protected readonly branding = inject(GcBrandingService);
  private readonly auth = inject(GcAuthFacade);
  private readonly realtime = inject(GcRealtimeService);
  private readonly router = inject(Router);
  protected readonly items = computed<readonly GcNavigationItem[]>(() => [
    { label: 'Design System', path: '/', initials: 'DS', exact: true },
    { label: 'Tablas y filtros', path: '/patterns/tables', initials: 'TB', exact: true },
    { label: 'UI / UX Lab', path: '/lab/behaviors', initials: 'UX', exact: true },
    ...(this.auth.has('settings.manage') ?
      [{ label: 'Área con permisos (demo)', path: '/lab/secure', initials: 'PR', exact: true }] : []),
    { label: 'Formularios guiados', path: '/lab/forms', initials: 'FM', exact: true },
    { label: 'Controles y medios', path: '/lab/components', initials: 'CM', exact: true },
    { label: 'Formulario protegido contra salida', path: '/lab/draft', initials: 'FR', exact: true },
  ]);

  constructor() {
    // Invalidate connections on identity/branch changes; rejoin rooms after real backend integration.
    effect(() => {
      this.auth.identity();
      this.auth.branchId();
      this.realtime.disconnect();
    });
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => this.closeMobile());
  }

  protected closeMobile(): void { this.mobileOpen.set(false); }
}
