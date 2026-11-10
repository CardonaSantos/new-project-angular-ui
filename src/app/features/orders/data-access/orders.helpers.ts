import {gcErrorMessage} from '../../../core/http/api-error';
import {formatCurrency,formatDecimal,parseApiDecimal} from '../../../shared/formatting';
import type {KitchenTicket,OrderMode,OrderState,TableRecord,TicketState} from './orders.models';
import {modeLabel,stateLabel} from './orders.models';

export const money=(value:string,currency='GTQ')=>{
 try{return currency==='GTQ'||currency==='USD'?formatCurrency(value,currency):value+' '+currency}
 catch{return value+' '+currency}
};
export const qtyText=(value:string)=>{
 try{return formatDecimal(value,{maximumFractionDigits:3})}catch{return value}
};
/** A table occupancy cannot be closed while at least one order is still open. */
export const openTableOrders=(table:TableRecord)=>
 (table.ocupacion?.ordenesComoOcupacionMesa??[]).filter(order=>order.estado==='ABIERTA');
export const modeText=(v:OrderMode)=>modeLabel(v);
export const statusText=(v:OrderState|TicketState)=>stateLabel(v);
export const safeQuantity=(v:string):string|null=>{
 try{const d=parseApiDecimal(v);return d.gt(0)&&d.decimalPlaces()<=3?d.toFixed():null}
 catch{return null}
};
export const operationKey=(kind:string)=>kind+':'+crypto.randomUUID();

/** A comanda is only "Entregada" once its individual kitchen lines are delivered.
 * This is a derived display status, not a new backend enum. */
export const kitchenStage=(ticket:KitchenTicket):{label:string;kind:'pending'|'working'|'ready'|'delivered'|'cancelled'}=>{
 if(ticket.estado==='CANCELADA')return {label:'Cancelada',kind:'cancelled'};
 const active=ticket.comandaLineasComoComanda.filter(line=>!line.canceladaEn);
 if(ticket.estado==='LISTA'){
  if(active.length&&active.every(line=>!!line.entregadaEn))
   return {label:'Entregada',kind:'delivered'};
  if(active.some(line=>!!line.entregadaEn))
   return {label:'Entrega parcial',kind:'ready'};
  return {label:'Lista para entregar',kind:'ready'};
 }
 return ticket.estado==='PREPARANDO'
  ?{label:'En preparación',kind:'working'}:{label:'Pendiente',kind:'pending'};
};

/** Ready kitchen lines that still need a delivery record. Safe to retry. */
export const pendingDeliveryLines=(ticket:KitchenTicket)=>
 ticket.comandaLineasComoComanda.filter(line=>!line.canceladaEn&&!!line.listaEn&&!line.entregadaEn);

export const orderFriendlyError=(error:unknown):string=>{
 const message=gcErrorMessage(error);
 if(/Variante preparada sin receta publicada/i.test(message))
  return 'Este producto todavía no tiene una receta publicada. Publícala en Recetas y vuelve a intentar; tu pedido sigue aquí.';
 if(/Variante sin precio vigente en sucursal/i.test(message))
  return 'La presentación no tiene un precio vigente en esta sucursal. Revisa Catálogo > Precios antes de confirmar.';
 if(/Falta configurar la ruta de cocina o ubicación de consumo/i.test(message))
  return 'No se encontró una estación de cocina válida. Configura su ubicación de ingredientes y una ruta de preparación.';
 if(/Configure ubicación de consumo de estación|Estación sin ubicación de consumo/i.test(message))
  return 'La estación de cocina no tiene ubicación de ingredientes. Configúrala en Órdenes > Configuración.';
 if(/Mesa reservada en este horario/i.test(message))
  return 'Esta mesa tiene una reserva vigente. Registra la llegada de la reserva antes de tomar otro pedido.';
 if(/Orden modificada concurrentemente/i.test(message))
  return 'Otra persona modificó el pedido. Actualiza su detalle antes de guardar cambios.';
 if(/clave.+reutilizada|solicitudHash|hashSolicitud/i.test(message))
  return 'Esta solicitud ya se utilizó con otros datos. Revisa el pedido antes de volver a confirmar.';
 if(/No puede gestionar entregas en esta sucursal/i.test(message))
  return 'Tu usuario no tiene permiso para crear entregas en esta sucursal. Pide que te asignen el permiso de Entregas, o guarda el pedido sin enviarlo a reparto.';
 return message;
};

/** Prioritize orders needing service, then tables, then elapsed waiting time.
 * Only sorts tickets returned by the backend for the current page. */
export type KitchenQueueView='active'|'ready'|'cancelled'|'all';
const ticketTime=(value:string|null|undefined):number=>{
 const result=value?Date.parse(value):NaN;
 return Number.isFinite(result)?result:0;
};
export const kitchenReadyAt=(ticket:KitchenTicket):string=>{
 const active=ticket.comandaLineasComoComanda.filter(x=>!x.canceladaEn);
 const last=Math.max(0,...active.map(x=>ticketTime(x.listaEn)));
 return last?new Date(last).toISOString():ticket.enviadaEn;
};
const kitchenLastDeliveredAt=(ticket:KitchenTicket):number=>Math.max(0,
 ...ticket.comandaLineasComoComanda.map(x=>ticketTime(x.entregadaEn)));
export const sortKitchenQueue=(tickets:readonly KitchenTicket[],view:KitchenQueueView):KitchenTicket[]=>{
 const priority=(ticket:KitchenTicket):number=>{
  const state=kitchenStage(ticket).kind;
  if(view==='ready')return state==='ready'?0:1;
  if(view==='all'){
   if(state==='pending'||state==='working')return 0;
   if(state==='ready')return 1;
   return state==='delivered'?2:3;
  }
  return 0;
 };
 const isTable=(ticket:KitchenTicket)=>Boolean(ticket.orden?.ocupacionMesa?.mesa?.numero);
 return [...tickets].sort((a,b)=>{
  const group=priority(a)-priority(b);
  if(group)return group;
  // A table waiting to receive a prepared order comes before a takeaway ticket.
  // A history item must never push a still-undelivered order down the board.
  const kindA=kitchenStage(a).kind,kindB=kitchenStage(b).kind;
  const pendingA=kindA!=='delivered'&&kindA!=='cancelled';
  const pendingB=kindB!=='delivered'&&kindB!=='cancelled';
  if(pendingA&&pendingB&&isTable(a)!==isTable(b))return isTable(a)?-1:1;
  if(kindA==='delivered'&&kindB==='delivered')
   return kitchenLastDeliveredAt(b)-kitchenLastDeliveredAt(a);
  if(view==='ready'||(view==='all'&&kindA==='ready'&&kindB==='ready'))
   return ticketTime(kitchenReadyAt(a))-ticketTime(kitchenReadyAt(b));
  return ticketTime(a.enviadaEn)-ticketTime(b.enviadaEn);
 });
};
