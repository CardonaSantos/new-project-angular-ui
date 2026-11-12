import {HttpClient,HttpParams} from '@angular/common/http';
import {inject,Injectable} from '@angular/core';
import {map} from 'rxjs';
import {gcSilentRequest} from '../../../core/http/api-context';

/**
 * Minimal, local duplicate of the reservations feature's /availability lookup, used
 * only to overlay "reservada a las X" badges on the Mesas grid of the POS. Orders
 * never imports the reservations feature's data-access directly (no feature in this
 * app imports another feature's data-access — every feature is self-contained).
 *
 * The endpoint returns an envelope ({mesas, sugerencias, totalDisponibles, ...}), not
 * a bare array — unwrapped here with map().
 */
export interface OrdersTableConflict{
 id:string;disponible:boolean;motivo:'RESERVADA'|'OCUPADA'|null;
 reservaConflictoId:string|null;reservaConflictoInicio:string|null;reservaConflictoContacto:string|null;
}
interface AvailabilityEnvelope{mesas:OrdersTableConflict[]}

@Injectable({providedIn:'root'})
export class OrdersTableReservations{
 private readonly http=inject(HttpClient);
 /** Upcoming reservations overlapping [inicio,fin) for every active table in the branch. */
 upcoming(q:{sucursalId:string;inicio:string;fin:string}){
  const params=new HttpParams().set('sucursalId',q.sucursalId)
   .set('inicio',q.inicio).set('fin',q.fin).set('personas','1');
  return this.http.get<AvailabilityEnvelope>('/api/reservations/availability',
   {params,context:gcSilentRequest()}).pipe(map(r=>r.mesas));
 }
}
