import {HttpClient,HttpParams} from '@angular/common/http';
import {inject,Injectable} from '@angular/core';
import {gcSilentRequest} from '../../../core/http/api-context';
import type {
 PurchasePage,PurchaseSupplier,PurchasePresentation,PurchaseOrder,PurchaseOrderInput,
 PurchaseReceipt,PurchaseReceiptInput,PurchaseReceiptSaved,SupplyRequisition,SupplyAvailability,SupplyTransfer
} from './purchases.models';

const safe=(id:string)=>encodeURIComponent(id);
export const purchasePaths={
 suppliers:'/api/purchases/suppliers',supplier:(id:string)=>'/api/purchases/suppliers/'+safe(id),
 presentations:'/api/purchases/presentations',presentation:(id:string)=>'/api/purchases/presentations/'+safe(id),
 orders:'/api/purchases/orders',order:(id:string)=>'/api/purchases/orders/'+safe(id),
 receipts:'/api/purchases/receipts',receipt:(id:string)=>'/api/purchases/receipts/'+safe(id),
 requisitions:'/api/supply/requisitions',requisition:(id:string)=>'/api/supply/requisitions/'+safe(id),
 transfers:'/api/supply/transfers',transfer:(id:string)=>'/api/supply/transfers/'+safe(id),
} as const;
const readOptions={context:gcSilentRequest()};
const query=(filters:Record<string,string|number|boolean|undefined>)=>{
 let params=new HttpParams();
 for(const [key,value] of Object.entries(filters))
  if(value!==undefined&&value!=='')params=params.set(key,String(value));
 return {params,...readOptions};
};
/** Reads are silent during refreshes; every mutation shows server errors through the global interceptor. */
@Injectable({providedIn:'root'})
export class PurchasesApi {
 private readonly http=inject(HttpClient);
 suppliers(q:{sucursalId?:string;search?:string;page?:number;limit?:number}={}){
  return this.http.get<PurchasePage<PurchaseSupplier>>(purchasePaths.suppliers,query(q));
 }
 supplier(id:string){return this.http.get<PurchaseSupplier>(purchasePaths.supplier(id),readOptions)}
 createSupplier(body:{nombre:string;nit?:string;telefono?:string;email?:string;direccion?:string}){
  return this.http.post<PurchaseSupplier>(purchasePaths.suppliers,body);
 }
 updateSupplier(id:string,body:{nombre?:string;nit?:string;telefono?:string;email?:string;direccion?:string}){
  return this.http.patch<PurchaseSupplier>(purchasePaths.supplier(id),body);
 }
 supplierStatus(id:string,activo:boolean){
  return this.http.patch<PurchaseSupplier>(purchasePaths.supplier(id)+'/status',{activo});
 }
 presentations(q:{sucursalId?:string;proveedorId?:string;page?:number;limit?:number}={}){
  return this.http.get<PurchasePage<PurchasePresentation>>(purchasePaths.presentations,query(q));
 }
 createPresentation(body:{articuloId:string;proveedorId?:string;nombre:string;unidadCompraId:string;
  factorAUnidadBase:string}){
  return this.http.post<PurchasePresentation>(purchasePaths.presentations,body);
 }
 presentationStatus(id:string,activo:boolean){
  return this.http.patch<PurchasePresentation>(purchasePaths.presentation(id)+'/status',{activo});
 }
 orders(q:{sucursalId:string;proveedorId?:string;page?:number;limit?:number}){
  return this.http.get<PurchasePage<PurchaseOrder>>(purchasePaths.orders,query(q));
 }
 order(id:string){return this.http.get<PurchaseOrder>(purchasePaths.order(id),readOptions)}
 createOrder(body:PurchaseOrderInput){return this.http.post<PurchaseOrder>(purchasePaths.orders,body)}
 editOrder(id:string,body:PurchaseOrderInput){
  return this.http.put<PurchaseOrder>(purchasePaths.order(id),body);
 }
 confirmOrder(id:string,key:string){
  return this.http.post<{id:string;estado:string}>(purchasePaths.order(id)+'/confirm',{claveOperacion:key});
 }
 cancelOrder(id:string,key:string,motivo:string){
  return this.http.post<{id:string;estado:string}>(purchasePaths.order(id)+'/cancel',
   {claveOperacion:key,motivo});
 }
 closeOrder(id:string,key:string,motivo:string){
  return this.http.post<{id:string;estado:string}>(purchasePaths.order(id)+'/close',
   {claveOperacion:key,motivo});
 }
 receipts(q:{sucursalId:string;proveedorId?:string;page?:number;limit?:number}){
  return this.http.get<PurchasePage<PurchaseReceipt>>(purchasePaths.receipts,query(q));
 }
 receipt(id:string){return this.http.get<PurchaseReceipt>(purchasePaths.receipt(id),readOptions)}
 receiptMovements(id:string){
  return this.http.get<unknown[]>(purchasePaths.receipt(id)+'/movements',readOptions);
 }
 createReceipt(body:PurchaseReceiptInput){
  return this.http.post<PurchaseReceiptSaved>(purchasePaths.receipts,body);
 }
 editReceipt(id:string,body:PurchaseReceiptInput){
  return this.http.put<PurchaseReceiptSaved>(purchasePaths.receipt(id),body);
 }
 confirmReceipt(id:string,key:string){
  return this.http.post<PurchaseReceiptSaved>(purchasePaths.receipt(id)+'/confirm',{claveOperacion:key});
 }
 cancelReceipt(id:string,key:string){
  return this.http.post<PurchaseReceiptSaved>(purchasePaths.receipt(id)+'/cancel',{claveOperacion:key});
 }
 requisitions(q:{sucursalId:string;estado?:'ABIERTA'|'ATENDIDA'|'CANCELADA'|'';search?:string;page?:number;limit?:number}){
  return this.http.get<PurchasePage<SupplyRequisition>>(purchasePaths.requisitions,query(q));
 }
 createRequisition(body:{almacenDestinoId:string;nota?:string;claveOperacion:string;
  lineas:{articuloId:string;cantidadSolicitada:string}[]}){
  return this.http.post<{id:string;numero:string;estado:string}>(purchasePaths.requisitions,body);
 }
 requisition(id:string){
  return this.http.get<SupplyRequisition>(purchasePaths.requisition(id),readOptions);
 }
 availability(id:string,originWarehouseId:string){
  return this.http.get<SupplyAvailability>(purchasePaths.requisition(id)+'/availability',
   query({almacenOrigenId:originWarehouseId}));
 }
 sendRequisition(id:string,body:{almacenOrigenId:string;inmediato?:boolean;nota?:string;
  claveOperacion:string;lineas:{articuloId:string;ubicacionOrigenId:string;
   ubicacionDestinoId:string;loteId?:string;cantidad:string}[]}){
  return this.http.post<{id:string;estado:string}>(purchasePaths.requisition(id)+'/send',body);
 }
 cancelRequisition(id:string,body:{claveOperacion:string;motivo:string}){
  return this.http.post<{id:string;estado:string}>(purchasePaths.requisition(id)+'/cancel',body);
 }
 purchaseFromRequisition(id:string,body:{claveOperacion:string;orden:PurchaseOrderInput}){
  return this.http.post<PurchaseOrder>(purchasePaths.requisition(id)+'/purchase-draft',body);
 }
 transfer(id:string){return this.http.get<SupplyTransfer>(purchasePaths.transfer(id),readOptions)}
 receiveTransfer(id:string,body:{claveOperacion:string;observaciones?:string;
  lineas:{transferenciaLineaId:string;cantidadRecibida:string}[]}){
  return this.http.post<{id:string;estado:string}>(purchasePaths.transfer(id)+'/receive',body);
 }
}
