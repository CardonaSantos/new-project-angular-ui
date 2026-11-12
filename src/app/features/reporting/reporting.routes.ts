import type { Routes } from '@angular/router';
export const REPORTING_ROUTES: Routes = [
  { path: '', title: 'Reportería — Gastro Core', data: { breadcrumb: 'Reportería' },
    loadComponent: () => import('./pages/reporting-page').then(m => m.GcReportingPage) },
];
