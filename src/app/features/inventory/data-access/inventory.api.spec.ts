
import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController,provideHttpClientTesting} from '@angular/common/http/testing';
import {InventoryApi,inventoryParams} from './inventory.api';

describe('Inventory API — NestJS contract',()=>{
 let api:InventoryApi;
 let http:HttpTestingController;
 beforeEach(()=>{
  TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
  api=TestBed.inject(InventoryApi);http=TestBed.inject(HttpTestingController);
 });
 afterEach(()=>http.verify());
 it('encodes only supplied params without inventing filters',()=>{
  const p=inventoryParams({sucursalId:'b1',articuloId:'',activo:false,page:2,limit:20,ignored:null});
  expect(p.keys().sort()).toEqual(['activo','limit','page','sucursalId']);
  expect(p.get('activo')).toBe('false');
 });
 it('requests inventory articles and primary photos from the existing read route',()=>{
  api.articles({search:'café',page:2,limit:10,activo:true}).subscribe();
  const req=http.expectOne(r=>r.url==='/api/inventory/articles');
  expect(req.request.method).toBe('GET');
  expect(req.request.params.get('search')).toBe('café');
  expect(req.request.params.get('page')).toBe('2');
  req.flush({data:[],meta:{page:2,limit:10,total:0,totalPages:0}});
 });
 it('loads the new count and transfer listings with branch and state filters',()=>{
  api.counts({sucursalId:'b1',estado:'BORRADOR',page:1,limit:25}).subscribe();
  const count=http.expectOne(r=>r.url==='/api/inventory/counts');
  expect(count.request.method).toBe('GET');
  expect(count.request.params.get('estado')).toBe('BORRADOR');
  count.flush({data:[],meta:{page:1,limit:25,total:0,totalPages:0}});
  api.transfers({sucursalId:'b2',estado:'EN_TRANSITO',page:2}).subscribe();
  const transfer=http.expectOne(r=>r.url==='/api/inventory/transfers');
  expect(transfer.request.params.get('sucursalId')).toBe('b2');
  expect(transfer.request.params.get('page')).toBe('2');
  transfer.flush({data:[],meta:{page:2,limit:20,total:0,totalPages:0}});
 });
 it('requests new lots without stock only when an article is selected',()=>{
  api.lots({sucursalId:'b1',articuloId:'a1',incluirSinExistencias:true}).subscribe();
  const req=http.expectOne(r=>r.url==='/api/inventory/lots');
  expect(req.request.params.get('articuloId')).toBe('a1');
  expect(req.request.params.get('incluirSinExistencias')).toBe('true');
  req.flush({data:[],meta:{page:1,limit:20,total:0,totalPages:0}});
 });
 it('sends serializable decimal strings and idempotency keys to the manual posting route',()=>{
  const body={articuloId:'a1',ubicacionId:'l1',cantidad:'5.250000',costoUnitario:'1.250000',
   motivo:'Carga inicial',claveOperacion:'UI:1234'};
  api.manual('opening',body).subscribe();
  const req=http.expectOne('/api/inventory/operations/opening');
  expect(req.request.method).toBe('POST');expect(req.request.body).toEqual(body);
  req.flush({id:'m1'});
 });
 it('submits transfer and count documents only with their nested lines',()=>{
  api.createCount({almacenId:'w1',nota:'Conteo semanal',lineas:[
   {articuloId:'a1',ubicacionId:'l1',cantidadContada:'12.000000'}
  ]}).subscribe();
  const count=http.expectOne('/api/inventory/counts');
  expect(count.request.body.lineas).toHaveLength(1);
  count.flush({id:'c1'});
  api.createTransfer({almacenOrigenId:'w1',almacenDestinoId:'w2',nota:'Traslado programado',
   lineas:[{articuloId:'a1',ubicacionOrigenId:'l1',ubicacionDestinoId:'l2',cantidad:'5.000000'}]
  }).subscribe();
  const transfer=http.expectOne('/api/inventory/transfers');
  expect(transfer.request.method).toBe('POST');
  expect(transfer.request.body.lineas[0].cantidad).toBe('5.000000');
  transfer.flush({id:'t1'});
 });
 it('separates preview-only conversion from confirmed persistent writes',()=>{
  api.conversionPreview({unidadOrigenId:'u1',unidadDestinoId:'u2',cantidad:'2.5'}).subscribe();
  const preview=http.expectOne('/api/inventory/conversions/preview');
  expect(preview.request.method).toBe('POST');preview.flush({resultado:'2500'});
  api.createConversion({unidadOrigenId:'u1',unidadDestinoId:'u2',factor:'1000'}).subscribe();
  const create=http.expectOne('/api/inventory/conversions');
  expect(create.request.body.factor).toBe('1000');create.flush({id:'cx1'});
 });
 it('uses only backend document-state transition routes',()=>{
  api.countAction('c/1','confirm').subscribe();
  const a=http.expectOne('/api/inventory/counts/c%2F1/confirm');
  expect(a.request.method).toBe('POST');a.flush({});
  api.transferAction('t1','receive').subscribe();
  const b=http.expectOne('/api/inventory/transfers/t1/receive');
  expect(b.request.method).toBe('POST');b.flush({});
 });
});
