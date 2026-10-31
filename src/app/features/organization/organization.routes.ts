import type { Routes } from '@angular/router';
import { gcSessionGuard } from '../../core/auth/gc-real.guards';
import { gcUnsavedChangesGuard } from '../../core/ux/gc-unsaved-changes.guard';

export const ORGANIZATION_ROUTES: Routes = [
  { path:'', pathMatch:'full', redirectTo:'branches' },
  {
    path:'company', title:'Empresa — Gastro Core', canActivate:[gcSessionGuard],
    data:{breadcrumb:'Empresa'},
    canDeactivate:[gcUnsavedChangesGuard],
    loadComponent:()=>import('./company/company-page').then(m=>m.GcCompanyPage),
  },
  {
    path:'branches', title:'Sucursales — Gastro Core',
    data:{breadcrumb:'Sucursales'},
    loadComponent:()=>import('./branches/branches-page').then(m=>m.GcBranchesPage),
  },
  {
    path:'branches/new', title:'Nueva sucursal — Gastro Core',
    data:{breadcrumb:'Nueva sucursal'},
    canDeactivate:[gcUnsavedChangesGuard],
    loadComponent:()=>import('./branches/branch-detail-page').then(m=>m.GcBranchDetailPage),
  },
  {
    path:'branches/:id', title:'Sucursal — Gastro Core',
    data:{breadcrumb:'Sucursal'},
    canDeactivate:[gcUnsavedChangesGuard],
    loadComponent:()=>import('./branches/branch-detail-page').then(m=>m.GcBranchDetailPage),
  },
  {
    path:'devices', title:'Dispositivos — Gastro Core',
    data:{breadcrumb:'Dispositivos'},
    loadComponent:()=>import('./devices/devices-page').then(m=>m.GcDevicesPage),
  },
  {
    path:'devices/new', title:'Nuevo dispositivo — Gastro Core',
    data:{breadcrumb:'Nuevo dispositivo'},
    canDeactivate:[gcUnsavedChangesGuard],
    loadComponent:()=>import('./devices/device-detail-page').then(m=>m.GcDeviceDetailPage),
  },
  {
    path:'devices/:id', title:'Dispositivo — Gastro Core',
    data:{breadcrumb:'Dispositivo'},
    canDeactivate:[gcUnsavedChangesGuard],
    loadComponent:()=>import('./devices/device-detail-page').then(m=>m.GcDeviceDetailPage),
  },
];
