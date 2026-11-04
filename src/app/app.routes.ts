import { Routes } from '@angular/router';
import { gcAuthGuard, gcPermissionGuard } from './core/auth/gc-auth.guards';
import { gcGuestGuard, gcPasswordChangeGuard, gcSessionGuard } from './core/auth/gc-real.guards';
import { gcUnsavedChangesGuard } from './core/ux/gc-unsaved-changes.guard';

export const routes: Routes = [
  {
    path: 'login', title: 'Iniciar sesión — Gastro Core', canActivate: [gcGuestGuard],
    loadComponent: () => import('./features/auth/login/gc-login-page').then(m => m.GcLoginPage),
  },
  {
    path: 'change-password', title: 'Cambiar contraseña — Gastro Core',
    canActivate: [gcPasswordChangeGuard],
    loadComponent: () => import('./features/auth/change-password/gc-change-password-page').then(m => m.GcChangePasswordPage),
  },
  {
    path: '',
    loadComponent: () => import('./shells/gc-app-shell').then((m) => m.GcAppShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'workspace' },
      {
        path: 'account/security', title: 'Seguridad — Gastro Core',
        data: { breadcrumb: 'Seguridad' },
        canActivate: [gcSessionGuard],
        loadComponent: () => import('./features/auth/account/gc-account-security-page').then(m => m.GcAccountSecurityPage),
      },
      {
        path: 'account/profile', title: 'Mi perfil — Gastro Core',
        data: { breadcrumb: 'Mi perfil' },
        canActivate: [gcSessionGuard],
        canDeactivate: [gcUnsavedChangesGuard],
        loadComponent: () => import('./features/users/profile/my-profile-page').then(m => m.GcMyProfilePage),
      },
      {
        path: 'users', canActivate: [gcSessionGuard],
        loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES),
      },
      {
        path: 'recipes', canActivate: [gcSessionGuard], data: { breadcrumb: 'Recetas' },
        loadChildren: () => import('./features/recipes/recipes.routes').then(m => m.RECIPES_ROUTES),
      },
      {
        path: 'catalog', canActivate: [gcSessionGuard], data: { breadcrumb: 'Catálogo' },
        loadChildren: () => import('./features/catalog/catalog.routes').then(m => m.CATALOG_ROUTES),
      },
      {
        path: 'orders', canActivate: [gcSessionGuard], data: { breadcrumb: 'Órdenes' },
        loadChildren: () => import('./features/orders/orders.routes').then(m => m.ORDERS_ROUTES),
      },
      {
        path: 'payments', canActivate: [gcSessionGuard], data: { breadcrumb: 'Cobros' },
        loadChildren: () => import('./features/payments/payments.routes').then(m => m.PAYMENTS_ROUTES),
      },
      {
        path: 'purchases', canActivate: [gcSessionGuard],
        data: {breadcrumb:'Compras y abastecimiento'},
        loadChildren: () => import('./features/purchases/purchases.routes').then(m=>m.PURCHASES_ROUTES),
      },
      {
        path: 'inventory', canActivate: [gcSessionGuard], data: { breadcrumb: 'Inventario' },
        loadChildren: () => import('./features/inventory/inventory.routes').then(m => m.INVENTORY_ROUTES),
      },
      {
        path: 'organization',
        canActivate: [gcSessionGuard],
        loadChildren: () =>
          import('./features/organization/organization.routes').then(m => m.ORGANIZATION_ROUTES),
      },
      {
        path: 'workspace', title: 'Inicio — Gastro Core',
        data: { breadcrumb: 'Inicio' },
        canActivate: [gcSessionGuard],
        loadComponent: () => import('./features/auth/workspace/gc-workspace-page').then(m => m.GcWorkspacePage),
      },
      {
        path: 'lab/design-system', title: 'Design System — Gastro Core UI',
        data: { breadcrumb: 'Design System' },
        loadComponent: () =>
          import('./features/foundation/foundation-page').then((m) => m.FoundationPage),
      },
      {
        path: 'patterns',
        data: { breadcrumb: 'Patrones' },
        children: [
          {
            path: 'tables', title: 'Tablas y filtros — Gastro Core UI',
            data: { breadcrumb: 'Tablas' },
            loadComponent: () =>
              import('./features/table-playground/table-playground').then((m) => m.TablePlayground),
          },
        ],
      },
      {
        path: 'lab',
        data: { breadcrumb: 'Laboratorio UX' },
        children: [
          {
            path: 'behaviors', title: 'UI / UX Lab — Gastro Core',
            data: { breadcrumb: 'Comportamientos' },
            loadComponent: () =>
              import('./features/ux-lab/ux-lab').then((m) => m.GcUxLab),
          },
          {
            path: 'draft', title: 'Cambios sin guardar — Gastro Core',
            data: { breadcrumb: 'Formulario de prueba' },
            canDeactivate: [gcUnsavedChangesGuard],
            loadComponent: () =>
              import('./features/ux-lab/draft-demo').then((m) => m.GcDraftDemo),
          },
          {
            path: 'forms', title: 'Form Engine — Gastro Core',
            data: { breadcrumb: 'Formularios guiados' },
            canDeactivate: [gcUnsavedChangesGuard],
            loadComponent: () =>
              import('./features/form-lab/form-lab').then((m) => m.GcFormLab),
          },
          {
            path: 'secure', title: 'Área protegida — Gastro Core',
            data: { breadcrumb: 'Permisos', permission: 'settings.manage' },
            canActivate: [gcAuthGuard, gcPermissionGuard],
            loadComponent: () =>
              import('./features/ux-lab/secure-demo').then((m) => m.GcSecureDemo),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
