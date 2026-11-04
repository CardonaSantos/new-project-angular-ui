import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController,provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import type {Observable} from 'rxjs';
import {OrdersApi,orderPaths} from './orders.api';
import {operationKey,safeQuantity} from './orders.helpers';

describe('ORD-A UI — all 32 backend endpoints',()=>{
 let api:OrdersApi;let http:HttpTestingController;
 beforeEach(()=>{
  TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
  api=TestBed.inject(OrdersApi);http=TestBed.inject(HttpTestingController);
 });
 afterEach(()=>http.verify());
 function request(method:string,url:string,doCall:()=>Observable<unknown>,body?:unknown){
  doCall().subscribe();
  const req=http.expectOne(r=>r.url===url);
  expect(req.request.method).toBe(method);
  if(body!==undefined)expect(req.request.body).toEqual(body);
  req.flush({});
  return req;
 }
 it('covers all ten order routes and protects idempotency payloads',()=>{
  const line={varianteId:'v1',cantidad:'2.000',modificadores:[{modificadorId:'m1'}]};
  const dto={sucursalId:'b1',modalidad:'MESA' as const,mesaId:'t1',
   lineas:[line],enviarCocina:false,claveOperacion:'ORD:UI:abcd1234'};
  request('GET',orderPaths.orders,()=>api.list({sucursalId:'b1',estado:'ABIERTA',page:2,limit:10}));
  request('POST',orderPaths.orders,()=>api.create(dto),dto);
  request('GET',orderPaths.order('a/1'),()=>api.detail('a/1'));
  request('PATCH',orderPaths.order('o1'),()=>api.edit('o1',{version:3,observaciones:'Sin azúcar'}),
   {version:3,observaciones:'Sin azúcar'});
  request('POST',orderPaths.order('o1')+'/lines',()=>api.addLines('o1',{
   lineas:[line],claveOperacion:'ORD:UI:add12345',enviarCocina:true
  }),{lineas:[line],claveOperacion:'ORD:UI:add12345',enviarCocina:true});
  request('PATCH',orderPaths.line('o1','l1'),()=>api.editLine('o1','l1',{
   cantidad:'3',claveOperacion:'ORD:UI:edit123'
  }),{cantidad:'3',claveOperacion:'ORD:UI:edit123'});
  request('POST',orderPaths.line('o1','l1')+'/cancel',
   ()=>api.cancelLine('o1','l1','Pedido incorrecto'),{motivo:'Pedido incorrecto'});
  request('POST',orderPaths.order('o1')+'/send',()=>api.send('o1','ORD:UI:send123'),
   {claveOperacion:'ORD:UI:send123'});
  request('POST',orderPaths.order('o1')+'/cancel',
   ()=>api.cancel('o1','Error operativo','ERROR_OPERATIVO'),
   {motivo:'Error operativo',clasificacion:'ERROR_OPERATIVO'});
  request('POST',orderPaths.order('o1')+'/close',()=>api.close('o1'),{});
 });
 it('covers all seven room, table and occupancy routes',()=>{
  request('GET',orderPaths.rooms,()=>api.rooms('b1'));
  request('POST',orderPaths.rooms,()=>api.createRoom({sucursalId:'b1',nombre:'Terraza'}),{
   sucursalId:'b1',nombre:'Terraza'});
  request('PATCH',orderPaths.room('r1'),()=>api.updateRoom('r1',{activa:false}),{activa:false});
  request('GET',orderPaths.tables,()=>api.tables('b1'));
  request('POST',orderPaths.tables,()=>api.createTable({salaId:'r1',numero:'01',capacidad:4}),{
   salaId:'r1',numero:'01',capacidad:4});
  request('PATCH',orderPaths.table('t1'),()=>api.updateTable('t1',{capacidad:6}),{capacidad:6});
  request('POST',orderPaths.occupancy('occ1'),()=>api.closeOccupancy('occ1'),{});
 });
 it('covers all fifteen kitchen routes and respects partial preparation keys',()=>{
  request('GET',orderPaths.stations,()=>api.stations('b1'));
  request('POST',orderPaths.stations,()=>api.createStation({sucursalId:'b1',nombre:'Barra'}),{
   sucursalId:'b1',nombre:'Barra'});
  request('PATCH',orderPaths.station('s1'),()=>api.updateStation('s1',{activa:false}),{activa:false});
  request('GET',orderPaths.routes,()=>api.routes('b1'));
  request('POST',orderPaths.routes,()=>api.createRoute({estacionId:'s1',categoriaId:'c1',prioridad:10}),{
   estacionId:'s1',categoriaId:'c1',prioridad:10});
  request('PATCH',orderPaths.route('rt1'),()=>api.updateRoute('rt1',{estacionId:'s2'}),{estacionId:'s2'});
  request('DELETE',orderPaths.route('rt1'),()=>api.deleteRoute('rt1'));
  request('GET',orderPaths.changes,()=>api.changes('b1','cursor/1',15));
  request('GET',orderPaths.tickets,()=>api.tickets({sucursalId:'b1',estado:'PENDIENTE',page:2}));
  request('GET',orderPaths.ticket('kt1'),()=>api.ticket('kt1'));
  request('POST',orderPaths.ticket('kt1')+'/start',()=>api.startTicket('kt1'),{});
  request('POST',orderPaths.ticket('kt1')+'/ready',()=>api.readyTicket('kt1'),{});
  request('POST',orderPaths.lineKitchen('kl1')+'/start',
   ()=>api.startLine('kl1','ORD:UI:partial123','0.500'),{
    claveOperacion:'ORD:UI:partial123',cantidad:'0.500'
   });
  request('POST',orderPaths.lineKitchen('kl1')+'/ready',()=>api.readyLine('kl1'),{});
  request('POST',orderPaths.lineKitchen('kl1')+'/deliver',()=>api.deliverLine('kl1'),{});
 });
 it('submits order search and page size to NestJS before paginating',()=>{
  api.list({sucursalId:'branch-1',search:'ORD-104',estado:'ABIERTA',
   modalidad:'MESA',page:3,limit:50}).subscribe();
  const req=http.expectOne(x=>x.url===orderPaths.orders);
  expect(req.request.params.get('sucursalId')).toBe('branch-1');
  expect(req.request.params.get('search')).toBe('ORD-104');
  expect(req.request.params.get('estado')).toBe('ABIERTA');
  expect(req.request.params.get('modalidad')).toBe('MESA');
  expect(req.request.params.get('page')).toBe('3');
  expect(req.request.params.get('limit')).toBe('50');
  req.flush({data:[],meta:{page:3,limit:50,total:0,totalPages:0}});
  api.list({sucursalId:'branch-1',search:'',page:1,limit:20}).subscribe();
  const empty=http.expectOne(x=>x.url===orderPaths.orders);
  expect(empty.request.params.has('search')).toBe(false);
  empty.flush({data:[],meta:{page:1,limit:20,total:0,totalPages:0}});
 });
 it('preserves branch queries, type safety and quantities',()=>{
  api.tickets({sucursalId:'b1',estado:'PREPARANDO',estacionId:'s1',limit:15}).subscribe();
  let req=http.expectOne(x=>x.url===orderPaths.tickets);
  expect(req.request.params.get('sucursalId')).toBe('b1');
  expect(req.request.params.get('estacionId')).toBe('s1');
  expect(req.request.params.get('limit')).toBe('15');
  req.flush({data:[],meta:{page:1,limit:15,total:0,totalPages:0}});
  api.changes('b1','cursor123',100).subscribe();
  req=http.expectOne(x=>x.url===orderPaths.changes);
  expect(req.request.params.get('cursor')).toBe('cursor123');
  expect(req.request.params.get('limit')).toBe('100');req.flush({data:[],meta:{}});
  expect(safeQuantity('2.500')).toBe('2.5');
  expect(safeQuantity('0')).toBeNull();
  expect(safeQuantity('-1')).toBeNull();
  expect(operationKey('pos').startsWith('pos:')).toBe(true);
 });
});
