import type {CatalogKind,CatalogProductCreate} from './catalog.models';

export interface GuidedVariant {
 key:number;nombre:string;precio:string;articuloInventarioId:string;
}
export interface GuidedProductDraft {
 nombre:string;codigo:string;tipo:CatalogKind;categoriaId:string;
 descripcion:string;variantes:GuidedVariant[];
}
export function suggestedProductCode(name:string):string {
 const slug=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()
  .replace(/[^A-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,46).replace(/-+$/g,'');
 return slug?(/^[A-Z]/.test(slug)?slug:'P-'+slug).slice(0,50):'';
}
export function validPrice(value:string):boolean {
 return /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(value.trim());
}
export function validateGuidedProduct(input:GuidedProductDraft):string[]{
 const errors:string[]=[];
 if(!input.nombre.trim())errors.push('Escribe el nombre comercial.');
 if(!/^[A-Za-z][A-Za-z0-9_-]{0,49}$/.test(input.codigo.trim()))
  errors.push('El código debe comenzar con una letra y usar letras, números o guiones.');
 if(input.variantes.length<1||input.variantes.length>50)
  errors.push('Agrega de 1 a 50 presentaciones.');
 const used=new Set<string>();
 for(const [index,variant] of input.variantes.entries()){
  const at='Presentación '+(index+1);
  const name=variant.nombre.trim().toLocaleLowerCase('es');
  if(!name||name.length>120)errors.push(at+': nombre obligatorio (hasta 120 caracteres).');
  if(name&&used.has(name))errors.push(at+': el nombre está repetido.');
  used.add(name);
  if(input.tipo==='INVENTARIABLE'&&!variant.articuloInventarioId)
   errors.push(at+': selecciona el artículo físico del inventario.');
  if(variant.precio.trim()&&!validPrice(variant.precio))
   errors.push(at+': usa un precio como 24.50.');
 }
 return errors;
}
export function guidedProductDto(input:GuidedProductDraft):CatalogProductCreate {
 return {
  codigo:input.codigo.trim().toUpperCase(),nombre:input.nombre.trim(),tipo:input.tipo,
  descripcion:input.descripcion.trim()||null,categoriaId:input.categoriaId||null,
  variantes:input.variantes.map((v,orden)=>({
   nombre:v.nombre.trim(),orden,
   ...(input.tipo==='INVENTARIABLE'?{articuloInventarioId:v.articuloInventarioId}:{}),
  }))
 };
}
