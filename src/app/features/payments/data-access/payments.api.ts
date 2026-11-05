import {HttpClient,HttpParams} from '@angular/common/http';
import {inject,Injectable} from '@angular/core';
import {gcSilentRequest} from '../../../core/http/api-context';
import type {
 AccountDetail,AccountSplitInput,AccountSummary,CashRegister,CashShift,CollectInput,
 Page,PaymentSummary,RefundInput,SaleRecord,SalesFilters
} from './payments.models';
export const paymentPaths={
 registers:'/api/cash/registers',register:(id:string)=>'/api/cash/registers/'+encodeURIComponent(id),
 shifts:'/api/cash/shifts',shift:(id:string)=>'/api/cash/shifts/'+encodeURIComponent(id),
 accounts:(id:string)=>'/api/accounts/order/'+encodeURIComponent(id),
 account:(id:string)=>'/api/accounts/'+encodeURIComponent(id),
 finalize:(id:string)=>'/api/accounts/order/'+encodeURIComponent(id)+'/finalize',
 split:(id:string)=>'/api/accounts/order/'+encodeURIComponent(id)+'/split',
 splitEqual:(id:string)=>'/api/accounts/order/'+encodeURIComponent(id)+'/split-equal',
 attempt:(id:string)=>'/api/payment-attempts/'+encodeURIComponent(id),
 payment:(id:string)=>'/api/payments/'+encodeURIComponent(id),
 sales:'/api/sales',sale:(id:string)=>'/api/sales/'+encodeURIComponent(id),
 summary:'/api/payment-reports/summary',
} as const;
const opts={context:gcSilentRequest()};
const query=(p:Record<string,string|number|undefined>)=>{
 let params=new HttpParams();for(const [k,v] of Object.entries(p))if(v!==undefined&&v!=='')params=params.set(k,String(v));
 return {...opts,params};
};
@Injectable({providedIn:'root'})
export class PaymentsApi{
 private readonly http=inject(HttpClient);
 // CASH: 8 endpoints
 registers(branch:string){return this.http.get<CashRegister[]>(paymentPaths.registers,query({sucursalId:branch}))}
 createRegister(body:{sucursalId:string;codigo:string;nombre:string}){
  return this.http.post<CashRegister>(paymentPaths.registers,body,opts);
 }
 updateRegister(id:string,body:{nombre?:string;activa?:boolean}){
  return this.http.patch<CashRegister>(paymentPaths.register(id),body,opts);
 }
 shifts(branch:string,page=1,limit=20){return this.http.get<Page<CashShift>>(paymentPaths.shifts,
  query({sucursalId:branch,page,limit}))}
 openShift(body:{cajaId:string;fondoInicial:string;claveOperacion:string}){
  return this.http.post<{shiftId:string}>(paymentPaths.shifts,body,opts);
 }
 shift(id:string){return this.http.get<CashShift>(paymentPaths.shift(id),opts)}
 movement(id:string,body:{tipo:'INGRESO'|'EGRESO';monto:string;motivo:string;claveOperacion:string}){
  return this.http.post<{movementId:string}>(paymentPaths.shift(id)+'/movements',body,opts);
 }
 closeShift(id:string,body:{efectivoContado:string;notaCierre?:string;claveOperacion:string}){
  return this.http.post<{shiftId:string;efectivoEsperado:string;efectivoContado:string;diferencia:string}>(
   paymentPaths.shift(id)+'/close',body,opts);
 }
 // ACCOUNTS: 6 endpoints
 accounts(orderId:string){return this.http.get<AccountSummary[]>(paymentPaths.accounts(orderId),opts)}
 finalize(orderId:string){return this.http.post<{orderId:string;closed:boolean}>(paymentPaths.finalize(orderId),{},opts)}
 account(id:string){return this.http.get<AccountDetail>(paymentPaths.account(id),opts)}
 collect(id:string,body:CollectInput){return this.http.post<{accountId:string;pagoIds:string[];
  intentoIds:string[];cuenta:AccountDetail}>(paymentPaths.account(id)+'/payments',body,opts)}
 split(id:string,body:AccountSplitInput){
  return this.http.post<{orderId:string;cuentaIds:string[]}>(paymentPaths.split(id),body,opts);
 }
 splitEqual(id:string,body:{personas:number;claveOperacion:string}){
  return this.http.post<{orderId:string;cuentaIds:string[]}>(paymentPaths.splitEqual(id),body,opts);
 }
 // Payment authorization and refunds: 3 endpoints
 confirmAttempt(id:string,body:{turnoId:string;motivo:string;claveOperacion:string}){
  return this.http.post<{cuentaId:string;pagoId:string;cuenta:AccountDetail}>(
   paymentPaths.attempt(id)+'/confirm',body,opts);
 }
 cancelAttempt(id:string,body:{motivo:string;claveOperacion:string}){
  return this.http.post<{attemptId:string;estado:string}>(paymentPaths.attempt(id)+'/cancel',body,opts);
 }
 refund(id:string,body:RefundInput){
  return this.http.post<{id:string}>(paymentPaths.payment(id)+'/refund',body,opts);
 }
 // Sales & reports: 3 endpoints
 sales(branch:string,page=1,limit=20,filters:SalesFilters={}){
  return this.http.get<Page<SaleRecord>>(paymentPaths.sales,
   query({sucursalId:branch,page,limit,...filters}));
 }
 sale(id:string){return this.http.get<SaleRecord>(paymentPaths.sale(id),opts)}
 summary(branch:string){return this.http.get<PaymentSummary>(paymentPaths.summary,query({sucursalId:branch}))}
}
