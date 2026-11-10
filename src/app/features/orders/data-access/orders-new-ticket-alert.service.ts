import {Injectable,inject} from '@angular/core';
import {Router} from '@angular/router';
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
 * "Comanda nueva en cocina" alert — ONLY while the viewer is actually on the Cocina screen
 * (/orders/kitchen). POS/Órdenes staff don't need to know a ticket was just created; they already
 * saw their own "enviada a cocina" confirmation when they sent it, and OrdersReadyAlertService
 * tells them separately once it's ready to collect. The listener itself stays wired app-wide (so a
 * late navigation to Cocina doesn't miss a connection), but the route check below gates the actual
 * toast/chime to that one screen.
 * A KITCHEN_TICKET_CREATED socket event only carries a ticket id (see RealtimeGateway) — this
 * fetches that ticket so the toast can name the station and order, then shows a toast plus a chime.
 * Boot this once by injecting it somewhere always-alive (GcAppShell); it has no public API of its
 * own, it only needs to exist for its constructor to wire the listener.
 */
@Injectable({providedIn:'root'})
export class OrdersNewTicketAlertService{
 private readonly realtime=inject(GcRealtimeService);
 private readonly notices=inject(GcNotificationService);
 private readonly api=inject(OrdersApi);
 private readonly router=inject(Router);
 /** Tickets already announced — a retried/duplicated event (e.g. a transaction replay on a
  * serialization conflict) must never ring twice for the same ticket. */
 private readonly announced=new Set<string>();

 constructor(){
  this.realtime.listen<{comandaId?:string}>('KITCHEN_TICKET_CREATED',payload=>{
   const id=payload?.comandaId;
   if(id)void this.announce(id);
  });
 }

 private async announce(ticketId:string):Promise<void>{
  if(this.announced.has(ticketId))return;
  // Not on Cocina right now — skip entirely. If this is just a transaction-retry duplicate of an
  // event we already decided to skip, we deliberately don't remember that, so a genuine later
  // visit to Cocina for a ticket that's still new can still (rarely) catch it; the common case is
  // simply "nobody was on Cocina to hear it", which the on-screen ticket list already covers.
  if(!this.router.url.startsWith('/orders/kitchen'))return;
  this.announced.add(ticketId);
  try{
   const ticket=await firstValueFrom(this.api.ticket(ticketId));
   const numero=ticket.orden?.numero;
   const estacion=ticket.estacion?.nombre;
   const who=estacion?' para '+estacion:'';
   this.notices.show(
    'Nueva comanda'+who+(numero?' — pedido '+numero:'')+'.','info',8000);
  }catch{
   // Couldn't fetch details (permission gap or transient network hiccup) — still ring, since the
   // event itself confirms a ticket was created even if we can't name it right now.
   this.notices.show('Nueva comanda enviada a cocina.','info',8000);
  }
  playNewTicketChime();
 }
}
