
import type {Routes} from '@angular/router';
import {gcUnsavedChangesGuard} from '../../core/ux/gc-unsaved-changes.guard';

export const DELIVERY_ROUTES:Routes=[
 {path:'',pathMatch:'full',title:'Entregas — Gastro Core',
  loadComponent:()=>import('./pages/deliveries-list-page').then(m=>m.GcDeliveriesListPage)},
 {path:':id',data:{breadcrumb:'Detalle de entrega'},title:'Entrega — Gastro Core',
  canDeactivate:[gcUnsavedChangesGuard],
  loadComponent:()=>import('./pages/delivery-detail-page').then(m=>m.GcDeliveryDetailPage)}
];
