
export interface CustomerPage<T>{data:T[];meta:{page:number;limit:number;total:number;totalPages:number}}

export interface Customer{
 id:string;nombre:string;telefono:string|null;email:string|null;nit:string|null;
 activo:boolean;creadoEn:string;
}
export interface CustomerDetail{
 id:string;nombre:string;nit:string|null;telefono:string|null;email:string|null;
 notas:string|null;activo:boolean;creadoEn:string;
}
export interface CustomerOption{id:string;nombre:string}
export interface CustomerOptionsPage{data:CustomerOption[];nextCursor:string|null}

export interface CustomerAddress{
 id:string;clienteId:string;alias:string|null;direccion:string;referencia:string|null;
 latitud:string|null;longitud:string|null;principal:boolean;activa:boolean;
}
