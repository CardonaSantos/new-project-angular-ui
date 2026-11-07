import {HttpClient,HttpParams} from '@angular/common/http';
import {Injectable,inject} from '@angular/core';
import {gcSilentRequest} from '../../../core/http/api-context';
import type {
 DeliveryRecord,DeliveryPage,DeliveryEvent,ClosureReadiness,DeliveryState,
 DeliveryCreateInput,DeliveryDestinationInput
} from './delivery.models';

export const deliveryPaths={
 list:'/api/deliveries',
 one:(id:string)=>'/api/deliveries/'+encodeURIComponent(id),
 closureReadiness:(id:string)=>'/api/deliveries/'+encodeURIComponent(id)+'/closure-readiness',
 finalizeOrder:(id:string)=>'/api/deliveries/'+encodeURIComponent(id)+'/finalize-order',
 events:(id:string)=>'/api/deliveries/'+encodeURIComponent(id)+'/events',
 destination:(id:string)=>'/api/deliveries/'+encodeURIComponent(id)+'/destination',
 assign:(id:string)=>'/api/deliveries/'+encodeURIComponent(id)+'/assign',
 dispatch:(id:string)=>'/api/deliveries/'+encodeURIComponent(id)+'/dispatch',
 complete:(id:string)=>'/api/deliveries/'+encodeURIComponent(id)+'/complete',
 cancel:(id:string)=>'/api/deliveries/'+encodeURIComponent(id)+'/cancel',
} as const;
function deliveryParams(query:object):HttpParams{
 let params=new HttpParams();
 for(const [key,value] of Object.entries(query)){
  if(value!==undefined&&value!==null&&value!=='')params=params.set(key,String(value));
 }
 return params;
}
const silent={context:gcSilentRequest()};
const params=(query:object)=>({...silent,params:deliveryParams(query)});
export interface DeliveryListQuery{
 sucursalId:string;page?:number;limit?:number;estado?:DeliveryState;repartidorId?:string;search?:string;
}
@Injectable({providedIn:'root'})
export class DeliveryApi{
 private readonly http=inject(HttpClient);
 list(q:DeliveryListQuery){return this.http.get<DeliveryPage<DeliveryRecord>>(deliveryPaths.list,params(q))}
 detail(id:string){return this.http.get<DeliveryRecord>(deliveryPaths.one(id),silent)}
 create(dto:DeliveryCreateInput){return this.http.post<DeliveryRecord>(deliveryPaths.list,dto,silent)}
 closureReadiness(id:string){
  return this.http.get<ClosureReadiness>(deliveryPaths.closureReadiness(id),silent);
 }
 finalizeOrder(id:string){return this.http.post<ClosureReadiness>(deliveryPaths.finalizeOrder(id),{},silent)}
 events(id:string){return this.http.get<{data:DeliveryEvent[]}>(deliveryPaths.events(id),silent)}
 destination(id:string,dto:DeliveryDestinationInput){
  return this.http.patch<{id:string}>(deliveryPaths.destination(id),dto,silent);
 }
 assign(id:string,dto:{claveOperacion:string;repartidorId:string}){
  return this.http.post<DeliveryRecord>(deliveryPaths.assign(id),dto,silent);
 }
 dispatch(id:string,dto:{claveOperacion:string}){
  return this.http.post<DeliveryRecord>(deliveryPaths.dispatch(id),dto,silent);
 }
 complete(id:string,dto:{claveOperacion:string}){
  return this.http.post<DeliveryRecord>(deliveryPaths.complete(id),dto,silent);
 }
 cancel(id:string,dto:{claveOperacion:string;motivo:string}){
  return this.http.post<DeliveryRecord>(deliveryPaths.cancel(id),dto,silent);
 }
}
