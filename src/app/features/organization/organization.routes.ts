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
    // Componentless parents provide the breadcrumb level for both list and detail.
    path: 'branches',
    data: { breadcrumb: 'Sucursales' },
    children: [
      {
        path: '', pathMatch: 'full', title: 'Sucursales — Gastro Core',
        loadComponent: () => import('./branches/branches-page').then(m => m.GcBranchesPage),
      },
      {
        path: 'new', title: 'Nueva sucursal — Gastro Core',
        data: { breadcrumb: 'Nueva sucursal' },
        canDeactivate: [gcUnsavedChangesGuard],
        loadComponent: () => import('./branches/branch-detail-page').then(m => m.GcBranchDetailPage),
      },
      {
        path: ':id', title: 'Sucursal — Gastro Core',
        data: { breadcrumb: 'Detalle de sucursal' },
        canDeactivate: [gcUnsavedChangesGuard],
        loadComponent: () => import('./branches/branch-detail-page').then(m => m.GcBranchDetailPage),
      },
    ],
  },
  {
    path: 'devices',
    data: { breadcrumb: 'Dispositivos' },
    children: [
      {
        path: '', pathMatch: 'full', title: 'Dispositivos — Gastro Core',
        loadComponent: () => import('./devices/devices-page').then(m => m.GcDevicesPage),
      },
      {
        path: 'new', title: 'Nuevo dispositivo — Gastro Core',
        data: { breadcrumb: 'Nuevo dispositivo' },
        canDeactivate: [gcUnsavedChangesGuard],
        loadComponent: () => import('./devices/device-detail-page').then(m => m.GcDeviceDetailPage),
      },
      {
        path: ':id', title: 'Dispositivo — Gastro Core',
        data: { breadcrumb: 'Detalle de dispositivo' },
        canDeactivate: [gcUnsavedChangesGuard],
        loadComponent: () => import('./devices/device-detail-page').then(m => m.GcDeviceDetailPage),
      },
    ],
  },
];
