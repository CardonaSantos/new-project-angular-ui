import type {Routes} from '@angular/router';

export const CATALOG_ROUTES:Routes=[
 {path:'',pathMatch:'full',redirectTo:'summary'},
 {path:'summary',title:'Resumen de catálogo — Gastro Core',
  data:{breadcrumb:'Resumen'},
  loadComponent:()=>import('./pages/catalog-summary-page').then(m=>m.GcCatalogSummaryPage)},
];
