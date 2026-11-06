
export type InventoryKind='INGREDIENTE'|'PREPARACION'|'PRODUCTO_TERMINADO'|'EMPAQUE'|'SUMINISTRO';
export type Dimension='UNIDAD'|'MASA'|'VOLUMEN'|'LONGITUD';
export type CountStatus='BORRADOR'|'CONFIRMADO'|'CANCELADO';
export type TransferStatus='BORRADOR'|'EN_TRANSITO'|'RECIBIDA'|'CANCELADA';
export interface InventoryPage<T> {data:T[];meta:{page:number;limit:number;total:number;totalPages:number}}
export interface InventoryOptions<T> {data:T[];meta:{hasMore:boolean;nextCursor:string|null}}
export interface RecordId {id:string}
export interface InventoryPhoto {mediaId:string;principal:boolean;orden:number;url:string|null;nombreOriginal?:string;confirmada?:boolean}
export interface Unit {id:string;codigo:string;nombre:string;dimension:Dimension;esBase:boolean;activo?:boolean}
export interface Conversion {id:string;unidadOrigen?:Unit;unidadDestino?:Unit;factor:string;dimension?:Dimension}
export interface Article extends RecordId {
 codigo:string;nombre:string;tipo:InventoryKind;activo:boolean;
 unidadBase:Unit;requiereLote:boolean;requiereVencimiento:boolean;
 stockMinimo:string|null;costoReferencia?:string|null;
 imagenPrincipalUrl:string|null;imagenPrincipalId:string|null;imagenes:InventoryPhoto[];
 creadoEn?:string;actualizadoEn?:string;
}
export interface ArticleCreate {
 codigo:string;nombre:string;tipo:InventoryKind;unidadBaseId:string;
 requiereLote?:boolean;requiereVencimiento?:boolean;stockMinimo?:string|null;costoReferencia?:string|null;
}
export interface ArticleUpdate {nombre?:string;requiereLote?:boolean;requiereVencimiento?:boolean;stockMinimo?:string|null;costoReferencia?:string|null}
export interface Warehouse extends RecordId {codigo:string;nombre:string;sucursalId:string;activo:boolean;numeroUbicaciones?:number}
export interface Location extends RecordId {codigo:string;nombre:string;almacenId:string;sucursalId:string;activo:boolean;esRecepcion:boolean}
export interface StockArticle {id:string;codigo:string;nombre:string;tipo?:InventoryKind;unidadBase?:string;stockMinimo?:string|null;imagenPrincipalUrl?:string|null}
export interface StockPosition extends RecordId {
 articulo:StockArticle;ubicacion:{id?:string;nombre:string;codigo?:string;almacen?:{id:string;nombre:string}};
 lote?:{id:string;codigoLote:string;bloqueado:boolean;fechaVencimiento:string|null}|null;
 cantidad:string;costoUnitario?:string;costoTotal?:string;valorInventario?:string;
}
export interface StockSummary {articuloId:string;codigo:string;nombre:string;unidad:string;stockMinimo:string|null;
 cantidad:string;cantidadBloqueada:string;cantidadUtilizable:string;bajoMinimo:boolean;valor?:string;imagenPrincipalUrl?:string|null}
export interface InventoryLot extends RecordId {codigoLote:string;articulo:{id:string;codigo:string;nombre:string};
 bloqueado:boolean;fechaElaboracion:string|null;fechaVencimiento:string|null;cantidad:string;
 posiciones:{ubicacionId:string;cantidad:string}[]}
export interface InventoryMovement extends RecordId {
 articuloId?:string;articulo:{id?:string;codigo:string;nombre:string;unidad?:string;imagenPrincipalUrl?:string|null};
 tipo:string;cantidad:string;ubicacion?:{nombre:string}|string;lote?:{codigoLote:string}|null;
 usuario?:{nombre:string};creadoEn:string;nota?:string;referenciaTipo?:string;referenciaId?:string;
 costoUnitario?:string;costoTotal?:string;claveOperacion?:string;
}
export interface CountListItem extends RecordId {
 almacen:{id:string;codigo:string;nombre:string;sucursalId:string};estado:CountStatus;
 responsable:{id:string;nombre:string};numeroLineas:number;nota:string|null;
 creadoEn:string;confirmadoEn:string|null;
}
export interface CountLine extends RecordId {articulo:{id:string;nombre:string;codigo:string};
 ubicacion:{id:string;nombre:string};lote?:{id:string;codigoLote:string}|null;
 cantidadTeorica:string;cantidadContada:string;delta:string;costoUnitarioEntrada?:string|null}
export interface CountDetail extends RecordId {almacenId:string;
 almacen?:{id:string;codigo:string;nombre:string};estado:CountStatus;nota:string|null;creadoEn:string;
 confirmadoEn:string|null;lineas:CountLine[]}
export interface TransferListItem extends RecordId {
 numero:string;estado:TransferStatus;nota:string|null;origen:Warehouse;destino:Warehouse;
 responsable:{id:string;nombre:string};numeroLineas:number;despachadaEn:string|null;recibidaEn:string|null
}
export interface TransferLine extends RecordId {articulo:{id:string;nombre:string;codigo:string};lote?:{codigoLote:string}|null;
 ubicacionOrigen?:{nombre:string};ubicacionDestino?:{nombre:string};
 cantidadEnviada:string;cantidadRecibida:string|null;costoEnTransito?:string}
export interface TransferDetail extends RecordId {numero:string;estado:TransferStatus;nota:string|null;
 origen:{id:string;nombre:string;sucursal:string};destino:{id:string;nombre:string;sucursal:string};
 despachadaEn:string|null;recibidaEn:string|null;lineas:TransferLine[]}
export interface ManualPosting {articuloId:string;ubicacionId:string;loteId?:string;cantidad:string;
 costoUnitario?:string;claveOperacion:string;motivo:string}
export interface BatchInboundInput {
 claveOperacion:string;motivo:string;
 lineas:{articuloId:string;ubicacionId:string;loteId?:string;cantidad:string;costoUnitario:string}[];
}
export interface BatchInboundResult {
 claveOperacion:string;sucursalId:string;numeroLineas:number;
 movimientos:{movementId:string;articuloId:string;ubicacionId:string;loteId?:string|null;
  cantidad:string;costoUnitario?:string;costoTotal?:string}[];
}
export interface CountCreate {almacenId:string;nota:string;lineas:{articuloId:string;ubicacionId:string;loteId?:string;
 cantidadContada:string;costoUnitarioEntrada?:string}[]}
export interface TransferCreate {almacenOrigenId:string;almacenDestinoId:string;nota:string;
 lineas:{articuloId:string;ubicacionOrigenId:string;ubicacionDestinoId:string;loteId?:string;cantidad:string}[]}
export interface BranchFilters {sucursalId:string;articuloId?:string;almacenId?:string;ubicacionId?:string;loteId?:string;page?:number;limit?:number}
export const ARTICLE_KINDS:readonly {value:InventoryKind;label:string}[]=[
 {value:'INGREDIENTE',label:'Ingrediente'},{value:'PREPARACION',label:'Preparación'},
 {value:'PRODUCTO_TERMINADO',label:'Producto terminado'},
 {value:'EMPAQUE',label:'Empaque'},{value:'SUMINISTRO',label:'Suministro'}];
export const DIMENSIONS:readonly {value:Dimension;label:string}[]=[
 {value:'UNIDAD',label:'Unidad'},{value:'MASA',label:'Masa'},
 {value:'VOLUMEN',label:'Volumen'},{value:'LONGITUD',label:'Longitud'}];
