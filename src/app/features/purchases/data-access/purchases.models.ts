export interface PurchasePage<T> {
 data:T[];
 meta:{page:number;limit:number;total:number;totalPages:number};
}
export interface PurchaseSupplier {
 id:string;nombre:string;nit:string|null;telefono:string|null;email:string|null;
 direccion:string|null;activo:boolean;
}
export interface PurchasePresentation {
 id:string;articuloId:string;proveedorId:string|null;nombre:string;
 unidadCompraId:string;factorAUnidadBase:string;activa:boolean;
 articulo?:{id:string;nombre:string;codigo:string;unidadBase?:{nombre:string;codigo:string}};
 unidadCompra?:{id:string;nombre:string;codigo:string};
 proveedor?:PurchaseSupplier|null;
}
export interface PurchaseLineInput {
 articuloId:string;presentacionId?:string;cantidadCompra:string;factorAUnidadBase:string;
 precioUnitarioCompra:string;tasaImpuesto?:string;impuestoRecuperable?:boolean;
}
export interface PurchaseOrderInput {
 proveedorId:string;sucursalId:string;precioIncluyeImpuesto?:boolean;
 observaciones?:string;claveOperacion?:string;requisicionId?:string;
 lineas:PurchaseLineInput[];
}
export interface PurchaseOrderLine extends PurchaseLineInput {
 id:string;articulo:{id:string;codigo:string;nombre:string};
 presentacion?:PurchasePresentation|null;
 recibido?:string;pendiente?:string;
}
export interface PurchaseOrder {
 id:string;numero:string;sucursalId:string;proveedorId:string;estado:string;
 precioIncluyeImpuesto:boolean;
 proveedor:PurchaseSupplier;creadaEn:string;totalEstimado:string;recepcionEstado?:string;
 ordenCompraLineasComoOrdenCompra?:PurchaseOrderLine[];
 lineas?:PurchaseOrderLine[];
 _count?:{ordenCompraLineasComoOrdenCompra:number};
}
export interface ReceiptLineInput {
 ordenCompraLineaId?:string;articuloId:string;ubicacionId:string;loteId?:string;
 cantidadCompra:string;factorAUnidadBase:string;precioUnitarioCompra:string;
 cantidadRechazada?:string;tasaImpuesto?:string;impuestoRecuperable?:boolean;
}
export interface PurchaseReceiptInput {
 ordenCompraId?:string;proveedorId:string;almacenId:string;
 precioIncluyeImpuesto?:boolean;referenciaProveedor?:string;observaciones?:string;
 lineas:ReceiptLineInput[];
}
export interface ReceiptLine extends ReceiptLineInput {
 id:string;cantidadBase:string;costoTotal:string;
 articulo:{id:string;codigo:string;nombre:string};
 ubicacion:{id:string;nombre:string};lote?:{id:string;codigoLote:string}|null;
 ordenCompraLinea?:PurchaseOrderLine|null;
}
export interface PurchaseReceipt {
 id:string;numero:string;estado:'BORRADOR'|'CONFIRMADO'|'CANCELADO';proveedorId:string;
 ordenCompraId:string|null;almacenId:string;proveedor:PurchaseSupplier;
 almacen:{id:string;nombre:string;sucursalId:string};
 referenciaProveedor?:string|null;observaciones?:string|null;
 creadoEn:string;recibidoEn?:string|null;
 recepcionCompraLineasComoRecepcion?:ReceiptLine[];
}
export type PurchaseReceiptSaved={id:string;estado:string;movimientoIds?:string[]};
export interface SupplyRequisition {
 id:string;numero:string;estado:string;estadoVisible?:string;
 nota?:string|null;almacenDestinoId:string;creadaEn:string;
 lineas:{id:string;articuloId:string;articulo:{id:string;nombre:string;codigo:string};
  solicitado:string;recibido:string;enTransito:string;pendiente:string}[];
 transferencias:{id:string;numero:string;estado:string;almacenOrigenId:string;
  despachadaEn?:string|null;recibidaEn?:string|null}[];
}
export interface SupplyAvailability {
 requisicionId:string;almacenOrigenId:string;almacenDestinoId:string;nota:string;
 lineas:Array<SupplyRequisition['lineas'][number] & {
  disponibleOrigen:string;sugeridoEnviar:string;faltante:string}>;
}
export interface SupplyTransfer {
 id:string;numero:string;estado:string;requisicionId:string;
 almacenOrigenId:string;almacenDestinoId:string;
 lineas:{id:string;articuloId:string;ubicacionOrigenId:string;
  ubicacionDestinoId:string;loteId?:string|null;
  enviada:string;recibida:string;pendiente:string}[];
}

