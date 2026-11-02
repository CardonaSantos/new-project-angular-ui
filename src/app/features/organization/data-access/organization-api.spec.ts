import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GcBranchesApi } from '../../../core/organization/gc-branches.api';
import { BranchesApi, CompanyApi, DevicesApi } from './organization-api';

describe('Organization HTTP contracts', () => {
  let http:HttpTestingController;
  let company:CompanyApi;
  let branches:BranchesApi;
  let devices:DevicesApi;
  beforeEach(()=>{
    TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
    http=TestBed.inject(HttpTestingController);
    company=TestBed.inject(CompanyApi);
    branches=TestBed.inject(BranchesApi);
    devices=TestBed.inject(DevicesApi);
  });
  afterEach(()=>http.verify());
  it('reads and updates company and feature capabilities',()=>{
    company.get().subscribe();
    http.expectOne('/api/organization').flush({});
    company.capabilities().subscribe();
    http.expectOne('/api/organization/capabilities').flush({});
    company.update({nombreComercial:'Café Central',moneda:'GTQ'}).subscribe();
    const update=http.expectOne('/api/organization');
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({nombreComercial:'Café Central',moneda:'GTQ'});
    update.flush({});
  });
  it('lists branches with explicit server pagination and boolean status',()=>{
    branches.list({page:2,limit:25,search:'central',activo:false}).subscribe();
    const req=http.expectOne(r=>r.url==='/api/branches');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('25');
    expect(req.request.params.get('search')).toBe('central');
    expect(req.request.params.get('activo')).toBe('false');
    req.flush({data:[],meta:{page:2,limit:25,total:0,totalPages:0}});
  });
  it('covers branch options, details, configuration and overview',()=>{
    branches.options({search:'caf',limit:15}).subscribe();
    const options=http.expectOne(r=>r.url==='/api/branches/options');
    expect(options.request.params.get('search')).toBe('caf');
    options.flush({data:[],meta:{hasMore:false,nextCursor:null}});
    branches.get('sucursal/123').subscribe();
    http.expectOne('/api/branches/sucursal%2F123').flush({});
    branches.config('b1').subscribe();
    http.expectOne('/api/branches/b1/config').flush({});
    branches.overview('b1').subscribe();
    http.expectOne('/api/branches/b1/overview').flush({});
    const access=TestBed.inject(GcBranchesApi);
    access.myAccess().subscribe({error:()=>undefined});
    http.expectOne('/api/branches/my-access').flush({data:[]});
  });
  it('creates and edits branches, operational configuration and status reasons',()=>{
    branches.create({codigo:'CENTRAL',nombre:'Central'}).subscribe();
    const create=http.expectOne('/api/branches');
    expect(create.request.method).toBe('POST');
    create.flush({});
    branches.update('b1',{direccion:'Zona 1'}).subscribe();
    const update=http.expectOne('/api/branches/b1');
    expect(update.request.method).toBe('PATCH');
    update.flush({});
    branches.updateConfig('b1',{horaCorteOperativo:'04:00',permiteStockNegativo:false}).subscribe();
    const cfg=http.expectOne('/api/branches/b1/config');
    expect(cfg.request.body.permiteStockNegativo).toBe(false);
    cfg.flush({});
    branches.status('b1',false,'Reorganización').subscribe();
    const status=http.expectOne('/api/branches/b1/status');
    expect(status.request.body).toEqual({activa:false,motivo:'Reorganización'});
    status.flush({});
  });
  it('covers device filters, options and detail',()=>{
    devices.list({page:1,limit:10,sucursalId:'b1',tipo:'KDS',activo:true}).subscribe();
    const list=http.expectOne(r=>r.url==='/api/devices');
    expect(list.request.params.get('sucursalId')).toBe('b1');
    expect(list.request.params.get('tipo')).toBe('KDS');
    expect(list.request.params.get('activo')).toBe('true');
    list.flush({data:[],meta:{page:1,limit:10,total:0,totalPages:0}});
    devices.options({sucursalId:'b1',tipo:'POS'}).subscribe();
    const options=http.expectOne(r=>r.url==='/api/devices/options');
    expect(options.request.params.get('tipo')).toBe('POS');
    options.flush({data:[],meta:{hasMore:false,nextCursor:null}});
    devices.get('dv1').subscribe();
    http.expectOne('/api/devices/dv1').flush({});
  });
  it('creates, updates and deactivates devices without inventing endpoints',()=>{
    devices.create({codigo:'KITCHEN',nombre:'Cocina',sucursalId:'b1',
      tipo:'KDS',estacionPreparacionId:'e1'}).subscribe();
    const create=http.expectOne('/api/devices');
    expect(create.request.method).toBe('POST');
    expect(create.request.body.estacionPreparacionId).toBe('e1');
    create.flush({});
    devices.update('d1',{nombre:'Cocina 2',tipo:'KDS'}).subscribe();
    const edit=http.expectOne('/api/devices/d1');
    expect(edit.request.method).toBe('PATCH');
    edit.flush({});
    devices.status('d1',false,'Reemplazo').subscribe();
    const status=http.expectOne('/api/devices/d1/status');
    expect(status.request.body).toEqual({activa:false,motivo:'Reemplazo'});
    status.flush({});
  });
});
