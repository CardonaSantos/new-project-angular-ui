import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController,provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {PurchasesApi,purchasePaths} from './purchases.api';
import {InventoryApi} from '../../inventory/data-access/inventory.api';

describe('PUR / SUP — real backend contract and inventory posting',()=>{
 let purchases:PurchasesApi,inventory:InventoryApi,requests:HttpTestingController;
 beforeEach(()=>{
  TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
  purchases=TestBed.inject(PurchasesApi);
  inventory=TestBed.inject(InventoryApi);
  requests=TestBed.inject(HttpTestingController);
 });
 afterEach(()=>requests.verify());

 it('uses the inventory inbound endpoint for a direct one-step entry',()=>{
  const body={articuloId:'milk',ubicacionId:'bar',cantidad:'12',costoUnitario:'8.5',
   claveOperacion:'direct-100',motivo:'Compra directa'};
  inventory.manual('inbound',body).subscribe();
  const inbound=requests.expectOne(r=>r.url==='/api/inventory/operations/inbound');
  expect(inbound.request.method).toBe('POST');
  expect(inbound.request.body).toEqual(body);
  inbound.flush({id:'mov1'});
  requests.expectNone(purchasePaths.receipts);
 });

 it('does not credit stock while a purchase receipt is still a draft',()=>{
  const receipt={proveedorId:'p1',almacenId:'w1',referenciaProveedor:'Factura 01',
   precioIncluyeImpuesto:false,lineas:[{
    articuloId:'milk',ubicacionId:'bar',cantidadCompra:'12',factorAUnidadBase:'1',
    precioUnitarioCompra:'8.5',tasaImpuesto:'0',impuestoRecuperable:false
   }]};
  purchases.createReceipt(receipt).subscribe();
  const draft=requests.expectOne(purchasePaths.receipts);
  expect(draft.request.method).toBe('POST');
  expect(draft.request.body).toEqual(receipt);
  draft.flush({id:'r1',estado:'BORRADOR'});
  requests.expectNone(purchasePaths.receipt('r1')+'/confirm');
  requests.expectNone('/api/inventory/operations/inbound');
  purchases.confirmReceipt('r1','posted-unique-01').subscribe();
  const confirm=requests.expectOne(purchasePaths.receipt('r1')+'/confirm');
  expect(confirm.request.method).toBe('POST');
  expect(confirm.request.body).toEqual({claveOperacion:'posted-unique-01'});
  confirm.flush({id:'r1',estado:'CONFIRMADO',movimientoIds:['m1']});
 });

 it('sends optional linked purchase order lines and server-side receipt filters',()=>{
  purchases.receipts({sucursalId:'b1',proveedorId:'p1',page:3,limit:50}).subscribe();
  const page=requests.expectOne(r=>r.url===purchasePaths.receipts);
  expect(page.request.params.get('sucursalId')).toBe('b1');
  expect(page.request.params.get('proveedorId')).toBe('p1');
  expect(page.request.params.get('page')).toBe('3');
  expect(page.request.params.get('limit')).toBe('50');
  page.flush({data:[],meta:{page:3,limit:50,total:0,totalPages:0}});
  purchases.createReceipt({proveedorId:'p1',almacenId:'w1',ordenCompraId:'oc1',
   lineas:[{ordenCompraLineaId:'line1',articuloId:'milk',ubicacionId:'bar',
    cantidadCompra:'2',factorAUnidadBase:'12',precioUnitarioCompra:'12'}]}).subscribe();
  const req=requests.expectOne(purchasePaths.receipts);
  expect(req.request.body.ordenCompraLineaId).toBeUndefined();
  expect(req.request.body.lineas[0].ordenCompraLineaId).toBe('line1');
  req.flush({id:'rc2',estado:'BORRADOR'});
 });

 it('creates a requisition purchase draft without claiming an immediate receipt',()=>{
  const order={proveedorId:'p1',sucursalId:'b1',requisicionId:'req1',
   lineas:[{articuloId:'milk',cantidadCompra:'2',factorAUnidadBase:'1',precioUnitarioCompra:'8'}]};
  purchases.purchaseFromRequisition('req1',{claveOperacion:'requisition-01',orden:order}).subscribe();
  const req=requests.expectOne(purchasePaths.requisition('req1')+'/purchase-draft');
  expect(req.request.method).toBe('POST');
  expect(req.request.body.orden.requisicionId).toBe('req1');
  req.flush({id:'oc1',estado:'BORRADOR'});
  requests.expectNone(purchasePaths.receipts);
 });

 it('preserves quantities on sent and received SUP transfers',()=>{
  purchases.sendRequisition('req1',{almacenOrigenId:'w1',claveOperacion:'send-01',
   inmediato:false,lineas:[{articuloId:'milk',ubicacionOrigenId:'l1',
    ubicacionDestinoId:'l2',cantidad:'10'}]}).subscribe();
  const send=requests.expectOne(purchasePaths.requisition('req1')+'/send');
  expect(send.request.body.inmediato).toBe(false);
  expect(send.request.body.lineas[0].cantidad).toBe('10');
  send.flush({id:'tr1',estado:'EN_TRANSITO'});
  purchases.receiveTransfer('tr1',{claveOperacion:'receive-01',
   lineas:[{transferenciaLineaId:'tl1',cantidadRecibida:'6'}]}).subscribe();
  const receive=requests.expectOne(purchasePaths.transfer('tr1')+'/receive');
  expect(receive.request.method).toBe('POST');
  expect(receive.request.body.lineas[0].cantidadRecibida).toBe('6');
  receive.flush({id:'tr1',estado:'EN_TRANSITO'});
 });
});
