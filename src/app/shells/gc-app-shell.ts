import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';
import { GcCurrentAvatarStore } from '../core/auth/gc-current-avatar.store';
import { UsersApi } from '../features/users/data-access/users.api';
import { GcSidebar } from '../design-system/navigation/gc-sidebar';
import { GcTopbar } from '../design-system/navigation/gc-topbar';
import { GcProfileMenu } from '../design-system/profile/gc-profile-menu';
import { GcBranchSwitcher } from '../design-system/profile/gc-branch-switcher';
import { GcActiveBranchSwitcher } from '../design-system/profile/gc-active-branch-switcher';
import { GcAccountMenu } from '../design-system/profile/gc-account-menu';
import { GcNavigationItem } from '../design-system/navigation/navigation.model';
import { GcSessionService } from '../core/auth/gc-session.service';
import { GcBranchContext } from '../core/organization/gc-branch-context';
import { OrganizationAccess } from '../features/organization/data-access/organization-access';
import { UsersAccess } from '../features/users/data-access/users-access';
import { CatalogAccess } from '../features/catalog/data-access/catalog-access';
import { RecipesAccess } from '../features/recipes/data-access/recipes-access';
import { OrdersAccess } from '../features/orders/data-access/orders-access';
import { PaymentsAccess } from '../features/payments/data-access/payments-access';
import { PurchasesAccess } from '../features/purchases/data-access/purchases-access';
import { ReportsAccess } from '../features/reports/data-access/reports-access';
import { ReportingAccess } from '../features/reporting/data-access/reporting-access';
import { FinanceAccess } from '../features/finance/data-access/finance-access';
import { CustomersAccess } from '../features/customers/data-access/customers-access';
import { ReservationsAccess } from '../features/reservations/data-access/reservations-access';
import { DeliveryAccess } from '../features/delivery/data-access/delivery-access';
import { GcAuthFacade } from '../core/auth/demo-auth.facade';
import { GcBrandingService } from '../core/branding/gc-branding.service';
import { GcRealtimeService } from '../core/realtime/gc-realtime.service';
import { OrdersReadyAlertService } from '../features/orders/data-access/orders-ready-alert.service';
import { OrdersNewTicketAlertService } from '../features/orders/data-access/orders-new-ticket-alert.service';

