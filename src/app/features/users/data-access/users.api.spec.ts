
import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController,provideHttpClientTesting} from '@angular/common/http/testing';
import {MediaApi,RolesApi,UsersApi} from './users.api';
describe('Users and Media HTTP contracts',()=>{
 let mock:HttpTestingController;
 let users:UsersApi;let roles:RolesApi;let media:MediaApi;
 beforeEach(()=>{
  TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
  mock=TestBed.inject(HttpTestingController);
  users=TestBed.inject(UsersApi);roles=TestBed.inject(RolesApi);media=TestBed.inject(MediaApi);
 });
 afterEach(()=>mock.verify());
 it('uploads avatar as multipart file and private PERFIL context without forcing Content-Type',()=>{
  const file=new File([new Uint8Array([137,80,78,71])],'avatar.png',{type:'image/png'});
  media.upload(file).subscribe();
  const request=mock.expectOne('/api/media/upload');
  expect(request.request.method).toBe('POST');
  expect(request.request.body).toBeInstanceOf(FormData);
  const body=request.request.body as FormData;
  expect(body.get('file')).toBe(file);
  expect(body.get('contexto')).toBe('PERFIL');
  expect(body.get('publico')).toBe('false');
  expect(body.has('sucursalId')).toBe(false);
  expect(request.request.headers.has('Content-Type')).toBe(false);
  request.flush({id:'m1'});
  users.avatarMe('m1').subscribe();
  const avatar=mock.expectOne('/api/users/me/avatar');
  expect(avatar.request.method).toBe('PUT');
  expect(avatar.request.body).toEqual({mediaId:'m1'});
  avatar.flush({});
 });
 it('supports admin photos and removal using media IDs',()=>{
  users.avatar('u1','m2').subscribe();
  const put=mock.expectOne('/api/users/u1/avatar');
  expect(put.request.body).toEqual({mediaId:'m2'});put.flush({});
  users.avatarMe(null).subscribe();
  mock.expectOne('/api/users/me/avatar').flush({});
 });
 it('keeps one-time credentials from POST response and exposes no token in URLs',()=>{
  users.create({nombre:'Carlos',email:'carlos@empresa.com'}).subscribe(r=>{
   expect(r.temporaryPassword).toBe('temporary-secret');
  });
  const req=mock.expectOne('/api/users');
  expect(req.request.method).toBe('POST');
  expect(req.request.body).toEqual({nombre:'Carlos',email:'carlos@empresa.com'});
  req.flush({user:{id:'u1'},temporaryPassword:'temporary-secret',requiresPasswordChange:true});
  users.resetPassword('u1','Solicitud del usuario').subscribe();
  const reset=mock.expectOne('/api/users/u1/password/reset');
  expect(reset.request.method).toBe('POST');
  expect(reset.request.body.motivo).toBe('Solicitud del usuario');
  reset.flush({id:'u1',temporaryPassword:'new-secret',requiresPasswordChange:true,sessionsRevoked:true});
 });
 it('sends branch scoped filters and explicit page sizes',()=>{
  users.list({page:2,limit:25,sucursalId:'b1',activo:false}).subscribe();
  const req=mock.expectOne(r=>r.url==='/api/users');
  expect(req.request.params.get('page')).toBe('2');
  expect(req.request.params.get('sucursalId')).toBe('b1');
  expect(req.request.params.get('activo')).toBe('false');
  req.flush({data:[],meta:{page:2,limit:25,total:0,totalPages:0}});
  users.detail('u/1','b1').subscribe();
  mock.expectOne(r=>r.url==='/api/users/u%2F1' && r.params.get('sucursalId')==='b1').flush({});
 });
 it('uses explicit assignment replacement and scoped role matrices',()=>{
  users.addAssignment('u1','r1','b1').subscribe();
  const add=mock.expectOne('/api/users/u1/roles');
  expect(add.request.method).toBe('POST');
  expect(add.request.body).toEqual({rolId:'r1',sucursalId:'b1'});add.flush({});
  users.replaceAssignments('u1',[{rolId:'r1',sucursalId:null}]).subscribe();
  const replace=mock.expectOne('/api/users/u1/roles');
  expect(replace.request.method).toBe('PUT');replace.flush({});
  roles.replacePermissions('r1',['orders.create']).subscribe();
  const permissions=mock.expectOne('/api/roles/r1/permissions');
  expect(permissions.request.body).toEqual({permisos:['orders.create']});
  permissions.flush({});
 });
 it('includes reason with session revocations and account states',()=>{
  users.status('u1',false,'Fin de contrato').subscribe();
  const status=mock.expectOne('/api/users/u1/status');
  expect(status.request.body).toEqual({activo:false,motivo:'Fin de contrato'});
  status.flush({});
  users.revokeSessions('u1','Dispositivo perdido','s1').subscribe();
  const revoke=mock.expectOne('/api/users/u1/sessions/s1');
  expect(revoke.request.method).toBe('DELETE');
  expect(revoke.request.body).toEqual({motivo:'Dispositivo perdido'});
  revoke.flush({id:'u1',revoked:1});
 });
});
