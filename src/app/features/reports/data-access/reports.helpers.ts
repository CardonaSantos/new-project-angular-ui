import {formatCalendarDate,formatCurrency,formatDecimal,parseApiDecimal} from '../../../shared/formatting';
import type {ReportFilters,ReportSource,ReportsOverview,DailyReport} from './reports.models';
export const REPORT_LABELS:Record<ReportSource,string>={
 SALES_LINES:'Productos vendidos',INVENTORY_MOVEMENTS:'Movimientos de inventario',
 PURCHASE_INVOICES:'Facturas de proveedores',PURCHASE_RECEIPT_LINES:'Recepciones de mercancía',
 DELIVERY_EVENTS:'Eventos de entregas',RESERVATION_EVENTS:'Eventos de reservas',
 SUPPLY_REQUESTS:'Requisiciones de insumos',SUPPLY_TRANSFERS:'Traslados de insumos',
 PREPARATION_COSTS:'Consumos y costos de cocina',SALES_COSTS:'Costo de las ventas',
 ORDER_COST_OUTCOMES:'Resultados de costos de órdenes',
 PAYMENT_SALES_RECON:'Conciliación de ventas y pagos',
 SUPPLIER_BALANCES:'Saldos de proveedores',
 PLATFORM_SETTLEMENTS:'Liquidaciones de plataformas',
 BANK_MATCH_STATUS:'Conciliación bancaria'
};
export const reportMoney=(amount:string|null|undefined,currency:string)=>{
 if(amount===null||amount===undefined)return 'Sin datos';
 if(currency!=='GTQ'&&currency!=='USD')return formatDecimal(amount,{minimumFractionDigits:2,maximumFractionDigits:2})+' '+currency;
 return formatCurrency(amount,currency);
};
export function periodValid(filter:ReportFilters):boolean{
 if(!filter.sucursalId)return false;
 if(filter.periodo==='PERSONALIZADO'){
  if(!filter.desde||!filter.hasta)return false;
  try{
   formatCalendarDate(filter.desde);formatCalendarDate(filter.hasta);
   const days=Math.round((Date.parse(filter.hasta+'T00:00:00Z')-
    Date.parse(filter.desde+'T00:00:00Z'))/86400000)+1;
   return days>=1&&days<=366;
  }catch{return false}
 }
 if(filter.fecha){
  try{formatCalendarDate(filter.fecha)}catch{return false}
 }
 return true;
}
export function asReportQuery(form:ReportFilters):ReportFilters {
 return {sucursalId:form.sucursalId,periodo:form.periodo,
  ...(form.periodo==='PERSONALIZADO'
   ?{desde:form.desde,hasta:form.hasta}
   :form.fecha?{fecha:form.fecha}:{})};
}
export const chartAmount=(text:string)=>Number(parseApiDecimal(text).toFixed(2));
/** For visualization only: financial totals remain exact decimal strings elsewhere. */
export function dailySeries(report:ReportsOverview,field:keyof DailyReport){
 return report.serieDiaria.map(day=>({day:day.fechaOperativa,
  value:chartAmount(String(day[field]))}));
}
export function safeRate(value:string):number{
 const amount=parseApiDecimal(value);
 return amount.isZero()?0:Math.min(100,Math.max(0,amount.toNumber()));
}
export function fieldLabel(key:string):string{
 const labels:Record<string,string>={
  nombre:'Nombre',numero:'Número',tipo:'Tipo',fecha:'Fecha',
  subtotal:'Subtotal',cantidad:'Cantidad',total:'Total',monto:'Importe',
  descuento:'Descuento',estado:'Estado',categoria:'Categoría',
  costoRegistrado:'Costo registrado',precioUnitario:'Precio unitario',
  cantidadBase:'Cantidad base',descripcion:'Descripción',registros:'Registros'
 };
 return labels[key]??key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,x=>x.toUpperCase());
}
export const sourceScalar=(value:unknown,key:string,currency:string):string=>{
 if(value===null||value===undefined)return '—';
 if(typeof value==='boolean')return value?'Sí':'No';
 if(typeof value==='number')return String(value);
 if(typeof value!=='string')return '—';
 if(/^(importe|monto|precio|costo|subtotal|total|descuento|impuesto|ventas|valor)/i.test(key)
  &&/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value))return reportMoney(value,currency);
 if(/^\d{4}-\d{2}-\d{2}$/.test(value)&&/^(fecha|dia|desde|hasta)/i.test(key))
  return formatCalendarDate(value);
 return value;
};
export const nonMoneyProfit=(value:unknown)=>value===null||value===undefined?'No disponible':String(value);
