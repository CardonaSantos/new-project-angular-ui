
import {HttpClient,HttpParams} from '@angular/common/http';
import {inject,Injectable} from '@angular/core';
import {retry,throwError,timer} from 'rxjs';
import {isTransientInventoryReadError} from './inventory-read-retry';
import {API_ENDPOINTS} from '../../../core/http/api-endpoints';
import {gcSilentRequest} from '../../../core/http/api-context';
import type {
 InventoryPage,InventoryOptions,Article,ArticleCreate,ArticleUpdate,Unit,Dimension,Conversion,
 Warehouse,Location,InventoryLot,InventoryMovement,StockPosition,StockSummary,CountListItem,CountDetail,
 TransferListItem,TransferDetail,CountCreate,TransferCreate,ManualPosting,BranchFilters,InventoryKind,
 CountStatus,TransferStatus
} from './inventory.models';

export function inventoryParams(input:object):HttpParams{
 let params=new HttpParams();
 for(const [key,value] of Object.entries(input)){
  if(value!==undefined&&value!==null&&value!=='')params=params.set(key,String(value));
 }
 return params;
}
const silent={context:gcSilentRequest()};
function safeInventoryGetRetry<T>(){
 return retry<T>({count:2,delay:(error,attempt)=>isTransientInventoryReadError(error)
  ?timer(attempt*350):throwError(()=>error)});
}
@Injectable({providedIn:'root'})
export class InventoryApi {
 private readonly http=inject(HttpClient);
 private readonly e=API_ENDPOINTS.inventory;
 articles(q:{page?:number;limit?:number;search?:string;tipo?:InventoryKind;activo?:boolean}={}){
  return this.http.get<InventoryPage<Article>>(this.e.articles,{params:inventoryParams(q),...silent}).pipe(safeInventoryGetRetry<InventoryPage<Article>>());
 }
 articleOptions(q:{search?:string;cursor?:string;limit?:number;tipo?:InventoryKind}={}){
  return this.http.get<InventoryOptions<Article&{label:string}>>(this.e.articleOptions,{params:inventoryParams(q)});
 }
 article(id:string){return this.http.get<Article>(this.e.article(id))}
 articleDependencies(id:string){return this.http.get<Record<string,unknown>>(this.e.articleDependencies(id))}
 createArticle(dto:ArticleCreate){return this.http.post<Article>(this.e.articles,dto,silent)}
 updateArticle(id:string,dto:ArticleUpdate){return this.http.patch<Article>(this.e.article(id),dto,silent)}
 articleStatus(id:string,activo:boolean,motivo:string){
  return this.http.patch<Article>(this.e.articleStatus(id),{activo,motivo},silent)}
 articleMedia(id:string,mediaIds:string[]){return this.http.put<Article>(this.e.articleMedia(id),{mediaIds},silent)}
 units(q:{page?:number;limit?:number;search?:string}={}){
  return this.http.get<InventoryPage<Unit>>(this.e.units,{params:inventoryParams(q)})}
 unitOptions(q:{search?:string;cursor?:string;limit?:number;dimension?:Dimension}={}){
  return this.http.get<InventoryOptions<Unit&{label:string}>>(this.e.unitOptions,{params:inventoryParams(q)})}
 unit(id:string){return this.http.get<Unit>(this.e.unit(id))}
 createUnit(dto:{codigo:string;nombre:string;dimension:Dimension;esBase?:boolean}){
  return this.http.post<Unit>(this.e.units,dto,silent)}
 updateUnit(id:string,nombre:string){return this.http.patch<Unit>(this.e.unit(id),{nombre},silent)}
 conversions(q:{page?:number;limit?:number;search?:string;dimension?:Dimension}={}){
  return this.http.get<InventoryPage<Conversion>>(this.e.conversions,{params:inventoryParams(q)})}
 createConversion(dto:{unidadOrigenId:string;unidadDestinoId:string;factor:string}){
  return this.http.post<Conversion>(this.e.conversions,dto,silent)}
 conversionPreview(dto:{unidadOrigenId:string;unidadDestinoId:string;cantidad:string}){
  return this.http.post<Record<string,unknown>>(this.e.conversionPreview,dto)}
 warehouses(q:{page?:number;limit?:number;search?:string;sucursalId?:string;activo?:boolean}={}){
  return this.http.get<InventoryPage<Warehouse>>(this.e.warehouses,{params:inventoryParams(q)})}
 warehouseOptions(q:{sucursalId?:string;search?:string;cursor?:string;limit?:number}={}){
  return this.http.get<InventoryOptions<Warehouse&{label:string}>>(this.e.warehouseOptions,{params:inventoryParams(q)})}
 warehouse(id:string){return this.http.get<Warehouse>(this.e.warehouse(id))}
 createWarehouse(dto:{sucursalId:string;codigo:string;nombre:string}){
  return this.http.post<Warehouse>(this.e.warehouses,dto,silent)}
 updateWarehouse(id:string,nombre:string){return this.http.patch<Warehouse>(this.e.warehouse(id),{nombre},silent)}
 warehouseStatus(id:string,activo:boolean,motivo:string){
  return this.http.patch<Warehouse>(this.e.warehouseStatus(id),{activo,motivo},silent)}
 locations(q:{page?:number;limit?:number;search?:string;sucursalId?:string;almacenId?:string;activo?:boolean;esRecepcion?:boolean}={}){
  return this.http.get<InventoryPage<Location>>(this.e.locations,{params:inventoryParams(q)})}
 locationOptions(q:{sucursalId?:string;almacenId?:string;search?:string;cursor?:string;limit?:number}={}){
  return this.http.get<InventoryOptions<Location&{label:string}>>(this.e.locationOptions,{params:inventoryParams(q)})}
 location(id:string){return this.http.get<Location>(this.e.location(id))}
 createLocation(dto:{almacenId:string;codigo:string;nombre:string;esRecepcion?:boolean}){
  return this.http.post<Location>(this.e.locations,dto,silent)}
 updateLocation(id:string,dto:{nombre?:string;esRecepcion?:boolean}){
  return this.http.patch<Location>(this.e.location(id),dto,silent)}
 locationStatus(id:string,activo:boolean,motivo:string){
  return this.http.patch<Location>(this.e.locationStatus(id),{activo,motivo},silent)}
 stock(q:BranchFilters){return this.http.get<InventoryPage<StockPosition>>(this.e.stock,{params:inventoryParams(q),...silent}).pipe(safeInventoryGetRetry<InventoryPage<StockPosition>>())}
 summary(q:BranchFilters){return this.http.get<{data:StockSummary[];totalArticulos:number;nota:string}>(this.e.stockSummary,{params:inventoryParams(q)})}
 lots(q:BranchFilters&{incluirSinExistencias?:boolean}){
  return this.http.get<InventoryPage<InventoryLot>>(this.e.lots,{params:inventoryParams(q),...silent}).pipe(safeInventoryGetRetry<InventoryPage<InventoryLot>>())}
 createLot(dto:{articuloId:string;codigoLote:string;fechaElaboracion?:string;fechaVencimiento?:string}){
  return this.http.post<InventoryLot>(this.e.lots,dto,silent)}
 blockLot(id:string,bloqueado:boolean,motivo:string){
  return this.http.patch<InventoryLot>(this.e.lotBlock(id),{bloqueado,motivo},silent)}
 movements(q:BranchFilters){return this.http.get<InventoryPage<InventoryMovement>>(this.e.movements,{params:inventoryParams(q),...silent}).pipe(safeInventoryGetRetry<InventoryPage<InventoryMovement>>())}
 movement(id:string){return this.http.get<InventoryMovement>(this.e.movement(id))}
 manual(kind:'opening'|'inbound'|'outbound'|'waste',dto:ManualPosting){
  return this.http.post<InventoryMovement>(this.e.manual(kind),dto,silent)}
 internalConsumption(dto:{articuloId:string;ubicacionId:string;loteId?:string;cantidad:string;
 claveOperacion:string;destinoUso:string;motivo:string}){
  return this.http.post<InventoryMovement>(this.e.internalConsumption,dto,silent)}
 counts(q:{sucursalId:string;almacenId?:string;estado?:CountStatus;page?:number;limit?:number}){
  return this.http.get<InventoryPage<CountListItem>>(this.e.counts,{params:inventoryParams(q),...silent}).pipe(safeInventoryGetRetry<InventoryPage<CountListItem>>())}
 count(id:string){return this.http.get<CountDetail>(this.e.count(id))}
 createCount(dto:CountCreate){return this.http.post<CountDetail>(this.e.counts,dto,silent)}
 countAction(id:string,action:'confirm'|'cancel'){
  return this.http.post<CountDetail>(this.e.countAction(id,action),{},silent)}
 transfers(q:{sucursalId:string;almacenOrigenId?:string;almacenDestinoId?:string;estado?:TransferStatus;page?:number;limit?:number}){
  return this.http.get<InventoryPage<TransferListItem>>(this.e.transfers,{params:inventoryParams(q),...silent}).pipe(safeInventoryGetRetry<InventoryPage<TransferListItem>>())}
 transfer(id:string){return this.http.get<TransferDetail>(this.e.transfer(id))}
 createTransfer(dto:TransferCreate){return this.http.post<TransferDetail>(this.e.transfers,dto,silent)}
 transferAction(id:string,action:'dispatch'|'receive'|'cancel'){
  return this.http.post<TransferDetail>(this.e.transferAction(id,action),{},silent)}
 report(type:'masters'|'valuation'|'expiry'|'reconciliation',q:{sucursalId?:string}={}){
  return this.http.get<Record<string,unknown>>(this.e.reports[type],{params:inventoryParams(q)})}
}
