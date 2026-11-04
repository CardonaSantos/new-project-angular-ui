import {provideHttpClient,withInterceptors} from '@angular/common/http';
import {HttpTestingController,provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {GC_SILENT_ERROR} from '../../../core/http/api-context';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {gcApiErrorInterceptor} from '../../../core/http/gc-api.interceptors';
import {OrdersApi,orderPaths} from './orders.api';

describe('ORD-A — global error notifications',()=>{
 let api:OrdersApi;let http:HttpTestingController;let notices:GcNotificationService;
 beforeEach(()=>{
  TestBed.configureTestingModule({providers:[
   provideHttpClient(withInterceptors([gcApiErrorInterceptor])),
   provideHttpClientTesting()
  ]});
  api=TestBed.inject(OrdersApi);
  http=TestBed.inject(HttpTestingController);
  notices=TestBed.inject(GcNotificationService);
  notices.clear();
 });
 afterEach(()=>http.verify());

 it('shows the exact 409 business message for a failed table release, with no replay',()=>{
  let failure:unknown;
  api.closeOccupancy('occupied').subscribe({error:e=>failure=e});
  const request=http.expectOne(orderPaths.occupancy('occupied'));
  expect(request.request.method).toBe('POST');
  expect(request.request.context.get(GC_SILENT_ERROR)).toBe(false);
  request.flush(
   {statusCode:409,message:'Mesa con orden abierta: liquide o cancele la orden antes de cerrar',error:'Conflict'},
   {status:409,statusText:'Conflict'}
  );
  expect(failure).toMatchObject({status:409});
  expect(notices.notices()).toHaveLength(1);
  expect(notices.notices()[0].tone).toBe('error');
  expect(notices.notices()[0].message).toContain('Mesa con orden abierta');
 });

 it('keeps background order reads silent to avoid duplicate polling toasts',()=>{
  api.tables('branch').subscribe({error:()=>undefined});
  const request=http.expectOne(r=>r.url===orderPaths.tables);
  expect(request.request.method).toBe('GET');
  expect(request.request.context.get(GC_SILENT_ERROR)).toBe(true);
  request.flush({message:'Error interno'},{status:500,statusText:'Server Error'});
  expect(notices.notices()).toEqual([]);
 });

 it('enables the global toast on kitchen writes without showing success on failure',()=>{
  api.readyTicket('comanda').subscribe({error:()=>undefined});
  const request=http.expectOne(orderPaths.ticket('comanda')+'/ready');
  expect(request.request.method).toBe('POST');
  expect(request.request.context.get(GC_SILENT_ERROR)).toBe(false);
  request.flush({message:'No se puede marcar lista'},{status:409,statusText:'Conflict'});
  expect(notices.notices().at(-1)?.message).toBe('No se puede marcar lista');
 });
});
