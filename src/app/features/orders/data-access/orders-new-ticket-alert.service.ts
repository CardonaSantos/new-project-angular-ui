import {Injectable,inject} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {GcRealtimeService} from '../../../core/realtime/gc-realtime.service';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {OrdersApi} from './orders.api';

/** Short three-note rising chime — deliberately different from the "comanda lista" chime
 * (orders-ready-alert.service.ts) so kitchen staff can tell "new work arrived" apart from
 * "an order is ready to deliver" by ear, without looking at the screen. */
function playNewTicketChime():void{
 if(typeof window==='undefined')return;
 try{
  const Ctx=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  if(!Ctx)return;
  const ctx=new Ctx();
  void ctx.resume();
  const now=ctx.currentTime;
  for(const [i,freq] of [660,880,1100].entries()){
   const osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type='triangle';osc.frequency.value=freq;
   const start=now+i*0.12;
   gain.gain.setValueAtTime(0.0001,start);
   gain.gain.exponentialRampToValueAtTime(0.25,start+0.02);
   gain.gain.exponentialRampToValueAtTime(0.0001,start+0.28);
   osc.connect(gain).connect(ctx.destination);
   osc.start(start);osc.stop(start+0.3);
  }
  setTimeout(()=>void ctx.close(),700);
 }catch{
  // Best-effort: a failed chime must never break the toast that carries the actual information.
 }
}

/**
 * App-wide "comanda nueva en cocina" alert. A KITCHEN_TICKET_CREATED socket event only carries a
 * ticket id (see RealtimeGateway) — this fetches that ticket so the toast can name the station and
 * order, then shows a toast plus a chime. Mirrors OrdersReadyAlertService but for the opposite end
 * of the kitchen flow: this fires once, when the ticket is created, not on every later state change.
 * Boot this once by injecting it somewhere always-alive (GcAppShell); it has no public API of its
 * own, it only needs to exist for its constructor to wire the listener.
 */
@Injectable({providedIn:'root'})
export class OrdersNewTicketAlertService{
 private readonly realtime=inject(GcRealtimeService);
 private readonly notices=inject(GcNotificationService);
 private readonly api=inject(OrdersApi);
 /** Tickets already announced — a retried/duplicated event (e.g. a transaction replay on a
  * serialization conflict) must never ring twice for the same ticket. */
 private readonly announced=new Set<string>();

 constructor(){
  console.log('[new-ticket-alert] servicio arrancado, esperando KITCHEN_TICKET_CREATED');
  this.realtime.listen<{comandaId?:string}>('KITCHEN_TICKET_CREATED',payload=>{
   console.log('[new-ticket-alert] evento recibido',payload);
   const id=payload?.comandaId;
   if(id)void this.announce(id);
  });
 }

 private async announce(ticketId:string):Promise<void>{
  if(this.announced.has(ticketId))return;
  this.announced.add(ticketId);
  try{
   const ticket=await firstValueFrom(this.api.ticket(ticketId));
   const numero=ticket.orden?.numero;
   const estacion=ticket.estacion?.nombre;
   const who=estacion?' para '+estacion:'';
   this.notices.show(
    'Nueva comanda'+who+(numero?' — pedido '+numero:'')+'.','info',8000);
  }catch(e){
   // Couldn't fetch details (permission gap or transient network hiccup) — still ring, since the
   // event itself confirms a ticket was created even if we can't name it right now.
   console.log('[new-ticket-alert] no se pudo consultar el ticket',ticketId,e);
   this.notices.show('Nueva comanda enviada a cocina.','info',8000);
  }
  playNewTicketChime();
 }
}
