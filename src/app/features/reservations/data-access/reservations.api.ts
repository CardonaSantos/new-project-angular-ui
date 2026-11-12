
import {HttpClient,HttpParams} from '@angular/common/http';
import {inject,Injectable} from '@angular/core';
import {gcSilentRequest} from '../../../core/http/api-context';
import type {
 ReservationPage,ReservationSummary,ReservationDetail,AvailableTable,ReservationState,
 ReservationReminder,ReminderState
} from './reservations.models';

const safe=(id:string)=>encodeURIComponent(id);
export const reservationPaths={
 base:'/api/reservations',availability:'/api/reservations/availability',
 reminders:'/api/reservations/reminders',
 one:(id:string)=>'/api/reservations/'+safe(id),
 confirm:(id:string)=>'/api/reservations/'+safe(id)+'/confirm',
 cancel:(id:string)=>'/api/reservations/'+safe(id)+'/cancel',
 noShow:(id:string)=>'/api/reservations/'+safe(id)+'/no-show',
 checkIn:(id:string)=>'/api/reservations/'+safe(id)+'/check-in',
 reminder:(id:string)=>'/api/reservations/reminders/'+safe(id),
} as const;
const readOptions={context:gcSilentRequest()};
const query=(filters:Record<string,string|number|boolean|undefined>)=>{
 let params=new HttpParams();
 for(const [key,value] of Object.entries(filters))
  if(value!==undefined&&value!=='')params=params.set(key,String(value));
 return {params,...readOptions};
};

@Injectable({providedIn:'root'})
export class ReservationsApi{
 private readonly http=inject(HttpClient);
 availability(q:{sucursalId:string;inicio:string;fin:string;personas:number}){
  return this.http.get<AvailableTable[]>(reservationPaths.availability,query(q));
 }
 list(q:{sucursalId:string;desde?:string;hasta?:string;estado?:ReservationState|'';
  search?:string;page?:number;limit?:number}){
  return this.http.get<ReservationPage<ReservationSummary>>(reservationPaths.base,query(q));
 }
 detail(id:string){
  return this.http.get<ReservationDetail>(reservationPaths.one(id),readOptions);
 }
 create(body:{sucursalId:string;claveOperacion:string;nombreContacto:string;
  telefonoContacto?:string|null;emailContacto?:string|null;personas:number;
  inicio:string;fin:string;clienteId?:string|null;notas?:string|null;
  estadoInicial?:'PENDIENTE'|'CONFIRMADA';mesaIds?:string[]}){
  return this.http.post<ReservationDetail>(reservationPaths.base,body);
 }
 update(id:string,body:{nombreContacto?:string;telefonoContacto?:string|null;
  emailContacto?:string|null;personas?:number;inicio?:string;fin?:string;
  clienteId?:string|null;notas?:string|null;mesaIds?:string[]}){
  return this.http.patch<ReservationDetail>(reservationPaths.one(id),body);
 }
 confirm(id:string){
  return this.http.post<ReservationDetail>(reservationPaths.confirm(id),{});
 }
 cancel(id:string,body:{motivo:string}){
  return this.http.post<ReservationDetail>(reservationPaths.cancel(id),body);
 }
 noShow(id:string,body:{motivo:string}){
  return this.http.post<ReservationDetail>(reservationPaths.noShow(id),body);
 }
 checkIn(id:string){
  return this.http.post<ReservationDetail>(reservationPaths.checkIn(id),{});
 }
 reminders(q:{sucursalId:string;estado?:ReminderState;desde?:string;hasta?:string}){
  return this.http.get<ReservationReminder[]>(reservationPaths.reminders,query(q));
 }
 // Internal checklist action only — ENVIADO means "staff contacted the customer",
 // never triggers a real SMS/email send.
 markReminder(id:string,estado:'ENVIADO'|'CANCELADO'){
  return this.http.patch<ReservationReminder>(reservationPaths.reminder(id),{estado});
 }
}
