/** ORD-A: endpoint DTOs mirror main/src/modules/orders/presentation/http/dto/orders.dto.ts. */
export type OrderMode='MESA'|'MOSTRADOR'|'PARA_LLEVAR'|'DELIVERY';
export type OrderOrigin='CAJA'|'MESERO'|'QUIOSCO'|'QR'|'WEB'|'TELEFONO'|'PLATAFORMA';
export type OrderState='ABIERTA'|'CERRADA'|'CANCELADA';
export type TicketState='PENDIENTE'|'PREPARANDO'|'LISTA'|'CANCELADA';
export type CancellationClass='CORTESIA'|'MERMA_OPERATIVA'|'ERROR_OPERATIVO'|'OTRO';
export interface PageMeta {page:number;limit:number;total:number;totalPages:number}
export interface Page<T>{data:T[];meta:PageMeta}
export interface ChangeFeed {data:KitchenEvent[];meta:{hasMore:boolean;nextCursor:string|null}}
export interface KitchenEvent {id:string;tipo:string;agregadoId:string;creadoEn:string;payload:Record<string,unknown>}
export interface OrderLineInput{
 varianteId:string;cantidad:string;modificadores?:{modificadorId:string}[];
 descuento?:string;notasCocina?:string;
}
export interface CreateOrderInput{
 sucursalId:string;modalidad:OrderMode;origen?:OrderOrigin;mesaId?:string;
 clienteId?:string;observaciones?:string;lineas:OrderLineInput[];
 enviarCocina?:boolean;claveOperacion:string;
}
export interface AddLinesInput{lineas:OrderLineInput[];enviarCocina?:boolean;claveOperacion:string}
export interface EditLineInput extends Partial<Omit<OrderLineInput,'varianteId'>>{claveOperacion:string}
export interface OrderSummary{
 id:string;numero:string;modalidad:OrderMode;origen:OrderOrigin;estado:OrderState;
 version:number;total:string;abiertaEn:string;ocupacionMesaId:string|null;
}
export interface OrderLineModifier {id:string;modificadorId:string;nombreSnapshot:string;cantidad:number;recargoUnitario:string}
export interface OrderLine{
 id:string;ordenId:string;varianteId:string;cantidad:string;cantidadEnviada:string;
 precioUnitario:string;subtotal:string;descuento:string;notasCocina:string|null;
 nombreSnapshot:string;canceladaEn:string|null;
 variante?:{nombre:string;producto?:{nombre:string;tipo:string}};
 ordenLineaModificadoresComoOrdenLinea?:OrderLineModifier[];
 comandaLineasComoOrdenLinea?:KitchenLine[];
}
export interface Account{ id:string;estado:string;total:string;pagado:string }
export interface OrderDetail extends OrderSummary{
 sucursalId:string;clienteId:string|null;observaciones:string|null;
 subtotal:string;descuentoTotal:string;
 ordenLineasComoOrden:OrderLine[];
 cuentasComoOrden:Account[];
 ocupacionMesa?:{id:string;mesa?:{id:string;numero:string;sala?:{id:string;nombre:string}}}|null;
 comandasComoOrden?:{id:string;numero:string;estado:TicketState;estacionId:string;enviadaEn:string}[];
}
export interface Room{id:string;sucursalId:string;nombre:string;activa:boolean;orden:number;mesasComoSala?:{id:string;numero:string;capacidad:number;activa:boolean}[]}
export interface Occupancy{id:string;mesaId:string;cerradaEn:string|null;ordenesComoOcupacionMesa?:{id:string;numero:string;estado:OrderState;total:string;cerradaEn:string|null}[]}
export interface TableRecord{id:string;numero:string;capacidad:number;activa:boolean;sala:{id:string;nombre:string};ocupacion:Occupancy|null}
export interface Station{id:string;sucursalId:string;nombre:string;activa:boolean;ubicacionConsumoId:string|null;ubicacionConsumo?:{id:string;nombre:string;codigo:string}|null}
export interface KitchenRoute{id:string;estacionId:string;varianteId:string|null;categoriaId:string|null;prioridad:number;
 estacion?:{id:string;nombre:string;activa:boolean};categoria?:{id:string;nombre:string}|null;variante?:{id:string;nombre:string}|null}
export interface KitchenLine{
 id:string;comandaId:string;ordenLineaId:string;cantidad:string;cantidadPreparada:string;
 listaEn:string|null;entregadaEn:string|null;canceladaEn:string|null;
 notasSnapshot?:string|null;ordenLinea?:OrderLine;
}
export interface KitchenTicket{
 id:string;numero:string;estado:TicketState;estacionId:string;ordenId:string;enviadaEn:string;
 estacion?:{id:string;nombre:string;ubicacionConsumoId:string|null};
 orden?:{id:string;numero:string;modalidad:OrderMode;estado:OrderState;observaciones:string|null;ocupacionMesa?:{mesa:{numero:string}}|null};
 comandaLineasComoComanda:KitchenLine[];
}
export interface OrderListQuery{sucursalId:string;estado?:OrderState;modalidad?:OrderMode;search?:string;page?:number;limit?:number}
export interface TicketListQuery{sucursalId:string;estacionId?:string;estado?:TicketState;page?:number;limit?:number}
export const ORDER_MODES:{id:OrderMode;label:string}[]=[
 {id:'MOSTRADOR',label:'En mostrador'},{id:'MESA',label:'Para una mesa'},
 {id:'PARA_LLEVAR',label:'Para llevar'},{id:'DELIVERY',label:'A domicilio'}];
export const ORDER_STATES:{id:OrderState;label:string}[]=[
 {id:'ABIERTA',label:'Abierta'},{id:'CERRADA',label:'Cerrada'},{id:'CANCELADA',label:'Cancelada'}];
export const TICKET_STATES:{id:TicketState;label:string}[]=[
 {id:'PENDIENTE',label:'Pendiente'},{id:'PREPARANDO',label:'Preparando'},
 {id:'LISTA',label:'Lista'},{id:'CANCELADA',label:'Cancelada'}];
export const CANCELLATION_CLASSES:{id:CancellationClass;label:string}[]=[
 {id:'CORTESIA',label:'Cortesía'},{id:'MERMA_OPERATIVA',label:'Merma operativa'},
 {id:'ERROR_OPERATIVO',label:'Error operativo'},{id:'OTRO',label:'Otro'}];
export const modeLabel=(value:OrderMode)=>ORDER_MODES.find(x=>x.id===value)?.label??value;
export const stateLabel=(value:OrderState|TicketState)=>
 [...ORDER_STATES,...TICKET_STATES].find(x=>x.id===value)?.label??value;
