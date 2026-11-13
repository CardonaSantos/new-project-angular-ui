import { Routes } from '@angular/router';

// No guards: this is the customer-facing, unauthenticated flow. It must not be
// nested under the staff shell (see app.routes.ts — it is a top-level sibling
// of 'login', not a child of GcAppShell) and never shows the staff sidebar.
export const SELF_SERVICE_ROUTES: Routes = [
  {
    path: 't/:token', title: 'Tu pedido — Gastro Core',
    loadComponent: () => import('./pages/self-service-page').then(m => m.GcSelfServicePage),
  },
];
