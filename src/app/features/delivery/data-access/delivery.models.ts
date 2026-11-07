export type DeliveryState='PENDIENTE'|'EN_REPARTO'|'ENTREGADA'|'CANCELADA';
export interface DeliveryOrderSummary{
 id:string;numero:string;sucursalId:string;clienteId:string|null;
 modalidad:string;origen:string;estado:string;total:string;
}
export interface DeliveryCourier{id:string;nombre:string}
export interface DeliveryChannel{id:string;codigo:string;nombre:string}
export interface DeliveryRecord{
 id:string;ordenId:string;orden:DeliveryOrderSummary;
 direccionId:string|null;direccionTexto:string;referenciaDireccion:string|null;
 telefonoContacto:string|null;repartidorId:string|null;repartidor:DeliveryCourier|null;
 canalExternoId:string|null;canalExterno:DeliveryChannel|null;referenciaExterna:string|null;
 estado:DeliveryState;costoEnvio:string;cobrableContraEntrega:string;
 enRepartoEn:string|null;entregadaEn:string|null;nota:string|null;
}
export interface DeliveryPage<T>{data:T[];meta:{page:number;limit:number;total:number;totalPages:number}}
export interface DeliveryEvent{
 id:string;accion:string;estadoAntes:DeliveryState|null;estadoDespues:DeliveryState;
 usuarioId:string;repartidorAntesId:string|null;repartidorDespuesId:string|null;
 motivo:string|null;creadoEn:string;
}
export type ClosureBlocker='ORDER_NOT_OPEN'|'DELIVERY_NOT_COMPLETED'|'NO_ORDER_LINES'|
 'LINES_NOT_SENT'|'KITCHEN_PENDING'|'NO_ACCOUNTS'|'ACCOUNTS_UNPAID';
export interface ClosureReadiness{
 entregaId:string;ordenId:string;alreadyClosed:boolean;canFinalize:boolean;blockers:ClosureBlocker[];
}
export interface DeliveryCreateInput{
 ordenId:string;claveOperacion:string;direccionId?:string;direccionTexto?:string;
 referenciaDireccion?:string|null;telefonoContacto?:string|null;
 repartidorId?:string;canalExternoId?:string;referenciaExterna?:string|null;
}
export interface DeliveryDestinationInput{
 claveOperacion:string;direccionId?:string;direccionTexto?:string;
 referenciaDireccion?:string|null;telefonoContacto?:string|null;
}
export const DELIVERY_STATE_LABEL:Record<DeliveryState,string>={
 PENDIENTE:'Pendiente',EN_REPARTO:'En reparto',ENTREGADA:'Entregada',CANCELADA:'Cancelada'
};
export const CLOSURE_BLOCKER_LABEL:Record<ClosureBlocker,string>={
 ORDER_NOT_OPEN:'La orden ya no está abierta',
 DELIVERY_NOT_COMPLETED:'La entrega todavía no está marcada como entregada',
 NO_ORDER_LINES:'La orden no tiene líneas',
 LINES_NOT_SENT:'Hay líneas que cocina aún no envió',
 KITCHEN_PENDING:'Hay comandas pendientes o en preparación',
 NO_ACCOUNTS:'La orden no tiene cuentas',
 ACCOUNTS_UNPAID:'Hay cuentas sin pagar por completo',
};
