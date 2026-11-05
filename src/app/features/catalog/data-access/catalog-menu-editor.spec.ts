import {menuDraft,menuLayout,menuValidation,isMenuConflict,isMenuVersionConflict,menuStatus,addMenuItems,moveMenuItemToSection,readableMenuIssue} from './catalog-menu-editor';
import type {CatalogMenu} from './catalog.models';

const example:CatalogMenu={
 id:'m1',codigo:'CAFE',nombre:'Menú cafetería',descripcion:null,activo:true,
 version:4,publicadoEn:'2026-11-02T16:00:00.000Z',
 sucursales:[{sucursalId:'b1',activa:true},{sucursalId:'b2',activa:false}],
 horarios:[{diaSemana:1,desde:'08:00',hasta:'18:00',activo:true}],
 secciones:[{id:'s1',nombre:'Bebidas',orden:0,items:[{
  varianteId:'v1',orden:0,activo:true,variante:{
   id:'v1',nombre:'Grande',sku:null,orden:0,activo:true,
   producto:{id:'p1',nombre:'Latte',codigo:'LATTE',tipo:'PREPARADO',activo:true,visibleEnMenu:true}
  }
 }]}]
};
describe('CAT-A menu editor contract',()=>{
 it('parses existing menu includes, preserving active branches, order and real labels',()=>{
  expect(menuDraft(example)).toEqual({
   branches:['b1'],schedule:[{diaSemana:1,desde:'08:00',hasta:'18:00'}],
   sections:[{key:'s1',nombre:'Bebidas',items:[{
    varianteId:'v1',nombre:'Latte · Grande',orden:0
   }]}]
  });
 });
 it('creates the version-guarded layout required by PUT /:id/layout',()=>{
  expect(menuLayout(menuDraft(example),4)).toEqual({
   expectedVersion:4,sucursalIds:['b1'],
   secciones:[{nombre:'Bebidas',orden:0,items:[{varianteId:'v1',orden:0}]}],
   horarios:[{diaSemana:1,desde:'08:00',hasta:'18:00'}]
  });
  expect(menuStatus(example)).toBe('Publicado');
  expect(menuStatus({...example,publicadoEn:null})).toBe('Borrador');
 });
 it('rejects missing branches, empty menus, duplicate sections and variants',()=>{
  const draft=menuDraft(example);
  expect(menuValidation({...draft,branches:[]})).toMatchObject({valid:false});
  expect(menuValidation({...draft,sections:[]})).toMatchObject({valid:false});
  expect(menuValidation({...draft,sections:[...draft.sections,{...draft.sections[0],key:'s2'}]}).valid)
   .toBe(false);
  expect(menuValidation({...draft,sections:[{...draft.sections[0],
   items:[...draft.sections[0].items,...draft.sections[0].items]}]}).valid).toBe(false);
 });
 it('rejects invalid time and accepts all-day (no schedule) configuration',()=>{
  const draft=menuDraft(example);
  expect(menuValidation({...draft,schedule:[{diaSemana:7,desde:'20:00',hasta:'08:00'}]}).valid).toBe(false);
  expect(menuValidation({...draft,schedule:[{diaSemana:1,desde:'18:00',hasta:'08:00'}]}).valid).toBe(false);
  expect(menuValidation({...draft,schedule:[]})).toEqual({valid:true,errors:[]});
 });
 it('identifies version conflicts without treating successful calls as conflicting',()=>{
  expect(isMenuConflict({status:409})).toBe(true);
  expect(isMenuConflict({status:400})).toBe(false);
  expect(isMenuConflict(new Error('network'))).toBe(false);
  expect(isMenuVersionConflict({status:409,message:'Menú incompleto: SIN_PRECIO'})).toBe(false);
  expect(isMenuVersionConflict({status:409,message:'Menú modificado por otra sesión'})).toBe(true);
  expect(isMenuVersionConflict({status:409,message:'La versión del menú cambió'})).toBe(true);
 });
});

describe('R3-C menu builder navigation and data integrity',()=>{
 it('adds multiple presentations once without overwriting existing items',()=>{
  const draft=menuDraft(example);
  const next=addMenuItems(draft,'s1',[
   {varianteId:'v1',nombre:'Latte · Grande'},
   {varianteId:'v2',nombre:'Latte · Pequeño'},
   {varianteId:'v2',nombre:'Latte · Pequeño'},
   {varianteId:'v3',nombre:'Flan · Única'}
  ]);
  expect(next.sections[0].items.map(x=>x.varianteId)).toEqual(['v1','v2','v3']);
  expect(menuLayout(next,4).secciones[0].items.map(x=>x.orden)).toEqual([0,1,2]);
  expect(draft.sections[0].items).toHaveLength(1);
 });
 it('moves a presentation to another section without duplicating it',()=>{
  const draft=menuDraft(example);
  draft.sections.push({key:'s2',nombre:'Postres',items:[]});
  const moved=moveMenuItemToSection(draft,'s1','s2','v1');
  expect(moved.sections[0].items).toHaveLength(0);
  expect(moved.sections[1].items.map(x=>x.varianteId)).toEqual(['v1']);
 });
 it('displays actionable Spanish descriptions of inventory and recipe blockers',()=>{
  expect(readableMenuIssue('SIN_RECETA_PUBLICADA')).toContain('receta');
  expect(readableMenuIssue('EXTRA_SIN_COMPOSICION_FISICA')).toContain('ingredientes');
 });
});
