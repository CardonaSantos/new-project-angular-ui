import {parseApiDecimal} from '../../../shared/formatting';
import type {CashMovement,CashShift} from './payments.models';
/** Non-authoritative breakdown for display; backend is the source of the expected cash balance. */
export function cashBreakdown(movements:readonly CashMovement[]){
 const zero=parseApiDecimal('0');
 const totals=movements.reduce((r,m)=>{
  const value=parseApiDecimal(m.monto);
  return m.tipo==='INGRESO'?{...r,income:r.income.plus(value),entries:r.entries+1}:
   {...r,outflow:r.outflow.plus(value),exits:r.exits+1};
 },{income:zero,outflow:zero,entries:0,exits:0});
 return {income:totals.income.toFixed(2),outflow:totals.outflow.toFixed(2),
  entries:totals.entries,exits:totals.exits};
}
export function cashFromServer(shift:CashShift|null):string|null{
 return shift?.efectivoCalculado??null;
}
/** A shift from two or more calendar days ago deserves a review before taking new payments.
 * We do not decide whether a financial day is open: that belongs to backend policy. */
export function oldShiftWarning(shift:CashShift|null,timezone:string):boolean{
 if(!shift?.fechaOperativa)return false;
 try{
  const now=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',
   timeZone:timezone}).formatToParts(new Date());
  const year=Number(now.find(p=>p.type==='year')?.value);
  const month=Number(now.find(p=>p.type==='month')?.value);
  const day=Number(now.find(p=>p.type==='day')?.value);
  const today=Date.UTC(year,month-1,day);
  const shiftDay=Date.parse(shift.fechaOperativa.slice(0,10)+'T00:00:00Z');
  return Number.isFinite(shiftDay)&&today-shiftDay>=2*86400000;
 }catch{return false}
}
export function cashMovementName(move:CashMovement){
 const reason=(move.motivo??'').toLowerCase();
 if(reason.includes('repartidor'))return 'Liquidación de entregas';
 if(reason.includes('cobro de cuenta'))return 'Cobro en efectivo';
 return move.tipo==='INGRESO'?'Entrada de efectivo':'Salida de efectivo';
}
