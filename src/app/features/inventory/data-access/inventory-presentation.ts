import {formatCalendarDate,formatCurrency,formatInstant} from '../../../shared/formatting';

const MOVEMENT_LABELS:Record<string,string>={
 APERTURA:'Saldo inicial',SALDO_INICIAL:'Saldo inicial',OPENING:'Saldo inicial',
 ENTRADA:'Entrada',INBOUND:'Entrada',COMPRA:'Compra',
 SALIDA:'Salida',OUTBOUND:'Salida',CONSUMO:'Consumo',
 CONSUMO_INTERNO:'Consumo interno',MERMA:'Merma',WASTE:'Merma',
 AJUSTE_ENTRADA:'Ajuste de entrada',AJUSTE_SALIDA:'Ajuste de salida',
 AJUSTE_POSITIVO:'Ajuste de entrada',AJUSTE_NEGATIVO:'Ajuste de salida',
 TRANSFERENCIA_ENTRADA:'Transferencia recibida',
 TRANSFERENCIA_SALIDA:'Transferencia enviada',
 RECEPCION:'Recepción',DEVOLUCION:'Devolución',
};
export function inventoryMovementLabel(value:string):string{
 return MOVEMENT_LABELS[value]??value.replaceAll('_',' ').toLowerCase()
  .replace(/^./,character=>character.toUpperCase());
}
export function inventoryInstant(value:string|null|undefined,zone:string|undefined):string{
 if(!value||!zone)return '—';
 try{return formatInstant(value,zone)}
 catch{return 'Fecha no disponible'}
}
export function inventoryCalendar(value:string|null|undefined):string{
 if(!value)return '—';
 try{return formatCalendarDate(value)}
 catch{return 'Fecha no disponible'}
}
export function inventoryMoney(value:unknown):string{
 if(typeof value!=='string'&&typeof value!=='number')return '—';
 try{return formatCurrency(String(value),'GTQ')}
 catch{return '—'}
}
export function valuationMethod(value:unknown):string{
 if(value==='PROMEDIO_PONDERADO')return 'Costo promedio ponderado';
 if(value==='FIFO')return 'FIFO (primeras entradas, primeras salidas)';
 return typeof value==='string'&&value?value.replaceAll('_',' '):'No especificado';
}
export interface InventoryValuationRow{
 id:string; nombre:string; codigo:string; valor:string;
}
export function inventoryValuationRows(payload:Record<string,unknown>):InventoryValuationRow[]{
 if(!Array.isArray(payload['articulos']))return [];
 return payload['articulos'].flatMap((record:unknown,index:number)=>{
  if(!record||typeof record!=='object')return [];
  const a=record as Record<string,unknown>;
  return [{
   id:typeof a['articuloId']==='string'?a['articuloId']:String(index),
   nombre:typeof a['nombre']==='string'&&a['nombre']?a['nombre']:'Nombre no proporcionado por el servidor',
   codigo:typeof a['codigo']==='string'&&a['codigo']?a['codigo']:'—',
   valor:inventoryMoney(a['valor']),
  }];
 });
}
