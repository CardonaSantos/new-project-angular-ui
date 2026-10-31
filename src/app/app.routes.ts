import { Routes } from '@angular/router';
import { gcAuthGuard, gcPermissionGuard } from './core/auth/gc-auth.guards';
import { gcPasswordChangeGuard, gcSessionGuard } from './core/auth/gc-real.guards';
import { gcUnsavedChangesGuard } from './core/ux/gc-unsaved-changes.guard';

export const routes: Routes = [
  {
    path: 'login', title: 'Iniciar sesión — Gastro Core',
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
      {
        path: 'workspace', title: 'Inicio — Gastro Core',
        data: { breadcrumb: 'Inicio' },
        canActivate: [gcSessionGuard],
        loadComponent: () => import('./features/auth/workspace/gc-workspace-page').then(m => m.GcWorkspacePage),
      },
      {
        path: '', pathMatch: 'full', title: 'Design System — Gastro Core UI',
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
