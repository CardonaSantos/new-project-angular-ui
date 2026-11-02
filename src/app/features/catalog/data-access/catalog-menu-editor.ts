import type {CatalogMenu,CatalogMenuLayout,CatalogMenuSchedule} from './catalog.models';

export const WEEKDAYS=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'] as const;

export interface MenuDraftSection {
 key:string;nombre:string;items:{varianteId:string;nombre:string;orden:number}[];
}
export interface MenuDraft {
 sections:MenuDraftSection[];schedule:CatalogMenuSchedule[];branches:string[];
}
export interface MenuValidation {
 valid:boolean;errors:string[];
}
export function menuDraft(menu:CatalogMenu):MenuDraft {
 return {
  branches:menu.sucursales.filter(x=>x.activa).map(x=>x.sucursalId),
  schedule:menu.horarios.filter(x=>x.activo!==false).map(x=>({
   diaSemana:x.diaSemana,desde:x.desde,hasta:x.hasta
  })),
  sections:menu.secciones.filter(x=>x.activo!==false).map((section,index)=>({
   key:section.id??String(index),
   nombre:section.nombre,
   items:section.items.filter(x=>x.activo!==false).map(item=>({
    varianteId:item.varianteId,
    nombre:item.variante?.producto?.nombre
     ?item.variante.producto.nombre+' · '+(item.variante?.nombre??'')
     :item.variante?.nombre??'Variante comercial',
    orden:item.orden,
   }))
  }))
 };
}
export function menuLayout(draft:MenuDraft,expectedVersion:number):CatalogMenuLayout {
 return {
  expectedVersion,
  sucursalIds:[...draft.branches],
  secciones:draft.sections.map((section,orden)=>({
   nombre:section.nombre.trim(),orden,
   items:section.items.map((x,index)=>({varianteId:x.varianteId,orden:index}))
  })),
  horarios:draft.schedule.map(x=>({diaSemana:x.diaSemana,desde:x.desde,hasta:x.hasta}))
 };
}
export function menuValidation(draft:MenuDraft):MenuValidation {
 const errors:string[]=[];
 if(!draft.branches.length)errors.push('Selecciona al menos una sucursal activa.');
 if(draft.branches.length>100||new Set(draft.branches).size!==draft.branches.length)
  errors.push('La lista de sucursales contiene duplicados o excede el límite.');
 if(!draft.sections.length||draft.sections.length>30)errors.push('Crea entre 1 y 30 secciones.');
 const names=new Set<string>();let totalItems=0;
 for(const section of draft.sections){
  const name=section.nombre.trim();
  if(!name||name.length>140)errors.push('Cada sección necesita un nombre de hasta 140 caracteres.');
  if(name&&names.has(name.toLocaleLowerCase('es')))errors.push('Hay secciones con el mismo nombre.');
  names.add(name.toLocaleLowerCase('es'));
  if(section.items.length>100)errors.push('Una sección no puede superar 100 variantes.');
  if(new Set(section.items.map(x=>x.varianteId)).size!==section.items.length)
   errors.push('Una variante aparece repetida dentro de una sección.');
  totalItems+=section.items.length;
 }
 if(!totalItems)errors.push('Agrega una variante a una sección para poder publicar el menú.');
 if(draft.schedule.length>70)errors.push('La programación excede los 70 horarios permitidos.');
 for(const time of draft.schedule){
  if(!Number.isInteger(time.diaSemana)||time.diaSemana<0||time.diaSemana>6||
   !/^([01]\d|2[0-3]):[0-5]\d$/.test(time.desde)||
   !/^([01]\d|2[0-3]):[0-5]\d$/.test(time.hasta)||
   time.desde>=time.hasta)
   errors.push('Comprueba el día y las horas: el final debe ser posterior al inicio.');
 }
 return {valid:errors.length===0,errors:[...new Set(errors)]};
}
export function isMenuConflict(error:unknown):boolean {
 if(!error||typeof error!=='object')return false;
 return 'status' in error&&error.status===409;
}
export function menuStatus(menu:CatalogMenu):string{
 if(!menu.activo)return 'Inactivo';
 return menu.publicadoEn?'Publicado':'Borrador';
}
