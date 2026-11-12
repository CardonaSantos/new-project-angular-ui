export type CourierSettlementState='ABIERTA'|'CERRADA';

export interface CourierPendingPayment{
 pagoId:string;cuentaId:string;entregaId:string|null;repartidorId:string|null;
 monto:string;cobradoEn:string;
}
export interface CourierCashCollectInput{cuentaId:string;monto:string;claveOperacion:string}
export interface CourierCashCollectResult{pagoId:string;cuentaId:string;monto:string}
export interface CourierPendingPage{
 data:CourierPendingPayment[];meta:{page:number;limit:number;total:number;totalPages:number};
}
export interface CourierSettlementLine{pagoId:string;entregaId:string;monto:string}
export interface CourierSettlementDirectResult{
 id:string;estado:CourierSettlementState;sucursalId:string;repartidorId:string;turnoCajaId:string;
 totalEsperado:string;totalEntregado:string;movimientoCajaId:string;lineas:CourierSettlementLine[];
}
export interface CourierSettlementDetail{
 id:string;estado:CourierSettlementState;sucursalId:string;repartidorId:string;turnoCajaId:string|null;
 totalEsperado:string;totalEntregado:string;cerradaEn:string|null;movimientoCajaId:string|null;
 lineas:CourierSettlementLine[];
}
export interface DirectCourierSettlementInput{
 sucursalId:string;repartidorId:string;pagoIds:string[];turnoCajaId:string;
 totalEntregado:string;claveOperacion:string;
}
export interface PlatformChannel{id:string;codigo:string;nombre:string}
export interface RegisterChannelInput{
 sucursalId:string;codigo:string;nombre:string;claveOperacion:string;
}
export const COURIER_SETTLEMENT_STATE_LABEL:Record<CourierSettlementState,string>={
 ABIERTA:'Abierta',CERRADA:'Cerrada'
};
