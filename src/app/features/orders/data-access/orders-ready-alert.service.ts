import {Injectable,inject} from '@angular/core';
import {Router} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcRealtimeService} from '../../../core/realtime/gc-realtime.service';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {OrdersApi} from './orders.api';
import {kitchenStage} from './orders.helpers';

/** Short two-note chime via Web Audio — no asset file to ship, works offline. Browsers that
 * block audio without a prior user gesture simply stay silent; the toast still shows either way. */
function playReadyChime():void{
 if(typeof window==='undefined')return;
 try{
  const Ctx=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  if(!Ctx)return;
  const ctx=new Ctx();
  void ctx.resume();
  const now=ctx.currentTime;
  for(const [i,freq] of [880,1320].entries()){
   const osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type='sine';osc.frequency.value=freq;
   const start=now+i*0.18;
   gain.gain.setValueAtTime(0.0001,start);
   gain.gain.exponentialRampToValueAtTime(0.3,start+0.02);
   gain.gain.exponentialRampToValueAtTime(0.0001,start+0.35);
   osc.connect(gain).connect(ctx.destination);
   osc.start(start);osc.stop(start+0.4);
  }
  setTimeout(()=>void ctx.close(),800);
 }catch{
  // Best-effort: a failed chime must never break the toast that carries the actual information.
 }
}

/**
 * "Comanda lista" alert for Órdenes/POS — NOT Cocina, which already sees its own tickets update
 * live and gets its own local "marcada lista" confirmation when someone there presses the button.
 * A KITCHEN_TICKET_UPDATED socket event only carries a ticket id (see RealtimeGateway) — this
 * fetches that ticket, and if it just became ready to deliver, shows a toast (with a short chime
 * and a direct "Cobrar" link to that order) so cashiers notice and can act without hunting for the
 * order themselves. The listener stays wired app-wide; the route check below gates the actual
 * toast/chime to Órdenes/POS screens.
 * Boot this once by injecting it somewhere always-alive (GcAppShell); it has no public API of its
 * own, it only needs to exist for its constructor to wire the listener.
 */
@Injectable({providedIn:'root'})
export class OrdersReadyAlertService{
 private readonly realtime=inject(GcRealtimeService);
 private readonly notices=inject(GcNotificationService);
 private readonly api=inject(OrdersApi);
 private readonly router=inject(Router);
 /** Tickets currently known "ready" — avoids re-announcing the same ticket on every follow-up
  * event (e.g. a second line on the same comanda becoming ready too). */
 private readonly announced=new Set<string>();
 /** Screens where a cashier actually acts on this; Cocina is deliberately excluded. */
 private onRelevantScreen():boolean{
  const url=this.router.url;
  return url.startsWith('/orders/pos')||url.startsWith('/orders/list')||url==='/orders';
 }

 constructor(){
  console.log('[ready-alert] servicio arrancado, esperando KITCHEN_TICKET_UPDATED');
  this.realtime.listen<{comandaId?:string}>('KITCHEN_TICKET_UPDATED',payload=>{
   console.log('[ready-alert] evento recibido',payload);
   const id=payload?.comandaId;
   if(id)void this.check(id);
  });
 }

 private async check(ticketId:string):Promise<void>{
  try{
   const ticket=await firstValueFrom(this.api.ticket(ticketId));
   const stage=kitchenStage(ticket).kind;
   console.log('[ready-alert] ticket',ticketId,'stage=',stage,'ya anunciado=',this.announced.has(ticketId));
   // "Lista y entregada" (readyDeliver) jumps straight to 'delivered' in one step — it never passes
   // through 'ready' at all — but POS still needs to collect payment either way, so both stages
   // trigger the same alert. Only 'pending'/'working'/'cancelled' reset the dedup guard.
   if(stage!=='ready'&&stage!=='delivered'){this.announced.delete(ticketId);return}
   if(this.announced.has(ticketId))return;
   this.announced.add(ticketId);
   if(!this.onRelevantScreen())return;
   const numero=ticket.orden?.numero;
   const label=numero?'Pedido '+numero:'Una comanda';
   this.notices.show(
    stage==='delivered'?label+' fue entregado — ya puedes cobrarlo.':label+' ya está lista para entregar.',
    'success',8000,
    ticket.ordenId?{label:'Cobrar',path:['/orders/list',ticket.ordenId]}:undefined);
   playReadyChime();
  }catch(e){
   // A viewer without kitchen.read (or a transient network hiccup) just gets no alert this time;
   // the next event (or the existing Cocina poll) will catch up regardless.
   console.log('[ready-alert] no se pudo consultar el ticket',ticketId,e);
  }
 }
}
