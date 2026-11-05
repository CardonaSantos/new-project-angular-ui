import {guidedProductDto,suggestedProductCode,validateGuidedProduct,validPrice,
 type GuidedProductDraft} from './catalog-product-guide';

const draft=():GuidedProductDraft=>({
 nombre:'Capuchino clásico',codigo:'CAPUCHINO-CLASICO',tipo:'PREPARADO',
 categoriaId:'',descripcion:'',
 variantes:[
  {key:1,nombre:'Mediano',precio:'24.00',articuloInventarioId:''},
  {key:2,nombre:'Grande',precio:'30.00',articuloInventarioId:''}
 ]
});

describe('CAT R1 guided product creation',()=>{
 it('suggests editable codes from human names',()=>{
  expect(suggestedProductCode('Café de olla')).toBe('CAFE-DE-OLLA');
  expect(suggestedProductCode('600 ml agua')).toBe('P-600-ML-AGUA');
  expect(suggestedProductCode('')).toBe('');
 });
 it('creates a product and its multiple variants in one existing server DTO',()=>{
  const result=guidedProductDto(draft());
  expect(result.variantes?.map(x=>x.nombre)).toEqual(['Mediano','Grande']);
  expect(result.variantes?.map(x=>x.orden)).toEqual([0,1]);
  expect(result.variantes?.[0].articuloInventarioId).toBeUndefined();
 });
 it('requires physical inventory articles only for direct inventory products',()=>{
  const d=draft();d.tipo='INVENTARIABLE';
  expect(validateGuidedProduct(d).filter(x=>x.includes('artículo físico'))).toHaveLength(2);
  d.variantes[0].articuloInventarioId='physical1';
  d.variantes[1].articuloInventarioId='physical1';
  expect(validateGuidedProduct(d)).toEqual([]);
  expect(guidedProductDto(d).variantes?.[0].articuloInventarioId).toBe('physical1');
  d.tipo='SERVICIO';
  expect(guidedProductDto(d).variantes?.[0].articuloInventarioId).toBeUndefined();
 });
 it('does not silently coerce price decimals or permit duplicate sizes',()=>{
  const d=draft();d.variantes[1].nombre=' mediano ';d.variantes[1].precio='30,00';
  const errors=validateGuidedProduct(d);
  expect(errors.some(x=>x.includes('repetido'))).toBe(true);
  expect(errors.some(x=>x.includes('precio'))).toBe(true);
  expect(validPrice('0.00')).toBe(true);
  expect(validPrice('24.50')).toBe(true);
  expect(validPrice('24.500')).toBe(false);
 });
 it('allows a draft with no prices, but never without a presentation',()=>{
  const d=draft();d.variantes.forEach(x=>x.precio='');
  expect(validateGuidedProduct(d)).toEqual([]);
  d.variantes=[];
  expect(validateGuidedProduct(d).some(x=>x.includes('presentaciones'))).toBe(true);
 });
});
