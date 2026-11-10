import {HttpClient,HttpParams} from '@angular/common/http';
import {inject,Injectable} from '@angular/core';
import {gcSilentRequest} from '../../../core/http/api-context';

/**
 * Minimal, local duplicate of the orders feature's GET /api/orders, filtered by
 * clienteId, used only to populate the order-history section on the customer
 * detail page. Customers never imports the orders feature's data-access directly
 * (no feature in this app imports another feature's data-access — every feature
 * is self-contained).
 */
export type CustomerOrderMode='MESA'|'MOSTRADOR'|'PARA_LLEVAR'|'DELIVERY';
export type CustomerOrderState='ABIERTA'|'CERRADA'|'CANCELADA';
export interface CustomerOrderHistoryItem{
 id:string;numero:string;modalidad:CustomerOrderMode;estado:CustomerOrderState;
 total:string;abiertaEn:string;
}
export interface CustomerOrderHistoryPage{
 data:CustomerOrderHistoryItem[];meta:{page:number;limit:number;total:number;totalPages:number};
}

@Injectable({providedIn:'root'})
export class CustomerOrderHistory{
 private readonly http=inject(HttpClient);
 list(q:{sucursalId:string;clienteId:string;page?:number;limit?:number}){
  const params=new HttpParams().set('sucursalId',q.sucursalId).set('clienteId',q.clienteId)
   .set('page',String(q.page??1)).set('limit',String(q.limit??10));
  return this.http.get<CustomerOrderHistoryPage>('/api/orders',{params,context:gcSilentRequest()});
 }
}
