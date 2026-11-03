import type {Routes} from '@angular/router';
export const PAYMENTS_ROUTES:Routes=[
 {path:'',pathMatch:'full',title:'Pagos y caja — Gastro Core',
  loadComponent:()=>import('./pages/payments-home-page').then(m=>m.GcPaymentsHomePage)},
 {path:'order/:id',title:'Cobrar cuenta — Gastro Core',data:{breadcrumb:'Cobrar'},
  loadComponent:()=>import('./pages/payments-checkout-page').then(m=>m.GcPaymentsCheckoutPage)},
 {path:'cash',title:'Caja y turnos — Gastro Core',data:{breadcrumb:'Caja'},
  loadComponent:()=>import('./pages/payments-cash-page').then(m=>m.GcPaymentsCashPage)},
 {path:'sales',title:'Ventas — Gastro Core',data:{breadcrumb:'Ventas'},
  loadComponent:()=>import('./pages/payments-sales-page').then(m=>m.GcPaymentsSalesPage)},
 {path:'reports',title:'Resumen de cobros — Gastro Core',data:{breadcrumb:'Resumen'},
  loadComponent:()=>import('./pages/payments-report-page').then(m=>m.GcPaymentsReportPage)},
];
