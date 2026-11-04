import {parseApiDecimal,toApiDecimal} from '../../../shared/formatting';
export const positiveDecimal=/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/;
export function decimal(value:string,allowZero=false):string|null {
 try{
  const trimmed=value.trim().replace(',','.');
  if(!positiveDecimal.test(trimmed))return null;
  const n=parseApiDecimal(trimmed);
  return n.lt(0)||(!allowZero&&n.lte(0))?null:toApiDecimal(trimmed);
 }catch{return null}
}
export function money(value:string|number|null|undefined):string {
 if(value===null||value===undefined)return '—';
 try{
  return 'Q '+parseApiDecimal(String(value)).toDecimalPlaces(2).toFixed(2);
 }catch{return '—'}
}
export function newKey():string{return crypto.randomUUID()}
export interface Option{id:string;label:string}
export const asOptions=(items:{id:string;nombre:string}[]):Option[]=>
 items.map(x=>({id:x.id,label:x.nombre}));
export const canConfirmReceipt=(state:string,allowed:boolean)=>state==='BORRADOR'&&allowed;
export const canEditReceipt=(state:string,allowed:boolean)=>state==='BORRADOR'&&allowed;
