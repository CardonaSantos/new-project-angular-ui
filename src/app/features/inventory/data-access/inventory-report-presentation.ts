import {ARTICLE_KINDS} from './inventory.models';
import {formatDecimal} from '../../../shared/formatting';

export interface InventoryReportMetric {label:string;value:string}
export interface InventoryReportGroup {title:string;metrics:InventoryReportMetric[]}

function object(value:unknown):Record<string,unknown>{
 return value!==null&&typeof value==='object'&&!Array.isArray(value)
  ?value as Record<string,unknown>:{};
}
function count(value:unknown):string{
 return typeof value==='number'&&Number.isFinite(value)?formatDecimal(String(value),{maximumFractionDigits:0}):'0';
}
/** Report masters has nested records; it is not a flat array of rows. */
export function inventoryMasterGroups(data:Record<string,unknown>):InventoryReportGroup[]{
 const articles=object(data['articulos']), units=object(data['unidades']),
  warehouses=object(data['almacenes']), locations=object(data['ubicaciones']);
 return [
  {title:'Artículos · catálogo global',metrics:[
   {label:'Registrados',value:count(articles['total'])},
   {label:'Activos',value:count(articles['activos'])},
   {label:'Inactivos',value:count(articles['inactivos'])},
   {label:'Con fotografías',value:count(articles['conFotografia'])}
  ]},
  {title:'Unidades de medida',metrics:[
   {label:'Unidades',value:count(units['total'])},
   {label:'Conversiones',value:count(units['conversiones'])}
  ]},
  {title:'Almacenes de la consulta',metrics:[
   {label:'Registrados',value:count(warehouses['total'])},
   {label:'Activos',value:count(warehouses['activos'])}
  ]},
  {title:'Ubicaciones de la consulta',metrics:[
   {label:'Registradas',value:count(locations['total'])},
   {label:'Activas',value:count(locations['activas'])},
   {label:'Recepciones activas',value:count(locations['recepcionActivas'])}
  ]}
 ];
}
export function inventoryTypes(data:Record<string,unknown>):InventoryReportMetric[]{
 return Array.isArray(object(data['articulos'])['porTipo'])
  ?(object(data['articulos'])['porTipo'] as unknown[]).flatMap(value=>{
   const obj=object(value);
   if(typeof obj['tipo']!=='string')return [];
   return [{label:ARTICLE_KINDS.find(kind=>kind.value===obj['tipo'])?.label??obj['tipo'],
    value:count(obj['total'])}];
  }):[];
}

export interface InventoryReconciliationDifference {
 key:string;article:string;location:string;lot:string;
 expected:string;actual:string;
}
function name(value:unknown):string{
 const obj=object(value);
 return typeof obj['nombre']==='string'&&obj['nombre']?obj['nombre']:'No identificado';
}
function amount(value:unknown):string{
 if(typeof value!=='string'&&typeof value!=='number')return '—';
 try{return formatDecimal(String(value))}catch{return String(value)}
}
export function inventoryReconciliationRows(
 data:Record<string,unknown>,kind:'diferenciasKardex'|'diferenciasCapas'
):InventoryReconciliationDifference[]{
 const value=data[kind];
 if(!Array.isArray(value))return [];
 return value.map((entry:unknown,index:number)=>{
  const item=object(entry),lot=object(item['lote']);
  return {key:String(index+1),article:name(item['articulo']),location:name(item['ubicacion']),
   lot:typeof lot['codigoLote']==='string'?lot['codigoLote']:'—',
   expected:amount(item['cantidad']),actual:amount(kind==='diferenciasKardex'?item['kardex']:item['capas'])};
 });
}
