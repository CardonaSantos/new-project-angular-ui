
import {HttpClient,HttpParams} from '@angular/common/http';
import {inject,Injectable} from '@angular/core';
import {gcSilentRequest} from '../../../core/http/api-context';

/**
 * Minimal, local duplicate of the customers feature's /options lookup, used only to
 * populate the optional "cliente" picker on the reservation form. Reservations never
 * imports the customers feature's data-access directly (no feature in this app imports
 * another feature's data-access — every feature is self-contained).
 */
export interface ReservationCustomerOption{id:string;nombre:string}
export interface ReservationCustomerOptionsPage{data:ReservationCustomerOption[];nextCursor:string|null}

@Injectable({providedIn:'root'})
export class ReservationCustomerLookup{
 private readonly http=inject(HttpClient);
 options(q:{sucursalId:string;search?:string;limit?:number}){
  let params=new HttpParams().set('sucursalId',q.sucursalId).set('limit',String(q.limit??50));
  if(q.search)params=params.set('search',q.search);
  return this.http.get<ReservationCustomerOptionsPage>('/api/customers/options',
   {params,context:gcSilentRequest()});
 }
}
