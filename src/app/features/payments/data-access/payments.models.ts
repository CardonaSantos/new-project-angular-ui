/** PAY-A contracts from backend main, 2026-11-03. Amounts remain decimal strings. */
export type PaymentMethod='EFECTIVO'|'TARJETA'|'TRANSFERENCIA'|'OTRO';
export type AttemptState='PENDIENTE'|'CONFIRMADO'|'CANCELADO';
export interface Page<T>{data:T[];meta:{page:number;limit:number;total:number;totalPages:number}}
export interface CashRegister{id:string;sucursalId:string;codigo:string;nombre:string;activa:boolean}
export interface CashMovement{id:string;turnoId:string;tipo:'INGRESO'|'EGRESO';monto:string;motivo:string;creadoEn:string}
export interface CashShift{
 id:string;cajaId:string;cajeroId:string;fondoInicial:string;fechaOperativa:string;
 abiertaEn:string;cerradaEn:string|null;efectivoCalculado?:string;
 efectivoEsperado?:string|null;efectivoContado?:string|null;diferencia?:string|null;
 notaCierre?:string|null;
 caja?:CashRegister;movimientoCajasComoTurno?:CashMovement[];
}
export interface AccountLine{id:string;cuentaId:string;ordenLineaId:string;cantidadAsignada:string;
 importeAsignado:string;ordenLinea?:{id:string;nombreSnapshot:string;cantidad:string;precioUnitario:string}}
export interface AccountSummary{id:string;ordenId:string;estado:string;nombre:string|null;total:string;
 pagado:string;abiertaEn?:string;cuentaLineasComoCuenta?:AccountLine[]}
export interface PaymentRecord{
 id:string;cuentaId:string;metodo:PaymentMethod;monto:string;cobradoEn:string;
 vuelto:string|null;efectivoRecibido:string|null;referencia:string|null;
 codigoAutorizacion:string|null;reembolsoPagosComoPago?:{id:string;monto:string;motivo:string}[];
}
export interface PaymentAttempt{
 id:string;cuentaId:string;metodo:PaymentMethod;monto:string;estado:AttemptState;
 referenciaExterna:string|null;creadoEn:string
}
export interface SaleRecord{
 id:string;numero:string;cuentaId:string;sucursalId:string;total:string;
 cerradaEn:string;descuentoTotal:string;
 ventaLineasComoVenta?:{id:string;descripcion:string;cantidad:string;subtotal:string;
  precioUnitario:string;descuento:string}[];
 cuenta?:{id:string;orden?:{id:string;numero:string;modalidad:string;estado:string;
  cliente?:{id:string;nombre:string}|null}};
}
export interface SalesFilters{
 search?:string;desde?:string;hasta?:string;minTotal?:string;maxTotal?:string;
}
export interface AccountDetail{
 id:string;ordenId:string;sucursalId:string;estado:string;total:string;pagado:string;
 saldo:string;reembolsado:string;netoRecibido:string;lineas:AccountLine[];
 pagos:PaymentRecord[];intentos:PaymentAttempt[];venta:SaleRecord|null;
}
export interface PaymentPart{
 metodo:PaymentMethod;monto:string;efectivoRecibido?:string;referencia?:string;
 codigoAutorizacion?:string;terminalReferencia?:string;
}
export interface CollectInput{turnoId:string;pagos:PaymentPart[];claveOperacion:string}
export interface RefundInput{monto:string;motivo:string;referenciaExterna?:string;
 turnoId?:string;claveOperacion:string}
export interface AllocateLine{ordenLineaId:string;cantidadAsignada:string;importeAsignado:string}
export interface AccountSplitInput{cuentas:{nombre:string;lineas:AllocateLine[]}[];claveOperacion:string}
export interface PaymentSummary{
 sucursalId:string;cobradoBruto:string;reembolsado:string;cobradoNeto:string;
 ventasInternas:string;cantidadVentas:number;cajaDiferenciaAcumulada:string;
 turnosCerrados:number;porMetodo:{metodo:PaymentMethod;total:string;cantidad:number}[];
}
export const METHODS:{id:PaymentMethod;label:string}[]=[
 {id:'EFECTIVO',label:'Efectivo'},{id:'TARJETA',label:'Tarjeta'},
 {id:'TRANSFERENCIA',label:'Transferencia'},{id:'OTRO',label:'Otro'}];
export const methodLabel=(m:PaymentMethod)=>METHODS.find(x=>x.id===m)?.label??m;
