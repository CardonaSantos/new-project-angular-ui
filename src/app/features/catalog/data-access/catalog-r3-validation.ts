import type {RecipeVersionInput} from '../../recipes/data-access/recipes.models';
import type {CatalogQuickGroupSetup} from './catalog.models';
import {validPrice} from './catalog-product-guide';

export const validIngredientAmount=(value:string)=>/^(?!0(?:\.0{1,6})?$)(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/.test(value.trim());
const validMerma=(value:string)=>/^(?:0|[1-9]\d{0,2})(?:\.\d{1,4})?$/.test(value.trim())&&Number(value)<=100;

/** Validate the precise physical recipe data; the server still validates dimensions/conversions. */
export function recipeDraftIssues(dto:RecipeVersionInput):string[]{
 const issues:string[]=[];
 if(!dto.unidadRendimientoId)issues.push('Selecciona la unidad de rendimiento.');
 if(!validIngredientAmount(dto.rendimiento))issues.push('El rendimiento requiere un número positivo con máximo seis decimales.');
 if(!dto.componentes.length)issues.push('Agrega al menos un ingrediente.');
 const used=new Set<string>();
 dto.componentes.forEach((part,i)=>{
  if(!part.articuloId||!part.unidadId)
   issues.push('Ingrediente '+(i+1)+': selecciona artículo y unidad.');
  if(!validIngredientAmount(part.cantidad))
   issues.push('Ingrediente '+(i+1)+': cantidad positiva requerida.');
  if(!validMerma(part.mermaPorcentaje??'0'))
   issues.push('Ingrediente '+(i+1)+': la merma debe estar entre 0 y 100 %.');
  if(part.articuloId&&used.has(part.articuloId))
   issues.push('El mismo artículo aparece más de una vez. Agrupa su cantidad.');
  used.add(part.articuloId);
 });
 return issues;
}

export function quickGroupIssues(dto:CatalogQuickGroupSetup,consuming:boolean[]):string[]{
 const errors:string[]=[];
 if(!dto.nombre.trim())errors.push('Escribe el nombre del grupo.');
 if(!dto.opciones.length||dto.opciones.length>30)errors.push('Agrega de 1 a 30 opciones.');
 if(!Number.isInteger(dto.minimo)||dto.minimo<0||dto.minimo>dto.opciones.length)
  errors.push('La cantidad mínima es inválida.');
 if(dto.maximo!==null&&(!Number.isInteger(dto.maximo)||dto.maximo<dto.minimo||
  dto.maximo>dto.opciones.length))
  errors.push('El máximo no puede superar las opciones disponibles.');
 const names=new Set<string>();
 dto.opciones.forEach((opt,i)=>{
  const name=opt.nombre.trim().toLocaleLowerCase('es');
  if(!name||names.has(name))errors.push('La opción '+(i+1)+' necesita un nombre diferente.');
  names.add(name);
  if(!validPrice(opt.incrementoPrecio))errors.push('Recargo inválido en opción '+(i+1)+'.');
  if(consuming[i]&&!opt.ingredientes.length)
   errors.push('Opción '+(i+1)+': agrega al menos un ingrediente físico.');
  const ids=new Set<string>();
  opt.ingredientes.forEach(part=>{
   if(!part.articuloId||!part.unidadId||!validIngredientAmount(part.cantidad))
    errors.push('Opción '+(i+1)+': revisa artículo, unidad y cantidad.');
   if(part.efecto!=='SUMAR')errors.push('Retirar o sustituir ingredientes necesita edición avanzada.');
   if(part.articuloId&&ids.has(part.articuloId))
    errors.push('Opción '+(i+1)+': ingrediente repetido.');
   ids.add(part.articuloId);
  });
 });
 return errors;
}
