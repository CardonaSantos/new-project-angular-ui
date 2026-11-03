import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController,provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import type {Observable} from 'rxjs';
import {PaymentsApi,paymentPaths} from './payments.api';
describe('PAY-A HTTP — 20 real routes',()=>{
 let api:PaymentsApi;let http:HttpTestingController;
 beforeEach(()=>{
  TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
  api=TestBed.inject(PaymentsApi);http=TestBed.inject(HttpTestingController);
 });
 afterEach(()=>http.verify());
 function check(method:string,url:string,fn:()=>Observable<unknown>,body?:unknown){
  fn().subscribe();
  const req=http.expectOne(r=>r.url===url);
  expect(req.request.method).toBe(method);
  if(body!==undefined)expect(req.request.body).toEqual(body);
  req.flush({});
  return req;
 }
 it('connects 8 cash registers, shift and reconciliation endpoints',()=>{
  check('GET',paymentPaths.registers,()=>api.registers('b1'));
  check('POST',paymentPaths.registers,
   ()=>api.createRegister({sucursalId:'b1',codigo:'C1',nombre:'Caja 1'}),
   {sucursalId:'b1',codigo:'C1',nombre:'Caja 1'});
  check('PATCH',paymentPaths.register('c1'),()=>api.updateRegister('c1',{activa:false}),{activa:false});
  check('GET',paymentPaths.shifts,()=>api.shifts('b1',2,15));
  check('POST',paymentPaths.shifts,
   ()=>api.openShift({cajaId:'c1',fondoInicial:'100.00',claveOperacion:'shift:abc'}),
   {cajaId:'c1',fondoInicial:'100.00',claveOperacion:'shift:abc'});
  check('GET',paymentPaths.shift('s1'),()=>api.shift('s1'));
  check('POST',paymentPaths.shift('s1')+'/movements',
   ()=>api.movement('s1',{tipo:'EGRESO',monto:'3.00',motivo:'Compra suministros',claveOperacion:'out:1'}),
   {tipo:'EGRESO',monto:'3.00',motivo:'Compra suministros',claveOperacion:'out:1'});
  check('POST',paymentPaths.shift('s1')+'/close',
   ()=>api.closeShift('s1',{efectivoContado:'130.00',claveOperacion:'close:1'}),
   {efectivoContado:'130.00',claveOperacion:'close:1'});
 });
 it('connects 6 account operations incl split, collect and finalize',()=>{
  check('GET',paymentPaths.accounts('o1'),()=>api.accounts('o1'));
  check('POST',paymentPaths.finalize('o1'),()=>api.finalize('o1'),{});
  check('GET',paymentPaths.account('a1'),()=>api.account('a1'));
  const dto={turnoId:'s1',pagos:[{metodo:'EFECTIVO' as const,monto:'24.00',efectivoRecibido:'30.00'}],
   claveOperacion:'collect:1'};
  check('POST',paymentPaths.account('a1')+'/payments',()=>api.collect('a1',dto),dto);
  const split={cuentas:[{nombre:'Mesa 1',lineas:[{ordenLineaId:'l1',cantidadAsignada:'1',importeAsignado:'24.00'}]},
   {nombre:'Mesa 2',lineas:[{ordenLineaId:'l2',cantidadAsignada:'1',importeAsignado:'20.00'}]}],
   claveOperacion:'split:1'};
  check('POST',paymentPaths.split('o1'),()=>api.split('o1',split),split);
  check('POST',paymentPaths.splitEqual('o1'),()=>api.splitEqual('o1',{personas:3,claveOperacion:'equal:1'}),
   {personas:3,claveOperacion:'equal:1'});
 });
 it('connects 3 payment verification and refund endpoints',()=>{
  check('POST',paymentPaths.attempt('t1')+'/confirm',
   ()=>api.confirmAttempt('t1',{turnoId:'s1',motivo:'Transferencia recibida',claveOperacion:'verify:1'}),
   {turnoId:'s1',motivo:'Transferencia recibida',claveOperacion:'verify:1'});
  check('POST',paymentPaths.attempt('t1')+'/cancel',
   ()=>api.cancelAttempt('t1',{motivo:'Transferencia inexistente',claveOperacion:'cancel:1'}),
   {motivo:'Transferencia inexistente',claveOperacion:'cancel:1'});
  check('POST',paymentPaths.payment('p1')+'/refund',()=>api.refund('p1',
   {monto:'3.00',motivo:'Cobro equivocado',turnoId:'s1',claveOperacion:'refund:1'}),
   {monto:'3.00',motivo:'Cobro equivocado',turnoId:'s1',claveOperacion:'refund:1'});
 });
 it('connects 3 sales and financial report endpoints',()=>{
  check('GET',paymentPaths.sales,()=>api.sales('b1'));
  check('GET',paymentPaths.sale('v1'),()=>api.sale('v1'));
  check('GET',paymentPaths.summary,()=>api.summary('b1'));
 });
 it('scopes requests to branches and paginates without changing IDs',()=>{
  api.shifts('branch-test',2,15).subscribe();
  let req=http.expectOne(r=>r.url===paymentPaths.shifts);
  expect(req.request.params.get('sucursalId')).toBe('branch-test');
  expect(req.request.params.get('page')).toBe('2');
  expect(req.request.params.get('limit')).toBe('15');req.flush({});
  api.registers('branch-test').subscribe();req=http.expectOne(r=>r.url===paymentPaths.registers);
  expect(req.request.params.get('sucursalId')).toBe('branch-test');req.flush({});
  expect(paymentPaths.account('a/b')).toBe('/api/accounts/a%2Fb');
 });
});
