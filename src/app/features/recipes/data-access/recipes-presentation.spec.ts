import {normalizeFormula,recipeDestination,recipePublished,readableQuantity,validateFormula} from './recipes-presentation';
import type {RecipeRecord,RecipeVersionInput} from './recipes.models';
const valid:RecipeVersionInput={rendimiento:'1.0',unidadRendimientoId:'u1',
 componentes:[{articuloId:'a1',unidadId:'u2',cantidad:'150.000000',mermaPorcentaje:'0.0'}]};
describe('REC-A safe form transformations',()=>{
 it('keeps exact decimal strings without using floating point rounding',()=>{
  expect(normalizeFormula(valid)).toEqual({
   rendimiento:'1',unidadRendimientoId:'u1',componentes:[
    {articuloId:'a1',unidadId:'u2',cantidad:'150',mermaPorcentaje:'0'}
   ]
  });
  expect(readableQuantity('150.000000','mL')).toBe('150 mL');
 });
 it('checks self-consumption, duplicate ingredients and empty formula',()=>{
  expect(validateFormula(valid)).toEqual([]);
  expect(validateFormula(valid,'a1')).toContain('La preparación no puede utilizarse a sí misma como ingrediente.');
  expect(validateFormula({...valid,componentes:[]}).length).toBeGreaterThan(0);
  expect(validateFormula({...valid,componentes:[...valid.componentes,...valid.componentes]}))
   .toContain('Un ingrediente aparece más de una vez.');
 });
 it('rejects invalid decimal strings and unreasonable losses',()=>{
  expect(validateFormula({...valid,rendimiento:'0'}).length).toBeGreaterThan(0);
  expect(validateFormula({...valid,componentes:[{...valid.componentes[0],cantidad:'1,25',mermaPorcentaje:'150'}]}).length)
   .toBeGreaterThan(0);
 });
 it('labels product targets and published versions without exposing internal IDs',()=>{
  const recipe={tipo:'VENTA',variante:{nombre:'Mediano',producto:{nombre:'Café'}},
   recetaVersionesComoReceta:[{id:'v1',activa:true,publicadaEn:'2026-11-02'}]} as RecipeRecord;
  expect(recipeDestination(recipe)).toBe('Café · Mediano');
  expect(recipePublished(recipe)?.id).toBe('v1');
 });
});
