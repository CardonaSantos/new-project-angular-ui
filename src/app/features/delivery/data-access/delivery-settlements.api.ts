import {HttpClient,HttpParams} from '@angular/common/http';
import {Injectable,inject} from '@angular/core';
import {gcSilentRequest} from '../../../core/http/api-context';
import type {
 CourierPendingPage,CourierSettlementDetail,CourierSettlementDirectResult,
 DirectCourierSettlementInput,PlatformChannel,RegisterChannelInput
} from './delivery-settlements.models';

export const settlementPaths={
 pending:'/api/deliveries/settlements/couriers/pending',
 closeDirect:'/api/deliveries/settlements/couriers/close-direct',
 courierDetail:(id:string)=>'/api/deliveries/settlements/couriers/'+encodeURIComponent(id),
 channels:'/api/deliveries/settlements/platforms/channels',
} as const;

function settlementParams(query:object):HttpParams{
 let params=new HttpParams();
 for(const [key,value] of Object.entries(query)){
  if(value!==undefined&&value!==null&&value!=='')params=params.set(key,String(value));
 }
 return params;
}
const silent={context:gcSilentRequest()};
const params=(query:object)=>({...silent,params:settlementParams(query)});

export interface CourierPendingQuery{
 sucursalId:string;page?:number;limit?:number;repartidorId?:string;
}

@Injectable({providedIn:'root'})
export class DeliverySettlementsApi{
 private readonly http=inject(HttpClient);
 pending(q:CourierPendingQuery){
  return this.http.get<CourierPendingPage>(settlementPaths.pending,params(q));
 }
 closeDirect(d:DirectCourierSettlementInput){
  return this.http.post<CourierSettlementDirectResult>(settlementPaths.closeDirect,d,silent);
 }
 courierDetail(id:string){
  return this.http.get<CourierSettlementDetail>(settlementPaths.courierDetail(id),silent);
 }
 channels(sucursalId:string){
  return this.http.get<{data:PlatformChannel[]}>(settlementPaths.channels,params({sucursalId}));
 }
 registerChannel(d:RegisterChannelInput){
  return this.http.post<PlatformChannel>(settlementPaths.channels,d,silent);
 }
}
