import {parseApiDecimal} from '../../../shared/formatting';
import {gcErrorMessage} from '../../../core/http/api-error';
import type {AccountDetail,PaymentPart,PaymentAttempt} from './payments.models';
export {money,operationKey} from '../../orders/data-access/orders.helpers';
export const amount=(value:string)=>{
 try{const x=parseApiDecimal(value);return x.gte(0)&&x.decimalPlaces()<=2?x.toFixed(2):null}catch{return null}
};
export const positive=(value:string)=>{
 const n=amount(value);return n!==null&&parseApiDecimal(n).gt(0)?n:null;
};
export const remainder=(account:AccountDetail)=>{
 const pending=account.intentos.filter(x=>x.estado==='PENDIENTE')
  .reduce((s,x)=>s.plus(parseApiDecimal(x.monto)),parseApiDecimal('0'));
 const available=parseApiDecimal(account.saldo).minus(pending);
 return available.gt(0)?available.toFixed(2):'0.00';
};
export const checkParts=(parts:PaymentPart[],available:string):string|null=>{
 if(!parts.length||parts.length>10)return 'Agrega entre uno y diez métodos de pago.';
 let total=parseApiDecimal('0');
 for(const item of parts){
  const n=positive(item.monto);if(!n)return 'Introduce una cantidad válida para cada pago.';
  total=total.plus(parseApiDecimal(n));
  if(item.metodo==='EFECTIVO'){
   const received=amount(item.efectivoRecibido??item.monto);
   if(received===null||parseApiDecimal(received).lt(parseApiDecimal(n)))
    return 'El efectivo recibido debe cubrir la cantidad a cobrar.';
  }
  if(item.metodo==='TRANSFERENCIA'&&!item.referencia?.trim())
   return 'Indica la referencia de la transferencia.';
  if(item.metodo==='TARJETA'&&!item.codigoAutorizacion?.trim())
   return 'Indica el código de autorización de la terminal.';
  if(item.metodo==='OTRO'&&!item.referencia?.trim())
   return 'Indica la referencia del pago.';
 }
 if(total.gt(parseApiDecimal(available)))return 'El cobro supera el saldo disponible de esta cuenta.';
 return null;
};
export const paymentError=(e:unknown)=>{
 const msg=gcErrorMessage(e);
 if(/turno de otro cajero/i.test(msg))return 'Selecciona un turno de caja a tu nombre.';
 if(/Turno cerrado|turno inexistente/i.test(msg))return 'Tu turno de caja ya no está abierto. Actualiza la caja.';
 if(/fuera de fecha operativa|período.*cerrado/i.test(msg))return 'El turno o día de caja ya cerró. Abre un turno válido.';
 if(/Solo se divide cuenta principal/i.test(msg))return 'La cuenta ya tiene movimientos. Solo puedes dividirla antes del primer pago.';
 if(/todas las cuentas deben estar exactamente pagadas/i.test(msg))
  return 'Todavía hay cuentas pendientes de cobro.';
 if(/transferencia exige referencia/i.test(msg))return 'Escribe la referencia de transferencia.';
 if(/tarjeta externa exige código/i.test(msg))return 'Indica el código de autorización de la tarjeta.';
 if(/monto excede|cobertura|excede.*saldo/i.test(msg))return 'El cobro excede el saldo pendiente. Actualiza la cuenta.';
 return msg;
};
export const pendingTotal=(attempts:PaymentAttempt[])=>
 attempts.filter(x=>x.estado==='PENDIENTE').reduce((a,p)=>a.plus(parseApiDecimal(p.monto)),
  parseApiDecimal('0')).toFixed(2);
