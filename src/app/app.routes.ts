import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shells/gc-app-shell').then((m) => m.GcAppShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Design System — Gastro Core UI',
        data: { breadcrumb: 'Design System' },
        loadComponent: () =>
          import('./features/foundation/foundation-page').then((m) => m.FoundationPage),
      },
      {
        path: 'patterns',
        data: { breadcrumb: 'Patrones' },
        children: [
          {
            path: 'tables',
            title: 'Tablas y filtros — Gastro Core UI',
            data: { breadcrumb: 'Tablas' },
            loadComponent: () =>
              import('./features/table-playground/table-playground').then((m) => m.TablePlayground),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