@Component({
  selector: 'gc-app-shell',
  imports: [RouterOutlet, GcSidebar, GcTopbar, GcProfileMenu, GcBranchSwitcher, GcActiveBranchSwitcher, GcAccountMenu],
  templateUrl: './gc-app-shell.html',
  styleUrl: './gc-app-shell.scss',
})
export class GcAppShell {
  protected readonly collapsed = signal(false);
  protected readonly mobileOpen = signal(false);
  protected readonly branding = inject(GcBrandingService);
  protected readonly session = inject(GcSessionService);
  private readonly auth = inject(GcAuthFacade);
  protected readonly context = inject(GcBranchContext);
  protected readonly orgAccess = inject(OrganizationAccess);
  protected readonly usersAccess = inject(UsersAccess);
  protected readonly catalogAccess = inject(CatalogAccess);
  protected readonly recipesAccess = inject(RecipesAccess);
  protected readonly ordersAccess = inject(OrdersAccess);
  protected readonly paymentsAccess = inject(PaymentsAccess);
  protected readonly purchasesAccess = inject(PurchasesAccess);
  protected readonly reportsAccess = inject(ReportsAccess);
  protected readonly reportingAccess = inject(ReportingAccess);
  protected readonly financeAccess = inject(FinanceAccess);
  protected readonly customersAccess = inject(CustomersAccess);
  protected readonly reservationsAccess = inject(ReservationsAccess);
  protected readonly deliveryAccess = inject(DeliveryAccess);
  private readonly avatar=inject(GcCurrentAvatarStore);
  private readonly usersApi=inject(UsersApi);
  private readonly realtime = inject(GcRealtimeService);
  // Only needs to exist: its constructor wires the "comanda lista" toast/chime app-wide.
  private readonly ordersReadyAlert = inject(OrdersReadyAlertService);
  // Only needs to exist: its constructor wires the "comanda nueva en cocina" toast/chime app-wide.
  private readonly ordersNewTicketAlert = inject(OrdersNewTicketAlertService);
  private readonly router = inject(Router);
  protected readonly items = computed<readonly GcNavigationItem[]>(() =>
    this.session.authenticated()
      ? [
        { label: 'Inicio', path: '/workspace', initials: 'IN', icon:'home', exact: true },
        ...(this.catalogAccess.canEnter()
          ? [{label:'Catálogo',path:'/catalog',initials:'CA',icon:'catalog',exact:false}]:[]),
        ...(this.recipesAccess.canEnter()
          ? [{label:'Recetas',path:'/recipes',initials:'RE',icon:'recipes',exact:false}]:[]),
        ...(this.ordersAccess.canEnter()
          ? [{label:'Órdenes',path:'/orders',initials:'OR',icon:'orders',exact:false}]:[]),
        ...(this.paymentsAccess.canEnter()
          ? [{label:'Cobros',path:'/payments',initials:'CO',icon:'payments',exact:false}]:[]),
        ...(this.purchasesAccess.canEnter()
          ? [{label:'Compras',path:'/purchases',initials:'CP',icon:'purchases',exact:false}]:[]),
        ...(this.reportsAccess.canRead()
          ? [{label:'Analítica',path:'/reports',initials:'AN',icon:'reports',exact:false}]:[]),
        ...(this.reportingAccess.canRead()
          ? [{label:'Reportería',path:'/reporting',initials:'RP',icon:'reporting',exact:false}]:[]),
        ...((this.orgAccess.canGlobal('inventory.read')||this.context.has('inventory.read'))
         ? [{label:'Inventario',path:'/inventory',initials:'IV',icon:'inventory',exact:false}]:[]),
        ...(this.financeAccess.canEnter()
         ? [{label:'Finanzas',path:'/finance',initials:'FN',icon:'finance',exact:false}]:[]),
        ...(this.customersAccess.canEnter()
         ? [{label:'Clientes',path:'/customers',initials:'CL',icon:'customers',exact:false}]:[]),
        ...(this.reservationsAccess.canEnter()
         ? [{label:'Reservaciones',path:'/reservations',initials:'RS',icon:'reservations',exact:false}]:[]),
        ...(this.deliveryAccess.canEnter()
         ? [{label:'Entregas',path:'/delivery',initials:'EN',icon:'delivery',exact:false}]:[]),
        ...((this.usersAccess.canRead()||this.usersAccess.canGlobal('roles.read')||
          this.usersAccess.canGlobal('users.reports.read'))
          ? [{label:'Usuarios',path:'/users',initials:'US',icon:'users',exact:false}]:[]),
        ...((this.orgAccess.canGlobal('organization.read') ||
          this.context.has('branches.read') || this.context.has('devices.read'))
          ? [{ label: 'Configuración', path: '/organization', initials: 'CF', icon:'settings', exact: false }] : []),
      ]
      : [
    { label: 'Design System', path: '/lab/design-system', initials: 'DS', exact: true },
    { label: 'Tablas y filtros', path: '/patterns/tables', initials: 'TB', exact: true },
    { label: 'UI / UX Lab', path: '/lab/behaviors', initials: 'UX', exact: true },
    ...(this.auth.has('settings.manage') ?
      [{ label: 'Área con permisos (demo)', path: '/lab/secure', initials: 'PR', exact: true }] : []),
    { label: 'Formularios guiados', path: '/lab/forms', initials: 'FM', exact: true },
    { label: 'Formulario protegido contra salida', path: '/lab/draft', initials: 'FR', exact: true },
  ]);

  constructor() {
    effect(() => {
      if (this.session.authenticated()) {
        void this.orgAccess.load().catch(() => undefined);
        void this.usersAccess.load().catch(() => undefined);
      } else {
        this.orgAccess.reset();
        this.usersAccess.clear();
      }
    });
    effect(() => {
      const user=this.session.user();
      if(this.session.authenticated()&&user?.id){
        void this.avatar.loadFor(user.id,()=>firstValueFrom(this.usersApi.me()));
      }else{
        this.avatar.clear();
      }
    });
    // Connect once per login and just rejoin the room when the active sucursal changes — no
    // need to tear down and re-handshake the whole socket for that. Only logging out (or never
    // having logged in) disconnects; GcRealtimeService itself keeps `listen()` registrations
    // (Cocina, the ready alert) alive across any disconnect/reconnect, so those never need to
    // notice this effect running again.
    effect(() => {
      const authenticated = this.session.authenticated();
      const branch = this.context.branchId();
      const token = this.session.accessToken();
      if (!authenticated || !token) { this.realtime.disconnect(); return; }
      const alreadyConnected = untracked(() => this.realtime.status() !== 'disconnected');
      if (!alreadyConnected && typeof window !== 'undefined') {
        void this.realtime.connectSocketIo(window.location.origin + '/realtime', { token })
          .then(() => { if (branch) this.realtime.emit('join:sucursal', branch); })
          .catch(() => undefined);
      } else if (branch) {
        this.realtime.emit('join:sucursal', branch);
      }
    });
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => this.closeMobile());
  }

  protected closeMobile(): void { this.mobileOpen.set(false); }
}
