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
/** Many validation failures are 409. Only stale versions require reloading a draft. */
export function isMenuVersionConflict(error:unknown):boolean {
 if(!isMenuConflict(error)||!error||typeof error!=='object'||!('message' in error))return false;
 const message=error.message;
 return typeof message==='string'&&/versi[oó]n|modificad[oa] por otra sesi[oó]n/i.test(message);
}
export function menuStatus(menu:CatalogMenu):string{
 if(!menu.activo)return 'Inactivo';
 return menu.publicadoEn?'Publicado':'Borrador';
}

/** A single bulk action adds selected variants, never duplicates items in a section. */
export function addMenuItems(draft:MenuDraft,key:string,
 items:{varianteId:string;nombre:string}[]):MenuDraft{
 return {...draft,sections:draft.sections.map(section=>{
  if(section.key!==key)return section;
  const seen=new Set(section.items.map(x=>x.varianteId));
  const added=items.filter(x=>{
   if(!x.varianteId||seen.has(x.varianteId))return false;
   seen.add(x.varianteId);return true;
  }).slice(0,Math.max(0,100-section.items.length));
  return {...section,items:[...section.items,...added.map((x,i)=>({
   ...x,orden:section.items.length+i
  }))]};
 })};
}
export function moveMenuItemToSection(draft:MenuDraft,fromKey:string,toKey:string,
 varianteId:string):MenuDraft{
 if(fromKey===toKey||!draft.sections.some(s=>s.key===toKey))return draft;
 const from=draft.sections.find(s=>s.key===fromKey);
 const to=draft.sections.find(s=>s.key===toKey);
 const item=from?.items.find(x=>x.varianteId===varianteId);
 if(!item||!to||to.items.some(x=>x.varianteId===varianteId)||to.items.length>=100)return draft;
 return {...draft,sections:draft.sections.map(s=>{
  if(s.key===fromKey)return {...s,items:s.items.filter(x=>x.varianteId!==varianteId)};
  if(s.key===toKey)return {...s,items:[...to.items,{...item,orden:to.items.length}]};
  return s;
 })};
}
export const MENU_READINESS_LABELS:Record<string,string>={
 SIN_PRECIO:'Registrar el precio de venta en esta sucursal',
 SIN_RECETA_PUBLICADA:'Publicar la receta de esta presentación',
 SIN_RUTA_O_UBICACION_COCINA:'Configurar la estación y ubicación de consumo en Cocina',
 SIN_FOTOGRAFIA_CONFIRMADA:'Agregar y confirmar una fotografía',
 OCULTA_EN_MENU:'Activar «Mostrar en menú comercial»',
 PRODUCTO_O_VARIANTE_INACTIVA:'Activar el producto y su presentación',
 ARTICULO_FISICO_INVALIDO:'Vincular un artículo terminado y activo de Inventario',
 ARTICULO_UNIDAD_INCOMPATIBLE:'Revisar la unidad base del artículo terminado',
 PAUSADA_EN_SUCURSAL:'Habilitar la presentación para esta sucursal',
 SUCURSAL_INACTIVA:'Seleccionar una sucursal activa',
 EXTRA_SIN_COMPOSICION_FISICA:'Completar los ingredientes físicos del extra',
 EXTRA_FISICO_REQUIERE_PREPARADO:'Revisar el extra físico en un producto de venta directa',
 MENU_INACTIVO:'Activar el menú comercial',
 SIN_SECCIONES:'Crear al menos una sección',
 SECCION_VACIA:'Agregar productos a esta sección',
 SIN_PRODUCTOS:'Seleccionar productos para la carta',
 SIN_SUCURSAL:'Seleccionar una sucursal activa',
 VARIANTE_NO_EXISTE:'Quitar la presentación inexistente de la carta'
};
export function readableMenuIssue(code:string):string{
 return MENU_READINESS_LABELS[code]??code.replaceAll('_',' ').toLowerCase();
}
