
import {HttpClient,HttpParams} from '@angular/common/http';
import {inject,Injectable} from '@angular/core';
import {gcSilentRequest} from '../../../core/http/api-context';
import type {CustomerPage,Customer,CustomerDetail,CustomerOptionsPage,CustomerAddress} from './customers.models';

const safe=(id:string)=>encodeURIComponent(id);
export const customerPaths={
 base:'/api/customers',options:'/api/customers/options',
 one:(id:string)=>'/api/customers/'+safe(id),
 deactivate:(id:string)=>'/api/customers/'+safe(id)+'/deactivate',
 addresses:(id:string)=>'/api/customers/'+safe(id)+'/addresses',
 address:(id:string,addressId:string)=>'/api/customers/'+safe(id)+'/addresses/'+safe(addressId),
 addressPrimary:(id:string,addressId:string)=>'/api/customers/'+safe(id)+'/addresses/'+safe(addressId)+'/primary',
 addressDeactivate:(id:string,addressId:string)=>'/api/customers/'+safe(id)+'/addresses/'+safe(addressId)+'/deactivate',
} as const;
const readOptions={context:gcSilentRequest()};
const query=(filters:Record<string,string|number|boolean|undefined>)=>{
 let params=new HttpParams();
 for(const [key,value] of Object.entries(filters))
  if(value!==undefined&&value!=='')params=params.set(key,String(value));
 return {params,...readOptions};
};

@Injectable({providedIn:'root'})
export class CustomersApi{
 private readonly http=inject(HttpClient);
 list(q:{sucursalId:string;page?:number;limit?:number;search?:string;activo?:boolean}){
  return this.http.get<CustomerPage<Customer>>(customerPaths.base,query(q));
 }
 options(q:{sucursalId:string;search?:string;cursor?:string;limit?:number}){
  return this.http.get<CustomerOptionsPage>(customerPaths.options,query(q));
 }
 detail(id:string,sucursalId:string){
  return this.http.get<CustomerDetail>(customerPaths.one(id),query({sucursalId}));
 }
 create(body:{sucursalId:string;claveOperacion:string;nombre:string;nit?:string|null;
  telefono?:string|null;email?:string|null;notas?:string|null}){
  return this.http.post<CustomerDetail>(customerPaths.base,body);
 }
 update(id:string,body:{sucursalId:string;claveOperacion:string;nombre?:string;nit?:string|null;
  telefono?:string|null;email?:string|null;notas?:string|null}){
  return this.http.patch<CustomerDetail>(customerPaths.one(id),body);
 }
 deactivate(id:string,body:{sucursalId:string;claveOperacion:string;motivo:string}){
  return this.http.post<{id:string;activo:boolean}>(customerPaths.deactivate(id),body);
 }
 addresses(id:string,sucursalId:string){
  return this.http.get<{data:CustomerAddress[]}>(customerPaths.addresses(id),query({sucursalId}));
 }
 addAddress(id:string,body:{sucursalId:string;claveOperacion:string;alias?:string|null;
  direccion:string;referencia?:string|null;latitud?:string|null;longitud?:string|null;principal?:boolean}){
  return this.http.post<CustomerAddress>(customerPaths.addresses(id),body);
 }
 updateAddress(id:string,addressId:string,body:{sucursalId:string;claveOperacion:string;
  alias?:string|null;direccion?:string;referencia?:string|null;latitud?:string|null;longitud?:string|null}){
  return this.http.patch<CustomerAddress>(customerPaths.address(id,addressId),body);
 }
 setPrimaryAddress(id:string,addressId:string,body:{sucursalId:string;claveOperacion:string}){
  return this.http.post<{id:string}>(customerPaths.addressPrimary(id,addressId),body);
 }
 deactivateAddress(id:string,addressId:string,body:{sucursalId:string;claveOperacion:string}){
  return this.http.post<{id:string;activa:boolean}>(customerPaths.addressDeactivate(id,addressId),body);
 }
}
