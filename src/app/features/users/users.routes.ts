
import {inject} from '@angular/core';
import type {Routes} from '@angular/router';
import {UsersAccess} from './data-access/users-access';
import {gcUnsavedChangesGuard} from '../../core/ux/gc-unsaved-changes.guard';
export const USERS_ROUTES:Routes=[
 {
  path:'',pathMatch:'full',
  redirectTo:async()=>{
   const access=inject(UsersAccess);
   if(!access.loaded())try{await access.load()}catch{/* show access error */}
   if(access.canRead())return 'staff';
   if(access.canGlobal('roles.read'))return 'roles';
   if(access.canGlobal('users.reports.read'))return 'reports';
   return '/workspace';
  },
 },
 {
  path:'staff',data:{breadcrumb:'Usuarios'},children:[
   {path:'',pathMatch:'full',title:'Usuarios — Gastro Core',
    loadComponent:()=>import('./staff/users-page').then(m=>m.GcUsersPage)},
   {path:'new',title:'Nuevo usuario — Gastro Core',data:{breadcrumb:'Nuevo usuario'},
    canDeactivate:[gcUnsavedChangesGuard],
    loadComponent:()=>import('./staff/user-detail-page').then(m=>m.GcUserDetailPage)},
   {path:':id',data:{breadcrumb:'Detalle de usuario'},children:[
    {path:'',pathMatch:'full',title:'Usuario — Gastro Core',
     canDeactivate:[gcUnsavedChangesGuard],
     loadComponent:()=>import('./staff/user-detail-page').then(m=>m.GcUserDetailPage)},
    {path:'security',title:'Seguridad del usuario — Gastro Core',data:{breadcrumb:'Sesiones y contraseña'},
     canDeactivate:[gcUnsavedChangesGuard],
     loadComponent:()=>import('./staff/user-security-page').then(m=>m.GcUserSecurityPage)},
    {path:'audit',title:'Auditoría del usuario — Gastro Core',data:{breadcrumb:'Auditoría y actividad'},
     loadComponent:()=>import('./staff/user-audit-page').then(m=>m.GcUserAuditPage)},
   ]}
  ]
 },
 {
  path:'roles',data:{breadcrumb:'Roles y permisos'},children:[
   {path:'',pathMatch:'full',title:'Roles — Gastro Core',
    loadComponent:()=>import('./roles/roles-page').then(m=>m.GcRolesPage)},
   {path:'new',title:'Nuevo rol — Gastro Core',data:{breadcrumb:'Nuevo rol'},
    canDeactivate:[gcUnsavedChangesGuard],
    loadComponent:()=>import('./roles/role-detail-page').then(m=>m.GcRoleDetailPage)},
   {path:':id',title:'Rol — Gastro Core',data:{breadcrumb:'Detalle del rol'},
    canDeactivate:[gcUnsavedChangesGuard],
    loadComponent:()=>import('./roles/role-detail-page').then(m=>m.GcRoleDetailPage)}
  ]
 },
 {path:'reports',title:'Resumen de personal — Gastro Core',data:{breadcrumb:'Resumen'},
  loadComponent:()=>import('./reports/staff-report-page').then(m=>m.GcStaffReportPage)},
];
