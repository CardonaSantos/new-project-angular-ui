import {HttpClient,HttpParams} from '@angular/common/http';
import {inject,Injectable} from '@angular/core';
import {gcSilentRequest} from '../../../core/http/api-context';
import type {
 AddLinesInput,CancellationClass,ChangeFeed,CreateOrderInput,EditLineInput,KitchenRoute,
 KitchenTicket,OrderDetail,OrderListQuery,OrderSummary,Page,Room,Station,TableRecord,
 TicketListQuery
} from './orders.models';

/** All 32 authenticated ORD-A endpoints from backend main, 2026-11-03.
 * Mutations do not use implicit retries. Idempotent ones carry a stable operation key. */
export const orderPaths={
 orders:'/api/orders',order:(id:string)=>'/api/orders/'+encodeURIComponent(id),
 line:(id:string,line:string)=>'/api/orders/'+encodeURIComponent(id)+'/lines/'+encodeURIComponent(line),
 tables:'/api/tables',rooms:'/api/tables/rooms',
 room:(id:string)=>'/api/tables/rooms/'+encodeURIComponent(id),
 table:(id:string)=>'/api/tables/'+encodeURIComponent(id),
 occupancy:(id:string)=>'/api/tables/occupancies/'+encodeURIComponent(id)+'/close',
 stations:'/api/kitchen/stations',station:(id:string)=>'/api/kitchen/stations/'+encodeURIComponent(id),
 routes:'/api/kitchen/routes',route:(id:string)=>'/api/kitchen/routes/'+encodeURIComponent(id),
 tickets:'/api/kitchen/tickets',ticket:(id:string)=>'/api/kitchen/tickets/'+encodeURIComponent(id),
 lineKitchen:(id:string)=>'/api/kitchen/lines/'+encodeURIComponent(id),
 changes:'/api/kitchen/changes',
} as const;
/** Background/read queries report errors inline and do not flood the notice queue. */
const options={context:gcSilentRequest()};
/** User-triggered writes must reach the global interceptor for a visible error toast. */
const mutationOptions={};
const params=(q:object)=>{
 let p=new HttpParams();for(const [k,v] of Object.entries(q)){
  if(v!==undefined&&v!==null&&v!=='')p=p.set(k,String(v));
 }return {...options,params:p};
};
@Injectable({providedIn:'root'})
export class OrdersApi{
 private readonly http=inject(HttpClient);
 // Orders: 10 endpoints
 list(q:OrderListQuery){return this.http.get<Page<OrderSummary>>(orderPaths.orders,params(q))}
 create(dto:CreateOrderInput){return this.http.post<OrderDetail>(orderPaths.orders,dto,mutationOptions)}
 detail(id:string){return this.http.get<OrderDetail>(orderPaths.order(id),options)}
 edit(id:string,dto:{version:number;observaciones?:string;clienteId?:string}){
  return this.http.patch<OrderDetail>(orderPaths.order(id),dto,mutationOptions);
 }
 addLines(id:string,dto:AddLinesInput){
  return this.http.post<OrderDetail>(orderPaths.order(id)+'/lines',dto,mutationOptions);
 }
 editLine(id:string,lineId:string,dto:EditLineInput){
  return this.http.patch<OrderDetail>(orderPaths.line(id,lineId),dto,mutationOptions);
 }
 cancelLine(id:string,lineId:string,motivo:string){
  return this.http.post<OrderDetail>(orderPaths.line(id,lineId)+'/cancel',{motivo},mutationOptions);
 }
 send(id:string,claveOperacion:string){
  return this.http.post<OrderDetail>(orderPaths.order(id)+'/send',{claveOperacion},mutationOptions);
 }
 cancel(id:string,motivo:string,clasificacion?:CancellationClass){
  return this.http.post<OrderDetail>(orderPaths.order(id)+'/cancel',{motivo,...(clasificacion?{clasificacion}:{})},mutationOptions);
 }
 close(id:string){return this.http.post<OrderDetail>(orderPaths.order(id)+'/close',{},mutationOptions)}
 // Tables: 7 endpoints
 rooms(sucursalId:string){return this.http.get<Room[]>(orderPaths.rooms,params({sucursalId}))}
 createRoom(dto:{sucursalId:string;nombre:string}){return this.http.post<Room>(orderPaths.rooms,dto,mutationOptions)}
 updateRoom(id:string,dto:{nombre?:string;activa?:boolean}){
  return this.http.patch<Room>(orderPaths.room(id),dto,mutationOptions);
 }
 tables(sucursalId:string){return this.http.get<TableRecord[]>(orderPaths.tables,params({sucursalId}))}
 createTable(dto:{salaId:string;numero:string;capacidad:number}){
  return this.http.post<TableRecord>(orderPaths.tables,dto,mutationOptions);
 }
 updateTable(id:string,dto:{numero?:string;capacidad?:number;activa?:boolean}){
  return this.http.patch<TableRecord>(orderPaths.table(id),dto,mutationOptions);
 }
 closeOccupancy(id:string){return this.http.post<{id:string;cerrada:boolean}>(orderPaths.occupancy(id),{},mutationOptions)}
 // Kitchen: 15 endpoints
 stations(sucursalId:string){return this.http.get<Station[]>(orderPaths.stations,params({sucursalId}))}
 createStation(dto:{sucursalId:string;nombre:string;ubicacionConsumoId?:string}){
  return this.http.post<Station>(orderPaths.stations,dto,mutationOptions);
 }
 updateStation(id:string,dto:{nombre?:string;activa?:boolean;ubicacionConsumoId?:string}){
  return this.http.patch<Station>(orderPaths.station(id),dto,mutationOptions);
 }
 routes(sucursalId:string){return this.http.get<KitchenRoute[]>(orderPaths.routes,params({sucursalId}))}
 createRoute(dto:{estacionId:string;varianteId?:string;categoriaId?:string;prioridad?:number}){
  return this.http.post<KitchenRoute>(orderPaths.routes,dto,mutationOptions);
 }
 updateRoute(id:string,dto:{estacionId?:string;prioridad?:number}){
  return this.http.patch<KitchenRoute>(orderPaths.route(id),dto,mutationOptions);
 }
 deleteRoute(id:string){return this.http.delete<void>(orderPaths.route(id),mutationOptions)}
 changes(sucursalId:string,cursor?:string,limit=50){
  return this.http.get<ChangeFeed>(orderPaths.changes,params({sucursalId,cursor,limit}));
 }
 tickets(q:TicketListQuery){return this.http.get<Page<KitchenTicket>>(orderPaths.tickets,params(q))}
 ticket(id:string){return this.http.get<KitchenTicket>(orderPaths.ticket(id),options)}
 startTicket(id:string){return this.http.post<KitchenTicket>(orderPaths.ticket(id)+'/start',{},mutationOptions)}
 readyTicket(id:string){return this.http.post<KitchenTicket>(orderPaths.ticket(id)+'/ready',{},mutationOptions)}
 startLine(id:string,claveOperacion:string,cantidad?:string){
  return this.http.post<KitchenTicket>(orderPaths.lineKitchen(id)+'/start',
   {claveOperacion,...(cantidad?{cantidad}:{})},mutationOptions);
 }
 readyLine(id:string){return this.http.post<KitchenTicket>(orderPaths.lineKitchen(id)+'/ready',{},mutationOptions)}
 deliverLine(id:string){return this.http.post<KitchenTicket>(orderPaths.lineKitchen(id)+'/deliver',{},mutationOptions)}
}
