import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController,provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {OrdersApi,orderPaths} from './orders.api';

describe('ORD Express UX contracts — NestJS PR #30',()=>{
 let api:OrdersApi;let backend:HttpTestingController;
 beforeEach(()=>{
  TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
  api=TestBed.inject(OrdersApi);backend=TestBed.inject(HttpTestingController);
 });
 afterEach(()=>backend.verify());

 it('quotes using NestJS and never sends amount calculated by Angular',()=>{
  api.quote('branch-1',[{varianteId:'water',cantidad:'2'}]).subscribe();
  const req=backend.expectOne(orderPaths.quote);
  expect(req.request.method).toBe('POST');
  expect(req.request.body).toEqual({sucursalId:'branch-1',lineas:[{varianteId:'water',cantidad:'2'}]});
  req.flush({sucursalId:'branch-1',moneda:'GTQ',subtotal:'14.00',descuentoTotal:'0.00',
   total:'14.00',lineas:[],advertencia:'Cotización informativa'});
 });
 it('collects and closes direct inventory sale atomically with one operation key',()=>{
  const data={sucursalId:'branch-1',modalidad:'MOSTRADOR' as const,
   lineaPlaceholder:undefined,lineas:[{varianteId:'water',cantidad:'1'}],
   turnoId:'shift-1',pagos:[{metodo:'EFECTIVO' as const,monto:'7.00',efectivoRecibido:'10.00'}],
   enviarCocina:true,claveOperacion:'POS:fixed-key-for-retry'};
  api.quickCheckout(data).subscribe();
  const req=backend.expectOne(orderPaths.quickCheckout);
  expect(req.request.method).toBe('POST');
  expect(req.request.body.claveOperacion).toBe('POS:fixed-key-for-retry');
  expect(req.request.body.pagos[0].efectivoRecibido).toBe('10.00');
  req.flush({ordenId:'o1',numero:'ORD-1',ventaId:'v1',estado:'CERRADA',
   total:'7.00',pagoIds:['p1']});
 });
 it('paginates all branch kitchen tickets from a global server queue',()=>{
  api.queue({sucursalId:'branch-1',estacionId:'station',vista:'ACTIVAS',page:2,limit:15}).subscribe();
  const req=backend.expectOne(r=>r.url===orderPaths.queue);
  expect(req.request.method).toBe('GET');
  expect(req.request.params.get('sucursalId')).toBe('branch-1');
  expect(req.request.params.get('estacionId')).toBe('station');
  expect(req.request.params.get('vista')).toBe('ACTIVAS');
  expect(req.request.params.get('page')).toBe('2');
  req.flush({data:[],meta:{page:2,limit:15,total:30,totalPages:2},
   totals:{pending:12,preparing:8,readyToDeliver:6,delivered:4}});
 });
 it('uses a single request to prepare and deliver a whole comanda',()=>{
  api.readyDeliverTicket('ticket-1','KDS:repeat:1').subscribe();
  const req=backend.expectOne(orderPaths.ticket('ticket-1')+'/ready-deliver');
  expect(req.request.body).toEqual({claveOperacion:'KDS:repeat:1'});
  req.flush({id:'ticket-1',estado:'LISTA',comandaLineasComoComanda:[]});
  api.readyDeliverLine('line-1','KDS:repeat:2').subscribe();
  const second=backend.expectOne(orderPaths.lineKitchen('line-1')+'/ready-deliver');
  expect(second.request.body).toEqual({claveOperacion:'KDS:repeat:2'});
  second.flush({id:'ticket-1',estado:'LISTA',comandaLineasComoComanda:[]});
 });
 it('loads all order balances using the worklist, not per-row N+1 reads',()=>{
  api.worklist({sucursalId:'branch-1',estado:'ABIERTA',page:1,limit:20}).subscribe();
  const req=backend.expectOne(r=>r.url===orderPaths.worklist);
  expect(req.request.params.get('estado')).toBe('ABIERTA');
  req.flush({data:[],meta:{page:1,limit:20,total:0,totalPages:0}});
 });
 it('uses the single pay-and-send mutation for paid prepared orders',()=>{
  api.payAndSend('o1',{turnoId:'shift-1',pagos:[{metodo:'EFECTIVO',monto:'22.00'}],
   claveOperacion:'ORD:paid:1'}).subscribe();
  const req=backend.expectOne(orderPaths.order('o1')+'/pay-and-send');
  expect(req.request.method).toBe('POST');
  expect(req.request.body.claveOperacion).toBe('ORD:paid:1');
  req.flush({ordenId:'o1',estado:'ABIERTA',pagoIds:['p1'],comandasPendientes:1});
 });
});
