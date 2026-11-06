
import {HttpClient,HttpParams} from '@angular/common/http';
import {inject,Injectable} from '@angular/core';
import {API_ENDPOINTS} from '../../../core/http/api-endpoints';
import {gcSilentRequest} from '../../../core/http/api-context';
import type {
 FinancePage,FinanceAccount,FinanceAccountType,FinanceMovement,FinanceExpense,FinanceExpenseDetail,
 FinanceExpenseOrigin,FinancePendingExternal,FinanceExternalSourceType,FinanceRoute,FinanceRouteMethod,
 FinanceIntent,FinanceIntentAction
} from './finance.models';

export function financeParams(input:object):HttpParams{
 let params=new HttpParams();
 for(const [key,value] of Object.entries(input)){
  if(value!==undefined&&value!==null&&value!=='')params=params.set(key,String(value));
 }
 return params;
}
const silent={context:gcSilentRequest()};
@Injectable({providedIn:'root'})
export class FinanceApi{
 private readonly http=inject(HttpClient);
 private readonly e=API_ENDPOINTS.finance;
 issueIntent(sucursalId:string,accion:FinanceIntentAction){
  return this.http.post<FinanceIntent>(this.e.intents,{sucursalId,accion});
 }
 accounts(q:{sucursalId:string;page?:number;limit?:number}){
  return this.http.get<FinancePage<FinanceAccount>>(this.e.accounts,{params:financeParams(q),...silent});
 }
 account(id:string){return this.http.get<FinanceAccount>(this.e.account(id))}
 createAccount(dto:{operationId:string;sucursalId:string;nombre:string;tipo:FinanceAccountType}){
  return this.http.post<FinanceAccount>(this.e.accounts,dto,silent);
 }
 accountMovements(id:string,q:{page?:number;limit?:number}={}){
  return this.http.get<FinancePage<FinanceMovement>>(this.e.accountMovements(id),{params:financeParams(q),...silent});
 }
 expenses(q:{sucursalId:string;page?:number;limit?:number}){
  return this.http.get<FinancePage<FinanceExpense>>(this.e.expenses,{params:financeParams(q),...silent});
 }
 expense(id:string){return this.http.get<FinanceExpenseDetail>(this.e.expense(id))}
 createExpense(dto:{
  operationId:string;sucursalId:string;origen:FinanceExpenseOrigin;monto:string;descripcion:string;
  categoria?:string;proveedorId?:string;turnoId?:string;cuentaFinancieraId?:string;documentoReferencia?:string;
 }){
  return this.http.post<{id:string;sucursalId:string;monto:string;origen:string;
   movimientoId:string;fechaOperativa:string;estado:string}>(this.e.expenses,dto,silent);
 }
 pendingExternal(q:{sucursalId:string;sourceType:FinanceExternalSourceType;page?:number;limit?:number}){
  return this.http.get<FinancePage<FinancePendingExternal>>(this.e.reconciliationPending,{params:financeParams(q),...silent});
 }
 postExternal(dto:{operationId:string;sucursalId:string;sourceType:FinanceExternalSourceType;
  sourceId:string;cuentaFinancieraId:string}){
  return this.http.post<{sourceType:string;sourceId:string;movimientoId:string;
   cuentaFinancieraId:string;monto:string;registrado:boolean;nuevo:boolean;conciliadoBanco:boolean}>(
   this.e.reconciliationPost,dto,silent);
 }
 routing(sucursalId:string){
  return this.http.get<{data:FinanceRoute[]}>(this.e.routing,{params:financeParams({sucursalId}),...silent});
 }
 upsertRoute(dto:{operationId:string;sucursalId:string;metodo:FinanceRouteMethod;
  cuentaFinancieraId:string;activa?:boolean}){
  return this.http.put<FinanceRoute>(this.e.routing,dto,silent);
 }
}
