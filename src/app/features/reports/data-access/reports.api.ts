import {HttpClient,HttpParams} from '@angular/common/http';
import {inject,Injectable} from '@angular/core';
import {gcSilentRequest} from '../../../core/http/api-context';
import type {
 OperationalDashboard,ReportsOverview,ReportFilters,ReportPageFilters,ReportTicket,
 ReportCashShift,ReportPage,PaymentMethodResponse,ExpenseCategoryResponse,
 SourceRecordResponse,ReportSource
} from './reports.models';
export const REPORT_PATHS={
 operational:'/api/reports/operational/dashboard',
 overview:'/api/reports/analytics/overview',
 payments:'/api/reports/analytics/payments-by-method',
 expenses:'/api/reports/analytics/expenses-by-category',
 tickets:'/api/reports/analytics/tickets',
 cashShifts:'/api/reports/analytics/cash-shifts',
 sources:(source:ReportSource)=>'/api/reports/analytics/sources/'+encodeURIComponent(source),
 exports:(source:ReportSource)=>'/api/reports/analytics/exports/'+encodeURIComponent(source),
 consolidated:'/api/reports/analytics/sources/consolidated'
} as const;
const options=(params:Record<string,string|number|undefined>)=>{
 let query=new HttpParams();
 for(const [key,value] of Object.entries(params)){
  if(value!==undefined&&value!=='')query=query.set(key,String(value));
 }
 return {params:query,context:gcSilentRequest()};
};
@Injectable({providedIn:'root'})
export class ReportsApi {
 private readonly http=inject(HttpClient);
 operational(branchId:string){
  return this.http.get<OperationalDashboard>(REPORT_PATHS.operational,options({sucursalId:branchId}));
 }
 overview(query:ReportFilters){
  return this.http.get<ReportsOverview>(REPORT_PATHS.overview,options({...query}));
 }
 payments(query:ReportFilters){
  return this.http.get<PaymentMethodResponse>(REPORT_PATHS.payments,options({...query}));
 }
 expenses(query:ReportFilters){
  return this.http.get<ExpenseCategoryResponse>(REPORT_PATHS.expenses,options({...query}));
 }
 tickets(query:ReportPageFilters){
  return this.http.get<ReportPage<ReportTicket>>(REPORT_PATHS.tickets,options({...query}));
 }
 cashShifts(query:ReportPageFilters){
  return this.http.get<ReportPage<ReportCashShift>>(REPORT_PATHS.cashShifts,options({...query}));
 }
 source(source:ReportSource,query:ReportPageFilters){
  return this.http.get<SourceRecordResponse>(REPORT_PATHS.sources(source),options({...query}));
 }
 export(source:ReportSource,query:ReportFilters,format:'CSV'|'XLSX'|'PDF'){
  return this.http.get(REPORT_PATHS.exports(source),{
   ...options({...query,format}),observe:'response' as const,responseType:'blob' as const
  });
 }
}
