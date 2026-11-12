import {HttpClient,HttpParams} from '@angular/common/http';
import {inject,Injectable} from '@angular/core';
import {gcSilentRequest} from '../../../core/http/api-context';

/**
 * Minimal, local duplicate of the reservations feature's list lookup, used only to
 * power the "Reservas de hoy" summary widget on the Mesas board. Orders never imports
 * the reservations feature's data-access directly (no feature in this app imports
 * another feature's data-access — every feature is self-contained).
 */
export type OrdersReservationState='PENDIENTE'|'CONFIRMADA'|'CANCELADA'|'COMPLETADA'|'NO_ASISTIO';
export interface OrdersReservationSummary{
 id:string;nombreContacto:string;personas:number;inicio:string;estado:OrdersReservationState;
}

@Injectable({providedIn:'root'})
export class OrdersTodayReservations{
 private readonly http=inject(HttpClient);
 list(q:{sucursalId:string;desde:string;hasta:string}){
  const params=new HttpParams().set('sucursalId',q.sucursalId)
   .set('desde',q.desde).set('hasta',q.hasta).set('page','1').set('limit','100');
  return this.http.get<{data:OrdersReservationSummary[];meta:{total:number}}>('/api/reservations',
   {params,context:gcSilentRequest()});
 }
}
