import { Routes } from '@angular/router';
import { gcAuthGuard, gcPermissionGuard } from './core/auth/gc-auth.guards';
import { gcUnsavedChangesGuard } from './core/ux/gc-unsaved-changes.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shells/gc-app-shell').then((m) => m.GcAppShell),
    children: [
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
