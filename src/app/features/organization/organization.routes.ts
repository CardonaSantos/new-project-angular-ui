import { inject } from '@angular/core';
import type { Routes } from '@angular/router';
import { GcBranchContext } from '../../core/organization/gc-branch-context';
import { OrganizationAccess } from './data-access/organization-access';
import { organizationLandingPath } from './data-access/organization-landing';
import { gcSessionGuard } from '../../core/auth/gc-real.guards';
import { gcUnsavedChangesGuard } from '../../core/ux/gc-unsaved-changes.guard';

export const ORGANIZATION_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: async () => {
      const access = inject(OrganizationAccess);
      const branch = inject(GcBranchContext);
      if (!access.loaded()) {
        try { await access.load(); } catch { /* Branch routes may still be available. */ }
      }
      return organizationLandingPath(
        access.canGlobal('organization.read'),
        branch.has('branches.read'),
        branch.has('devices.read'),
      );
    },
  },
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
