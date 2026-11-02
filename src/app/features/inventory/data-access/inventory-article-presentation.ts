import {toApiDecimal} from '../../../shared/formatting';
import type {Article,ArticleUpdate} from './inventory.models';

export interface ArticleEditableValues {
 nombre:string;
 stockMinimo:string;
 costoReferencia:string;
 requiereLote:boolean;
 requiereVencimiento:boolean;
}

/** PATCH should contain only actual changes. Repeating false tracking flags
 * can be rejected by the server for articles with movement history. */
export function articleChanges(previous:Article,values:ArticleEditableValues,manageCosts:boolean):ArticleUpdate {
 const result:ArticleUpdate={};
 const name=values.nombre.trim();
 if(name!==previous.nombre)result.nombre=name;
 if(values.requiereLote!==previous.requiereLote)result.requiereLote=values.requiereLote;
 if(values.requiereVencimiento!==previous.requiereVencimiento)result.requiereVencimiento=values.requiereVencimiento;

 const currentMinimum=values.stockMinimo?toApiDecimal(values.stockMinimo):null;
 const previousMinimum=previous.stockMinimo?toApiDecimal(previous.stockMinimo):null;
 if(currentMinimum!==previousMinimum)result.stockMinimo=currentMinimum;

 if(manageCosts){
  const currentCost=values.costoReferencia?toApiDecimal(values.costoReferencia):null;
  const previousCost=previous.costoReferencia?toApiDecimal(previous.costoReferencia):null;
  if(currentCost!==previousCost)result.costoReferencia=currentCost;
 }
 return result;
}

const RELATIONS=[
 {key:'variantesActivas',label:'Productos de venta asociados'},
 {key:'recetasActivas',label:'Recetas de preparación asociadas'},
 {key:'componentesReceta',label:'Usos como ingrediente en recetas'},
 {key:'componentesModificador',label:'Usos en extras de productos'},
 {key:'sustituciones',label:'Usos como ingrediente sustituto'},
 {key:'reglasEmpaque',label:'Usos en reglas de empaque'},
 {key:'presentacionesCompraActivas',label:'Presentaciones de compra activas'},
] as const;

/** Show meaningful counts, not internal IDs, unknown keys or empty relationships. */
export function articleRelations(data:Record<string,unknown>):{key:string;label:string;count:number}[]{
 return RELATIONS.flatMap(({key,label})=>{
  const count=data[key];
  return typeof count==='number'&&Number.isSafeInteger(count)&&count>0?[{key,label,count}]:[];
 });
}
