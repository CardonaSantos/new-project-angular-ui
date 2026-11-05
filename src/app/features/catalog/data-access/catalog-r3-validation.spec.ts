import {quickGroupIssues,recipeDraftIssues} from './catalog-r3-validation';
import type {CatalogQuickGroupSetup} from './catalog.models';
import type {RecipeVersionInput} from '../../recipes/data-access/recipes.models';

const recipe=():RecipeVersionInput=>({
 rendimiento:'1',unidadRendimientoId:'und',
 componentes:[
  {articuloId:'cafe',unidadId:'g',cantidad:'18.000',mermaPorcentaje:'0'},
  {articuloId:'leche',unidadId:'ml',cantidad:'180.000',mermaPorcentaje:'2'}
 ]
});
const group=():CatalogQuickGroupSetup=>({
 nombre:'Toppings',minimo:0,maximo:1,
 opciones:[{nombre:'Crema',incrementoPrecio:'3.00',ingredientes:[
  {articuloId:'crema',unidadId:'g',cantidad:'20.000',efecto:'SUMAR'}
 ]}]
});
describe('CAT R3 — stock-affecting inputs are explicit and never silently coerced',()=>{
 it('accepts known recipe ingredients with quantities and yield for server conversion',()=>{
  expect(recipeDraftIssues(recipe())).toEqual([]);
  expect(recipeDraftIssues({...recipe(),rendimiento:'0'}).some(x=>x.includes('rendimiento'))).toBe(true);
 });
 it('rejects incompatible or missing physical input before publishing',()=>{
  const r=recipe();r.componentes[0].unidadId='';r.componentes[0].cantidad='0';
  expect(recipeDraftIssues(r).length).toBeGreaterThanOrEqual(2);
  const d=recipe();d.componentes[1].articuloId='cafe';
  expect(recipeDraftIssues(d).some(x=>x.includes('más de una vez'))).toBe(true);
 });
 it('validates losses independently of physical quantities',()=>{
  const r=recipe();r.componentes[0].mermaPorcentaje='101';
  expect(recipeDraftIssues(r).some(x=>x.includes('merma'))).toBe(true);
  r.componentes[0].mermaPorcentaje='0';
  expect(recipeDraftIssues(r)).toEqual([]);
 });
 it('creates an add-on with real physical consumption, not only a price',()=>{
  expect(quickGroupIssues(group(),[true])).toEqual([]);
  expect(quickGroupIssues({...group(),opciones:[{
   nombre:'Crema',incrementoPrecio:'3.00',ingredientes:[]
  }]},[true]).some(x=>x.includes('ingrediente físico'))).toBe(true);
 });
 it('rejects duplicated choices, missing ingredient units and unsafe effects',()=>{
  const item=group();
  item.opciones[0].ingredientes[0].efecto='RESTAR' as 'SUMAR';
  expect(quickGroupIssues(item,[true]).some(x=>x.includes('avanzada'))).toBe(true);
  item.opciones[0].ingredientes[0].efecto='SUMAR';
  item.opciones[0].ingredientes[0].unidadId='';
  expect(quickGroupIssues(item,[true]).some(x=>x.includes('unidad'))).toBe(true);
  const another=group();another.maximo=2;
  another.opciones.push({...another.opciones[0]});
  expect(quickGroupIssues(another,[true,true]).some(x=>x.includes('nombre diferente'))).toBe(true);
 });
});
