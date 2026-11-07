
import type {Routes} from '@angular/router';
import {gcUnsavedChangesGuard} from '../../core/ux/gc-unsaved-changes.guard';

export const RESERVATIONS_ROUTES:Routes=[
 {path:'',pathMatch:'full',title:'Reservaciones — Gastro Core',
  loadComponent:()=>import('./pages/reservations-list-page').then(m=>m.GcReservationsListPage)},
 {path:'new',data:{breadcrumb:'Nueva reservación'},title:'Nueva reservación — Gastro Core',
  canDeactivate:[gcUnsavedChangesGuard],
  loadComponent:()=>import('./pages/reservation-form-page').then(m=>m.GcReservationFormPage)},
 {path:':id',data:{breadcrumb:'Detalle de reservación'},title:'Reservación — Gastro Core',
  canDeactivate:[gcUnsavedChangesGuard],
  loadComponent:()=>import('./pages/reservation-detail-page').then(m=>m.GcReservationDetailPage)},
 {path:':id/edit',data:{breadcrumb:'Editar reservación'},title:'Editar reservación — Gastro Core',
  canDeactivate:[gcUnsavedChangesGuard],
  loadComponent:()=>import('./pages/reservation-form-page').then(m=>m.GcReservationFormPage)}
];
