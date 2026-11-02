import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController,provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {GC_SILENT_ERROR} from '../../../core/http/api-context';
import {RecipesApi,recipeParams,recipePaths} from './recipes.api';

describe('REC-A UI contracts (phase 1)',()=>{
 let api:RecipesApi;let http:HttpTestingController;
 beforeEach(()=>{
  TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
  api=TestBed.inject(RecipesApi);http=TestBed.inject(HttpTestingController);
 });
 afterEach(()=>http.verify());
 it('serializes only meaningful query filters without losing zero or false',()=>{
  const query=recipeParams({search:'',limit:20,page:2,activo:false,other:null});
  expect(query.get('limit')).toBe('20');
  expect(query.get('page')).toBe('2');
  expect(query.get('activo')).toBe('false');
  expect(query.has('search')).toBe(false);
 });
 it('loads compact summary and paginated recipe options',()=>{
  api.list({page:2,limit:20,tipo:'VENTA'}).subscribe();
  let r=http.expectOne(x=>x.url===recipePaths.list);
  expect(r.request.params.get('vista')).toBe('RESUMEN');
  expect(r.request.params.get('page')).toBe('2');
  expect(r.request.context.get(GC_SILENT_ERROR)).toBe(true);
  r.flush({data:[],meta:{page:2,limit:20,total:0,totalPages:0}});
  api.options({search:'café'}).subscribe();
  r=http.expectOne(x=>x.url===recipePaths.options);
  expect(r.request.params.get('search')).toBe('café');
  r.flush({data:[],meta:{page:1,limit:20,total:0,totalPages:0}});
  api.coverage({page:1,limit:20}).subscribe();
  http.expectOne(x=>x.url===recipePaths.coverage).flush({total:0,pendientes:{data:[],meta:{}}});
 });
 it('covers create, edit, version history and publish with exact backend routes',()=>{
  api.create({nombre:'Capuchino',tipo:'VENTA',varianteId:'v1',version:{
   rendimiento:'1',unidadRendimientoId:'u1',componentes:[{articuloId:'a1',unidadId:'u2',cantidad:'150',mermaPorcentaje:'0'}],publicar:true
  }}).subscribe();
  let r=http.expectOne(recipePaths.list);
  expect(r.request.method).toBe('POST');expect(r.request.body.version.publicar).toBe(true);r.flush({id:'r1'});
  api.detail('r1').subscribe();http.expectOne(recipePaths.recipe('r1')).flush({});
  api.update('r1',{nombre:'Capuchino grande'}).subscribe();
  r=http.expectOne(recipePaths.recipe('r1'));expect(r.request.method).toBe('PATCH');r.flush({});
  const version={unidadRendimientoId:'u1',rendimiento:'1',componentes:[{articuloId:'a1',unidadId:'u2',cantidad:'150'}]};
  api.addVersion('r1',version).subscribe();
  r=http.expectOne(recipePaths.versions('r1'));expect(r.request.method).toBe('POST');r.flush({});
  api.editVersion('rv1',version).subscribe();
  r=http.expectOne(recipePaths.version('rv1'));expect(r.request.method).toBe('PUT');r.flush({});
  api.publish('rv1').subscribe();
  r=http.expectOne(recipePaths.publish('rv1'));expect(r.request.method).toBe('POST');r.flush({});
  api.unpublish('rv1').subscribe();
  r=http.expectOne(recipePaths.unpublish('rv1'));expect(r.request.method).toBe('POST');r.flush({activa:false});
  api.discardVersion('draft1').subscribe();
  r=http.expectOne(recipePaths.version('draft1'));expect(r.request.method).toBe('DELETE');r.flush({descartada:true});
  api.preview('rv1',{sucursalId:'b1'}).subscribe();
  r=http.expectOne(x=>x.url===recipePaths.versionPreview('rv1'));
  expect(r.request.params.has('ubicacionId')).toBe(false);r.flush({});
 });
 it('covers commercial ingredient quotes and all seven production routes',()=>{
  api.quote({recetaVersionId:'v1',sucursalId:'b1',ubicacionId:'l1',cantidad:'2',
   modificadores:['extra1'],modalidad:'PARA_LLEVAR'}).subscribe();
  let r=http.expectOne(recipePaths.preview);
  expect(r.request.method).toBe('POST');expect(r.request.body.modificadores).toEqual(['extra1']);r.flush({});
  api.productionList({sucursalId:'b1',page:2,limit:20}).subscribe();
  r=http.expectOne(x=>x.url===recipePaths.production);
  expect(r.request.params.get('page')).toBe('2');r.flush({data:[],meta:{page:2,limit:20,total:0,totalPages:0}});
  const input={recetaVersionId:'v1',ubicacionDestinoId:'l1',cantidadProducida:'1000',
   claveOperacion:'PROD:UI:abc'};
  api.productionDraft(input).subscribe();
  r=http.expectOne(recipePaths.production);
  expect(r.request.method).toBe('POST');expect(r.request.body.claveOperacion).toBe('PROD:UI:abc');r.flush({});
  api.productionExecute(input).subscribe();
  r=http.expectOne(recipePaths.execute);
  expect(r.request.method).toBe('POST');expect(r.request.body).toEqual(input);r.flush({});
  api.productionDetail('p1').subscribe();
  http.expectOne(recipePaths.productionOne('p1')).flush({});
  api.productionConfirm('p1').subscribe();
  r=http.expectOne(recipePaths.confirm('p1'));expect(r.request.method).toBe('POST');r.flush({});
  api.productionCancel('p1').subscribe();
  r=http.expectOne(recipePaths.cancel('p1'));expect(r.request.method).toBe('POST');r.flush({});
  api.productionReport({sucursalId:'b1',fechaDesde:'2026-11-01T00:00:00Z'}).subscribe();
  r=http.expectOne(x=>x.url===recipePaths.productionReport);
  expect(r.request.params.get('fechaDesde')).toBe('2026-11-01T00:00:00Z');r.flush({});
 });
 it('covers modifier ingredient composition and packaging lifecycle',()=>{
  api.modifier('m1').subscribe();http.expectOne(recipePaths.modifier('m1')).flush({});
  api.setModifier('m1',[{articuloId:'a1',unidadId:'u1',cantidad:'1',efecto:'SUMAR'}]).subscribe();
  let r=http.expectOne(recipePaths.modifier('m1'));expect(r.request.method).toBe('PUT');
  expect(r.request.body.componentes).toHaveLength(1);r.flush({});
  api.packaging({sucursalId:'b1'}).subscribe();
  http.expectOne(x=>x.url===recipePaths.packaging).flush([]);
  const dto={nombre:'Para llevar',alcance:'ORDEN' as const,modalidad:'PARA_LLEVAR' as const,
   lineas:[{articuloId:'a1',cantidad:'1'}]};
  api.createPackaging(dto).subscribe();
  r=http.expectOne(recipePaths.packaging);expect(r.request.method).toBe('POST');r.flush({});
  api.packagingOne('p1').subscribe();http.expectOne(recipePaths.packagingOne('p1')).flush({});
  api.updatePackaging('p1',dto).subscribe();
  r=http.expectOne(recipePaths.packagingOne('p1'));expect(r.request.method).toBe('PUT');r.flush({});
  api.packagingStatus('p1',false).subscribe();
  r=http.expectOne(recipePaths.packagingStatus('p1'));expect(r.request.body).toEqual({activa:false});r.flush({});
 });
});
