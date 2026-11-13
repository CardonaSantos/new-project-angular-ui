import {Injectable,inject} from '@angular/core';
import {GcRealtimeService} from '../../../core/realtime/gc-realtime.service';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';

/** Short urgent two-note "ping" — distinct from the kitchen chimes (orders-ready-alert.service.ts,
 * orders-new-ticket-alert.service.ts) so staff can tell "a customer needs help" apart from kitchen
 * events by ear. */
function playHelpChime():void{
 if(typeof window==='undefined')return;
 try{
  const Ctx=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  if(!Ctx)return;
  const ctx=new Ctx();
  void ctx.resume();
  const now=ctx.currentTime;
  for(const [i,freq] of [988,988].entries()){
   const osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type='square';osc.frequency.value=freq;
   const start=now+i*0.22;
   gain.gain.setValueAtTime(0.0001,start);
   gain.gain.exponentialRampToValueAtTime(0.22,start+0.015);
   gain.gain.exponentialRampToValueAtTime(0.0001,start+0.2);
   osc.connect(gain).connect(ctx.destination);
   osc.start(start);osc.stop(start+0.22);
  }
  setTimeout(()=>void ctx.close(),700);
 }catch{
  // Best-effort: a failed chime must never break the toast that carries the actual information.
 }
}

/**
 * "Mesa solicita ayuda" alert for staff, fired by a customer tapping "Llamar a un mesero" in the
 * self-service page (self-service.controller.ts's POST /self-service/call-waiter, relayed over
 * RealtimePort as TABLE_HELP_REQUESTED — see realtime.gateway.ts). Unlike the kitchen alerts this
 * is NOT route-gated: a table asking for help is relevant wherever staff happen to be looking.
 * Boot this once by injecting it somewhere always-alive (GcAppShell); it has no public API of its
 * own, it only needs to exist for its constructor to wire the listener.
 */
@Injectable({providedIn:'root'})
export class TableHelpAlertService{
 private readonly realtime=inject(GcRealtimeService);
 private readonly notices=inject(GcNotificationService);

 constructor(){
  this.realtime.listen<{mesaId?:string;mesaNumero?:string|null;sala?:string|null;ordenId?:string|null}>(
   'TABLE_HELP_REQUESTED',payload=>this.announce(payload));
 }

 private announce(payload:{mesaId?:string;mesaNumero?:string|null;sala?:string|null;ordenId?:string|null}):void{
  const where=[payload.mesaNumero?'Mesa '+payload.mesaNumero:null,payload.sala].filter(Boolean).join(' · ');
  // The table may not have an open order yet (e.g. it's calling before ordering at all) — only
  // deep-link into it when there's actually something there to act on; otherwise fall back to the
  // table-admin screen, which at least lets staff find and walk over to the right table.
  const link=payload.ordenId?{label:'Ver pedido',path:['/orders/list',payload.ordenId]}
   :{label:'Ver mesas',path:['/orders/tables/manage']};
  this.notices.show((where||'Una mesa')+' solicita un mesero.','warning',10000,link);
  playHelpChime();
 }
}
