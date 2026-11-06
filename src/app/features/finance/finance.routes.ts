
import type {Routes} from '@angular/router';
import {gcUnsavedChangesGuard} from '../../core/ux/gc-unsaved-changes.guard';

export const FINANCE_ROUTES:Routes=[
 {path:'',pathMatch:'full',redirectTo:'accounts'},
 {path:'accounts',data:{breadcrumb:'Cuentas'},children:[
  {path:'',pathMatch:'full',title:'Cuentas financieras — Gastro Core',
   loadComponent:()=>import('./pages/finance-accounts-page').then(m=>m.GcFinanceAccountsPage)},
  {path:'new',data:{breadcrumb:'Nueva cuenta'},title:'Nueva cuenta — Gastro Core',
   canDeactivate:[gcUnsavedChangesGuard],
   loadComponent:()=>import('./pages/finance-account-create-page').then(m=>m.GcFinanceAccountCreatePage)},
  {path:':id',data:{breadcrumb:'Detalle de cuenta'},title:'Cuenta — Gastro Core',
   loadComponent:()=>import('./pages/finance-account-detail-page').then(m=>m.GcFinanceAccountDetailPage)}
 ]},
 {path:'expenses',data:{breadcrumb:'Gastos'},children:[
  {path:'',pathMatch:'full',title:'Gastos operativos — Gastro Core',
   loadComponent:()=>import('./pages/finance-expenses-page').then(m=>m.GcFinanceExpensesPage)},
  {path:'new',data:{breadcrumb:'Nuevo gasto'},title:'Nuevo gasto — Gastro Core',
   canDeactivate:[gcUnsavedChangesGuard],
   loadComponent:()=>import('./pages/finance-expense-create-page').then(m=>m.GcFinanceExpenseCreatePage)},
  {path:':id',data:{breadcrumb:'Detalle del gasto'},title:'Gasto — Gastro Core',
   loadComponent:()=>import('./pages/finance-expense-detail-page').then(m=>m.GcFinanceExpenseDetailPage)}
 ]},
 {path:'reconciliation',data:{breadcrumb:'Conciliación'},title:'Conciliación — Gastro Core',
  loadComponent:()=>import('./pages/finance-reconciliation-page').then(m=>m.GcFinanceReconciliationPage)},
 {path:'routing',data:{breadcrumb:'Enrutamiento'},title:'Enrutamiento — Gastro Core',
  canDeactivate:[gcUnsavedChangesGuard],
  loadComponent:()=>import('./pages/finance-routing-page').then(m=>m.GcFinanceRoutingPage)}
];
