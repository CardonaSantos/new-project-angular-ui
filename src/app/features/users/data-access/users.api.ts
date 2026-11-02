
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/http/api-endpoints';
import { gcSilentRequest } from '../../../core/http/api-context';
import type {
  Assignment, Audit, CredentialsIssued, MediaAccess, MediaRecord, ActivityItem, StaffOverview, StaffReportRow,
  MyProfileUpdate, Options, Page, PasswordReset, PermissionGroup,
  Role, RoleCreate, RoleUpdate, Session, UserCreate, UserOption, UserRecord, UserUpdate,
} from './users.models';

type Param = string|number|boolean|null|undefined;
function query(p:Record<string,Param>):HttpParams {
  let out=new HttpParams();
  for(const [k,v] of Object.entries(p))if(v!==undefined&&v!==null&&v!=='')out=out.set(k,String(v));
  return out;
}
const silent={context:gcSilentRequest()};
@Injectable({providedIn:'root'})
export class UsersApi {
  private readonly http=inject(HttpClient);
  private readonly e=API_ENDPOINTS.users;
  me(){return this.http.get<UserRecord>(this.e.profile)}
  updateMe(dto:MyProfileUpdate){return this.http.patch<UserRecord>(this.e.profile,dto,silent)}
  avatarMe(mediaId:string|null){return this.http.put<UserRecord>(this.e.avatar,{mediaId},silent)}
  list(p:{page?:number;limit?:number;search?:string;activo?:boolean;rolId?:string;sucursalId?:string}={}){
    return this.http.get<Page<UserRecord>>(this.e.list,{params:query(p)});
  }
  options(p:{search?:string;sucursalId?:string;purpose?:string;cursor?:string;limit?:number}={}){
    return this.http.get<Options<UserOption>>(this.e.options,{params:query(p)});
  }
  detail(id:string,sucursalId?:string){return this.http.get<UserRecord>(this.e.detail(id),{params:query({sucursalId})})}
  create(dto:UserCreate){return this.http.post<CredentialsIssued>(this.e.list,dto,silent)}
  update(id:string,dto:UserUpdate){return this.http.patch<UserRecord>(this.e.detail(id),dto,silent)}
  status(id:string,activo:boolean,motivo:string){
    return this.http.patch<{id:string;activo:boolean}>(this.e.status(id),{activo,motivo},silent);
  }
  avatar(id:string,mediaId:string|null){return this.http.put<UserRecord>(this.e.userAvatar(id),{mediaId},silent)}
  assignments(id:string,sucursalId?:string){
    return this.http.get<{data:Assignment[]}>(this.e.assignments(id),{params:query({sucursalId})});
  }
  replaceAssignments(id:string,assignments:{rolId:string;sucursalId:string|null}[]){
    return this.http.put<UserRecord>(this.e.assignments(id),{assignments},silent);
  }
  addAssignment(id:string,rolId:string,sucursalId:string|null){
    return this.http.post<UserRecord>(this.e.assignments(id),{rolId,sucursalId},silent);
  }
  sessions(id:string,page=1,limit=10){
    return this.http.get<Page<Session>>(this.e.sessions(id),{params:query({page,limit})});
  }
  revokeSessions(id:string,motivo:string,sessionId?:string){
    return this.http.delete<{id:string;revoked:number}>(sessionId
      ?this.e.session(id,sessionId):this.e.sessions(id),{body:{motivo},context:gcSilentRequest()});
  }
  resetPassword(id:string,motivo:string){
    return this.http.post<PasswordReset>(this.e.reset(id),{motivo},silent);
  }
  audit(id:string,p:{page?:number;limit?:number;sucursalId?:string}={}){
    return this.http.get<Page<Audit>>(this.e.audit(id),{params:query(p)});
  }
  overview(id:string,p:{from?:string;to?:string;sucursalId?:string}={}){
    return this.http.get<StaffOverview>(this.e.overview(id),{params:query(p)});
  }
  activity(id:string,p:{from?:string;to?:string;sucursalId?:string;kind?:string;page?:number;limit?:number}={}){
    return this.http.get<Page<ActivityItem>>(this.e.activity(id),{params:query(p)});
  }
  report(p:{from?:string;to?:string;sucursalId?:string;page?:number;limit?:number}={}){
    return this.http.get<Page<StaffReportRow>>(this.e.reports,{params:query(p)});
  }
}
@Injectable({providedIn:'root'})
export class RolesApi {
  private readonly http=inject(HttpClient);
  private readonly e=API_ENDPOINTS.users;
  list(p:{search?:string;activo?:boolean;page?:number;limit?:number}={}){
    return this.http.get<Page<Role>>(this.e.roles,{params:query(p)});
  }
  options(p:{search?:string;page?:number;limit?:number}={}){
    return this.http.get<Page<{id:string;label:string;codigo:string;alcance:'GLOBAL'|'SUCURSAL'}>>(
      this.e.roleOptions,{params:query(p)});
  }
  get(id:string){return this.http.get<Role>(this.e.role(id))}
  create(dto:RoleCreate){return this.http.post<Role>(this.e.roles,dto,silent)}
  update(id:string,dto:RoleUpdate){return this.http.patch<Role>(this.e.role(id),dto,silent)}
  replacePermissions(id:string,permisos:string[]){
    return this.http.put<Role>(this.e.rolePermissions(id),{permisos},silent);
  }
  permissions(){return this.http.get<{data:PermissionGroup[]}>(this.e.permissions)}
}
@Injectable({providedIn:'root'})
export class MediaApi {
  private readonly http=inject(HttpClient);
  private readonly e=API_ENDPOINTS.media;
  /** FormData is essential: the server expects Multer's file field, not JSON. */
  upload(file:File,contexto='PERFIL',sucursalId?:string) {
    const body=new FormData();
    body.append('file',file,file.name);
    body.append('contexto',contexto);
    body.append('publico','false');
    if(sucursalId)body.append('sucursalId',sucursalId);
    return this.http.post<MediaRecord>(this.e.upload,body,silent);
  }
  access(id:string){return this.http.get<MediaAccess>(this.e.access(id))}
  detail(id:string){return this.http.get<MediaRecord>(this.e.detail(id))}
}
