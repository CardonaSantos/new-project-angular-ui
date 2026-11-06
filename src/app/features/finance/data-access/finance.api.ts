
import {HttpClient,HttpParams} from '@angular/common/http';
import {inject,Injectable} from '@angular/core';
import {API_ENDPOINTS} from '../../../core/http/api-endpoints';
import {gcSilentRequest} from '../../../core/http/api-context';
import type {
 FinancePage,FinanceAccount,FinanceAccountType,FinanceMovement,FinanceExpense,FinanceExpenseDetail,
 FinanceExpenseOrigin,FinanceExpenseState,FinancePendingExternal,FinanceExternalSourceType,FinanceRoute,FinanceRouteMethod,
 FinanceIntent,FinanceIntentAction,FinanceClosePreview,FinanceClosing,FinanceBankLine,FinanceBankLineState,
 FinanceUnmatchedMovement
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
 updateAccount(id:string,dto:{operationId:string;nombre:string}){
  return this.http.patch<FinanceAccount>(this.e.account(id),dto,silent);
 }
 accountMovements(id:string,q:{page?:number;limit?:number}={}){
  return this.http.get<FinancePage<FinanceMovement>>(this.e.accountMovements(id),{params:financeParams(q),...silent});
 }
 expenses(q:{sucursalId:string;page?:number;limit?:number;origen?:FinanceExpenseOrigin;
  estado?:FinanceExpenseState;categoria?:string;desde?:string;hasta?:string}){
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
 closingPreview(q:{sucursalId:string;fechaOperativa:string}){
  return this.http.get<FinanceClosePreview>(this.e.closingPreview,{params:financeParams(q),...silent});
 }
 closingDetail(q:{sucursalId:string;fechaOperativa:string}){
  return this.http.get<FinanceClosing>(this.e.closing,{params:financeParams(q),...silent});
 }
 confirmClosing(dto:{operationId:string;sucursalId:string;fechaOperativa:string}){
  return this.http.post<FinanceClosing>(this.e.closing,dto,silent);
 }
 bankStatements(q:{sucursalId:string;cuentaFinancieraId:string;estado?:FinanceBankLineState;
  page?:number;limit?:number}){
  return this.http.get<FinancePage<FinanceBankLine>>(this.e.bankStatements,{params:financeParams(q),...silent});
 }
 bankLedgerPending(q:{sucursalId:string;cuentaFinancieraId:string;page?:number;limit?:number}){
  return this.http.get<FinancePage<FinanceUnmatchedMovement>>(this.e.bankLedgerPending,{params:financeParams(q),...silent});
 }
 importBankLines(dto:{operationId:string;sucursalId:string;cuentaFinancieraId:string;lineas:{
  claveExterna:string;fecha:string;monto:string;referencia?:string;descripcion?:string}[]}){
  return this.http.post<{cuentaFinancieraId:string;importadas:number;lineaIds:string[]}>(
   this.e.bankImport,dto,silent);
 }
 matchBankLine(dto:{operationId:string;sucursalId:string;lineaId:string;movimientoId:string;
  forzarConciliacion?:boolean;justificacion?:string}){
  return this.http.post<{lineaId:string;movimientoId:string;estado:string;validacionReferencia:string}>(
   this.e.bankMatch,dto,silent);
 }
 unmatchBankLine(dto:{operationId:string;sucursalId:string;lineaId:string;motivo:string}){
  return this.http.post<{lineaId:string;estado:string;movimientoAnteriorId:string}>(
   this.e.bankUnmatch,dto,silent);
 }
 reverseMovement(dto:{operationId:string;sucursalId:string;movimientoId:string;motivo:string}){
  return this.http.post<{reversaId:string;movimientoOriginalId:string;
   movimientoReversaId:string;monto:string}>(this.e.reversals,dto,silent);
 }
}
