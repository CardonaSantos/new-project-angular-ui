import {formatCurrency,formatDecimal,parseApiDecimal} from '../../../shared/formatting';
import type {OrderMode,OrderState,TicketState} from './orders.models';
import {modeLabel,stateLabel} from './orders.models';

export const money=(value:string,currency='GTQ')=>{
 try{return formatCurrency(value,currency)}catch{return value+' '+currency}
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
