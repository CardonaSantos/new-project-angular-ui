import {formatDecimal,toApiDecimal,parseApiDecimal} from '../../../shared/formatting';
import type {RecipeRecord,RecipeComponentInput,RecipeVersionInput} from './recipes.models';
export function recipeKind(kind:string){return kind==='VENTA'?'Producto de la carta':'Preparación de inventario'}
export function recipeDestination(row:RecipeRecord):string {
 if(row.tipo==='VENTA')return [row.variante?.producto?.nombre,row.variante?.nombre].filter(Boolean).join(' · ')||'Sin presentación';
 return row.articuloResultado?.nombre??'Sin artículo de resultado';
}
export function recipePublished(row:RecipeRecord){
 return row.recetaVersionesComoReceta?.find(v=>v.activa&&!!v.publicadaEn)??row.versionPublicada??null;
}
export function readableQuantity(n:string|null|undefined,unit?:string){
 try{return n==null?'—':formatDecimal(n)+' '+(unit??'').trim()}catch{return '—'}
}
export function validateFormula(dto:RecipeVersionInput,outputArticleId?:string|null):string[] {
 const errors:string[]=[];
 const valid=(v:string)=>{try{return parseApiDecimal(v).gt(0)}catch{return false}};
 if(!dto.unidadRendimientoId)errors.push('Selecciona la unidad de rendimiento.');
 if(!valid(dto.rendimiento))errors.push('Introduce una cantidad de rendimiento mayor que cero.');
 if(!dto.componentes.length)errors.push('Agrega al menos un ingrediente.');
 if(dto.componentes.length>100)errors.push('La receta admite como máximo 100 ingredientes.');
 const ids=new Set<string>();
 for(const item of dto.componentes){
  if(!item.articuloId||!item.unidadId||!valid(item.cantidad))
   errors.push('Revisa el artículo, la unidad y la cantidad de cada ingrediente.');
  if(ids.has(item.articuloId)&&item.articuloId)errors.push('Un ingrediente aparece más de una vez.');
  if(item.articuloId)ids.add(item.articuloId);
  if(item.articuloId&&item.articuloId===outputArticleId)errors.push('La preparación no puede utilizarse a sí misma como ingrediente.');
  try{const n=parseApiDecimal(item.mermaPorcentaje??'0');if(n.lt(0)||n.gt(100))errors.push('La pérdida estimada debe estar entre 0 y 100 %.')}
  catch{errors.push('La pérdida estimada no es válida.')}
 }
 return [...new Set(errors)];
}
export function normalizeFormula(v:RecipeVersionInput):RecipeVersionInput{
 return {unidadRendimientoId:v.unidadRendimientoId,rendimiento:toApiDecimal(v.rendimiento),
  ...(v.vidaUtilDias!==undefined?{vidaUtilDias:v.vidaUtilDias}:{}),
  componentes:v.componentes.map((x:RecipeComponentInput)=>({
   articuloId:x.articuloId,unidadId:x.unidadId,cantidad:toApiDecimal(x.cantidad),
   mermaPorcentaje:toApiDecimal(x.mermaPorcentaje??'0')
  })),
  ...(v.publicar!==undefined?{publicar:v.publicar}:{})};
}
