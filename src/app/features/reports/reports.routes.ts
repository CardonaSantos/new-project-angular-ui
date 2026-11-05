import type {Routes} from '@angular/router';
export const REPORTS_ROUTES:Routes=[
 {path:'',title:'Analítica y reportes — Gastro Core',data:{breadcrumb:'Analítica'},
  loadComponent:()=>import('./pages/reports-analytics-page').then(m=>m.GcReportsAnalyticsPage)}
];
