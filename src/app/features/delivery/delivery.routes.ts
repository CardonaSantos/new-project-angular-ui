
import type {Routes} from '@angular/router';
import {gcUnsavedChangesGuard} from '../../core/ux/gc-unsaved-changes.guard';

export const DELIVERY_ROUTES:Routes=[
 {path:'',pathMatch:'full',title:'Entregas — Gastro Core',
  loadComponent:()=>import('./pages/deliveries-list-page').then(m=>m.GcDeliveriesListPage)},
 {path:'settlements',pathMatch:'full',title:'Liquidar repartidor — Gastro Core',
  loadComponent:()=>import('./pages/courier-settlement-page').then(m=>m.GcCourierSettlementPage)},
 {path:'settlements/channels',pathMatch:'full',title:'Canales externos — Gastro Core',
  loadComponent:()=>import('./pages/settlement-channels-page').then(m=>m.GcSettlementChannelsPage)},
 {path:'settlements/:id',data:{breadcrumb:'Liquidación'},title:'Liquidación — Gastro Core',
  loadComponent:()=>import('./pages/courier-settlement-detail-page').then(m=>m.GcCourierSettlementDetailPage)},
 {path:':id',data:{breadcrumb:'Detalle de entrega'},title:'Entrega — Gastro Core',
  canDeactivate:[gcUnsavedChangesGuard],
  loadComponent:()=>import('./pages/delivery-detail-page').then(m=>m.GcDeliveryDetailPage)}
];
