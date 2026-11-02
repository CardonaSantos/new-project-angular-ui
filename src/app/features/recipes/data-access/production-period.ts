import dayjs from 'dayjs';
import {parseCalendarDate} from '../../../shared/formatting';

/** Inclusive calendar days in the chosen branch, transformed to offset timestamps. */
export function branchDayStart(date:string,timeZone:string):string{
 parseCalendarDate(date);
 const start=dayjs.tz(date+' 00:00:00','YYYY-MM-DD HH:mm:ss',timeZone);
 if(!start.isValid())throw new Error('No se pudo interpretar la fecha para esta sucursal.');
 return start.format('YYYY-MM-DDTHH:mm:ssZ');
}
export function inclusiveBranchPeriod(from:string,to:string,timeZone:string){
 if(from&&to&&from>to)throw new Error('La fecha inicial no puede ser posterior a la fecha final.');
 return {
  ...(from?{fechaDesde:branchDayStart(from,timeZone)}:{}),
  ...(to?{fechaHasta:branchDayStart(parseCalendarDate(to).add(1,'day').format('YYYY-MM-DD'),timeZone)}:{})
 };
}
