/** Snapshot of /api/reports, based on backend main 5a864d9 (2026-11-04). */
export type ReportPeriod='DIA'|'SEMANA'|'MES'|'PERSONALIZADO';
export interface ReportFilters {
 sucursalId:string;periodo:ReportPeriod;fecha?:string;desde?:string;hasta?:string;
}
export interface ReportPageFilters extends ReportFilters {page?:number;limit?:number;}
export interface ReportBranch {id:string;nombre:string;codigo?:string;zonaHoraria?:string;moneda?:string;corte?:string}
export interface OperationalUpcomingReservation {
 id:string;nombreContacto:string;personas:number;inicio:string;estado:'CONFIRMADA'|'PENDIENTE';
}
export interface OperationalDashboard {
 sucursal:ReportBranch;generatedAt:string;freshness:'LIVE_READ';horizonMinutes:number;
 reservationLookaheadHours?:number;
 kpis:{
  pedidosAbiertos:number;comandasPendientes:number;comandasPreparando:number;
  mesasOcupadas:number;entregasEnReparto:number;reservasConfirmadasProximas:number;
  reservasPendientesProximas:number;turnosCajaAbiertos:number;
 };
 proximasReservas?:OperationalUpcomingReservation[];
}
export interface DailyReport {
 fechaOperativa:string;ventasNetas:string;descuentos:string;
 cobrosBrutos:string;reembolsos:string;cobrosNetos:string;
 gastosRegistrados:string;cuentasCerradas:number;ticketsDelDia:number;
}
export interface OverviewKpis {
 ventasNetas:string;descuentos:string;ventasAntesDescuentos:string;
 cuentasCerradas:number;ticketsUnicos:number;ticketPromedio:string|null;
 cobrosBrutos:string;reembolsos:string;cobrosNetos:string;gastosRegistrados:string;
 turnosCajaCerrados:number;diferenciaCajaCerrada:string|null;
 turnosCajaConDiferenciaRegistrada:number;
 estadoDiferenciaCaja:'SIN_CIERRES'|'COMPLETO'|'INCOMPLETO';
 turnosCajaActualmenteAbiertos:number;margenBruto:null;resultadoNeto:null;
}
export interface ReportsOverview {
 sucursal:ReportBranch;generatedAt:string;currency:string;source:'POSTGRESQL';
 estadoDatos:string;periodo:{tipo:ReportPeriod;desde:string;hasta:string;
  desdeUTC:string;hastaUTCExclusivo:string;horaCorte:string;zonaHoraria:string};
 kpis:OverviewKpis;serieDiaria:DailyReport[];
}
export interface PaymentMethodReport {
 metodo:'EFECTIVO'|'TARJETA'|'TRANSFERENCIA'|'OTRO';
 cobrosBrutos:string;reembolsos:string;neto:string;
 cantidadCobros:number;cantidadReembolsos:number;
}
export interface PaymentMethodResponse {
 sucursal:ReportBranch;currency:string;generatedAt:string;data:PaymentMethodReport[];
 periodo:{desde:string;hasta:string};
}
export interface ExpenseCategoryReport {categoria:string;tipo:string;monto:string;registros:number}
export interface ExpenseCategoryResponse {
 sucursal:ReportBranch;currency:string;generatedAt:string;
 periodo:{desde:string;hasta:string};totalRegistrado:string;data:ExpenseCategoryReport[];
}
export interface ReportMeta {page:number;limit:number;total:number;totalPages:number}
export interface ReportPage<T>{data:T[];meta:ReportMeta;periodo:{desde:string;hasta:string}}
export interface ReportTicket {
 id:string;numero:string;total:string;descuentoTotal:string;cerradaEn:string;
 cuentaId:string;orden:{id:string;numero:string;modalidad:string;origen:string;
  estado:string;usuario:{id:string;nombre:string}|null;
  cliente:{id:string;nombre:string}|null};
}
export interface ReportCashShift {
 id:string;fechaOperativa:string;estado:'CERRADO'|'ABIERTO';
 caja:{id:string;codigo:string;nombre:string};cajero:{id:string;nombre:string};
 abiertaEn:string;cerradaEn:string|null;
 fondoInicial:string;efectivoEsperado:string|null;efectivoContado:string|null;
 diferencia:string|null;evidenciaUrl:string;
 movimientos:{ingresos:string;egresos:string;cantidadIngresos:number;cantidadEgresos:number};
}
export const REPORT_SOURCES=[
 'SALES_LINES','INVENTORY_MOVEMENTS','PURCHASE_INVOICES','PURCHASE_RECEIPT_LINES',
 'DELIVERY_EVENTS','RESERVATION_EVENTS','SUPPLY_REQUESTS','SUPPLY_TRANSFERS',
 'PREPARATION_COSTS','SALES_COSTS','ORDER_COST_OUTCOMES','PAYMENT_SALES_RECON',
 'SUPPLIER_BALANCES','PLATFORM_SETTLEMENTS','BANK_MATCH_STATUS'
] as const;
export type ReportSource=typeof REPORT_SOURCES[number];
export interface SourceRecordResponse {
 source:ReportSource;sucursal:ReportBranch;currency:string;generatedAt:string;
 periodo:{desde:string;hasta:string;zonaHoraria:string;corte:string};
 data:Record<string,unknown>[];meta:ReportMeta;totales?:Record<string,unknown>;
 porProducto?:Record<string,unknown>[];porCategoria?:Record<string,unknown>[];
 porVariante?:Record<string,unknown>[];porModalidad?:Record<string,unknown>[];
}
