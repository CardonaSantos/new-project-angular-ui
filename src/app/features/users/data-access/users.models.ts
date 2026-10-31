
export type Scope = 'GLOBAL'|'SUCURSAL';
export interface Paging { page:number;limit:number;total:number;totalPages:number }
export interface Page<T> { data:T[];meta:Paging }
export interface UserProfile {
  nombre:string; apellidos:string|null;nombreCompleto:string;email:string;
  telefono:string|null;idioma:string;zonaHoraria:string;
  avatar:{mediaId:string|null;url:string|null};
}
export interface UserRecord {
  id:string;profile:UserProfile;
  account:{activo:boolean;debeCambiarContrasena:boolean;ultimoAccesoEn:string|null;creadoEn:string;actualizadoEn:string};
  access:{assignments:Assignment[];branches:{id:string;nombre:string}[]};
}
export interface Assignment {
  id?:string;rolId:string;rolCodigo?:string;rolNombre?:string;alcance?:Scope;
  sucursalId:string|null;sucursalNombre?:string|null;
}
export interface UserCreate {
  email:string;nombre:string;apellidos?:string;telefono?:string;temporalPassword?:string;
  assignments?:{rolId:string;sucursalId:string|null}[];
}
export interface UserUpdate {
  email?:string;nombre?:string;apellidos?:string|null;telefono?:string|null;
  idioma?:string;zonaHoraria?:string;
}
export type MyProfileUpdate=Pick<UserUpdate,'apellidos'|'telefono'|'idioma'|'zonaHoraria'>;
export interface CredentialsIssued {
  user:UserRecord;temporaryPassword:string;requiresPasswordChange:boolean;
}
export interface PasswordReset {
  id:string;temporaryPassword:string;requiresPasswordChange:boolean;sessionsRevoked:boolean;
}
export interface Role {
  id:string;codigo:string;nombre:string;descripcion:string|null;alcance:Scope;
  activo:boolean;version:number;usuariosAsignados:number;permisos:string[];
}
export interface Permission {
  codigo:string;nombre?:string;descripcion?:string;modulo?:string;
}
export interface PermissionGroup {module:string;permissions:Permission[]}
export interface RoleCreate {codigo:string;nombre:string;descripcion?:string;alcance:Scope}
export interface RoleUpdate {nombre?:string;descripcion?:string|null;activo?:boolean}
export interface Session {
  id:string;dispositivoId:string|null;dispositivoNombre:string|null;userAgent:string|null;
  ipCreacion:string|null;creadaEn:string;ultimoUsoEn:string|null;expiraEn:string;
  revocadaEn:string|null;revocacionMotivo:string|null;active:boolean;
}
export interface Audit {
  id:string;accion:string;entidad:string;motivo:string|null;antes:unknown;despues:unknown;
  creadoEn:string;actor:{id:string;nombre:string}|null;
}
export interface UserOption {id:string;label:string;email:string;avatarMediaId:string|null;
  avatarUrl?:string|null;activo:boolean;roles:{codigo:string;nombre:string}[];
  sucursal:{id:string;nombre:string}|null}
export interface Options<T> {data:T[];meta:{hasMore:boolean;nextCursor:string|null}}
export interface MediaRecord {id:string;contexto:string;mimeType:string;url:string|null;urlPublica?:string|null;tipo:string}
export interface MediaAccess {url:string;publico:boolean;expiresIn:number|null}
export interface Activity {id?:string;kind:string;createdAt?:string;[key:string]:unknown}
export interface ReportSummary { [key:string]:unknown }
export const ROLE_SCOPES:readonly {value:Scope;label:string}[]=[
  {value:'GLOBAL',label:'Global'}, {value:'SUCURSAL',label:'Por sucursal'}
];

export interface StaffOverview {
  desde:string;hasta:string;sucursalId:string|null;
  ordenes:{total:number;cerradas:number;importeOrdenes:string};
  cobros:{cantidad:number;importeCobrado:string};
  caja:{turnos:number;abiertos:number};
  delivery:{entregas:number;completadas:number};
  inventario:{movimientos:number};
}
export interface ActivityItem {id:string;kind:'ORDEN'|'PAGO'|'CAJA'|'ENTREGA'|'INVENTARIO';
  at:string;label:string;status:string|null;amount:string|null;sucursalId:string|null}
export interface StaffReportRow {usuarioId:string;nombre:string;ordenes:number;cobros:number;importeCobrado:string}
