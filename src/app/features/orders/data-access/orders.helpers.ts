import {gcErrorMessage} from '../../../core/http/api-error';
import {formatCurrency,formatDecimal,parseApiDecimal} from '../../../shared/formatting';
import type {KitchenTicket,OrderMode,OrderState,TicketState} from './orders.models';
import {modeLabel,stateLabel} from './orders.models';

export const money=(value:string,currency='GTQ')=>{
 try{return currency==='GTQ'||currency==='USD'?formatCurrency(value,currency):value+' '+currency}
 catch{return value+' '+currency}
};
export const qtyText=(value:string)=>{
 try{return formatDecimal(value,{maximumFractionDigits:3})}catch{return value}
};
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
 return message;
};
