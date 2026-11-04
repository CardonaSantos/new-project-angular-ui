import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController,provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {ReportsApi,REPORT_PATHS} from './reports.api';
describe('REP-A report contracts against current NestJS endpoints',()=>{
 let api:ReportsApi,requests:HttpTestingController;
 beforeEach(()=>{
  TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
  api=TestBed.inject(ReportsApi);requests=TestBed.inject(HttpTestingController);
 });
 afterEach(()=>requests.verify());
 it('reads operational figures only within the chosen branch',()=>{
  api.operational('branch-one').subscribe();
  const req=requests.expectOne(r=>r.url===REPORT_PATHS.operational);
  expect(req.request.method).toBe('GET');
  expect(req.request.params.get('sucursalId')).toBe('branch-one');
  req.flush({generatedAt:'2026-11-04T21:00:00Z',freshness:'LIVE_READ',
   sucursal:{id:'branch-one',nombre:'Principal'},horizonMinutes:120,kpis:{}});
 });
 it('uses operational date and source period filters, not browser timestamps',()=>{
  api.overview({sucursalId:'b1',periodo:'PERSONALIZADO',
   desde:'2026-10-29',hasta:'2026-11-04'}).subscribe();
  const req=requests.expectOne(REPORT_PATHS.overview+'?sucursalId=b1&periodo=PERSONALIZADO&desde=2026-10-29&hasta=2026-11-04');
  expect(req.request.method).toBe('GET');req.flush({serieDiaria:[],kpis:{}});
 });
 it('passes server paging and user-scoped report sources',()=>{
  api.source('SALES_LINES',{sucursalId:'b2',periodo:'MES',page:3,limit:20}).subscribe();
  const req=requests.expectOne(r=>r.url===REPORT_PATHS.sources('SALES_LINES'));
  expect(req.request.params.get('sucursalId')).toBe('b2');
  expect(req.request.params.get('page')).toBe('3');req.flush({data:[],meta:{total:0,page:3,limit:20,totalPages:0}});
 });
 it('downloads the backend-generated PDF as bytes instead of building fake files',()=>{
  api.export('SALES_LINES',{sucursalId:'b1',periodo:'MES'},'PDF').subscribe();
  const req=requests.expectOne(r=>r.url===REPORT_PATHS.exports('SALES_LINES'));
  expect(req.request.method).toBe('GET');
  expect(req.request.responseType).toBe('blob');
  expect(req.request.params.get('format')).toBe('PDF');
  req.flush(new Blob(['pdf data'],{type:'application/pdf'}),{
   headers:{'Content-Type':'application/pdf'}
  });
 });
});
