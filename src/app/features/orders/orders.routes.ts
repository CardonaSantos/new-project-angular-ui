import type {Routes} from '@angular/router';
import {gcUnsavedChangesGuard} from '../../core/ux/gc-unsaved-changes.guard';
export const ORDERS_ROUTES:Routes=[
 {path:'',pathMatch:'full',title:'Órdenes — Gastro Core',
  loadComponent:()=>import('./pages/orders-home-page').then(m=>m.GcOrdersHomePage)},
 {path:'pos',title:'Punto de venta — Gastro Core',data:{breadcrumb:'Punto de venta'},
  canDeactivate:[gcUnsavedChangesGuard],
  loadComponent:()=>import('./pages/orders-pos-page').then(m=>m.GcOrdersPosPage)},
 {path:'list',title:'Órdenes — Gastro Core',data:{breadcrumb:'Órdenes'},
  loadComponent:()=>import('./pages/orders-list-page').then(m=>m.GcOrdersListPage)},
 {path:'list/:id',title:'Detalle de orden — Gastro Core',data:{breadcrumb:'Detalle de orden'},
  loadComponent:()=>import('./pages/orders-detail-page').then(m=>m.GcOrdersDetailPage)},
 {path:'tables',title:'Mesas — Gastro Core',data:{breadcrumb:'Mesas'},
  loadComponent:()=>import('./pages/orders-tables-page').then(m=>m.GcOrdersTablesPage)},
 {path:'kitchen',title:'Cocina — Gastro Core',data:{breadcrumb:'Cocina'},
  loadComponent:()=>import('./pages/orders-kitchen-page').then(m=>m.GcOrdersKitchenPage)},
 {path:'settings',title:'Configuración de órdenes — Gastro Core',data:{breadcrumb:'Configuración'},
  loadComponent:()=>import('./pages/orders-settings-page').then(m=>m.GcOrdersSettingsPage)},
];
