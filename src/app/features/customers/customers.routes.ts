
import type {Routes} from '@angular/router';
import {gcUnsavedChangesGuard} from '../../core/ux/gc-unsaved-changes.guard';

export const CUSTOMERS_ROUTES:Routes=[
 {path:'',pathMatch:'full',title:'Clientes — Gastro Core',
  loadComponent:()=>import('./pages/customers-list-page').then(m=>m.GcCustomersListPage)},
 {path:'new',data:{breadcrumb:'Nuevo cliente'},title:'Nuevo cliente — Gastro Core',
  canDeactivate:[gcUnsavedChangesGuard],
  loadComponent:()=>import('./pages/customer-create-page').then(m=>m.GcCustomerCreatePage)},
 {path:':id',data:{breadcrumb:'Detalle del cliente'},title:'Cliente — Gastro Core',
  canDeactivate:[gcUnsavedChangesGuard],
  loadComponent:()=>import('./pages/customer-detail-page').then(m=>m.GcCustomerDetailPage)}
];
