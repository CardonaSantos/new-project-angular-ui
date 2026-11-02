import {articleChanges,articleRelations} from './inventory-article-presentation';
import type {Article} from './inventory.models';

const article:Article={
 id:'article-1',codigo:'PURPAJ-001',nombre:'Pajillas',tipo:'EMPAQUE',activo:true,
 unidadBase:{id:'unit-1',codigo:'UND',nombre:'Unidad',dimension:'UNIDAD',esBase:true},
 requiereLote:false,requiereVencimiento:false,stockMinimo:null,costoReferencia:null,
 imagenPrincipalUrl:null,imagenPrincipalId:null,imagenes:[],
};
const values={nombre:'Pajillas',requiereLote:false,requiereVencimiento:false,
 stockMinimo:'',costoReferencia:''};

describe('Inventory article editing',()=>{
 it('renames articles without resending unchanged lot or expiry controls',()=>{
  expect(articleChanges(article,{...values,nombre:'Pajillas biodegradables'},true))
   .toEqual({nombre:'Pajillas biodegradables'});
 });
 it('does not resubmit unchanged decimal values or cost permissions',()=>{
  const existing={...article,stockMinimo:'5000.000000',costoReferencia:'0.025000'};
  expect(articleChanges(existing,{...values,stockMinimo:'5000',costoReferencia:'0.025'},true))
   .toEqual({});
  expect(articleChanges(existing,{...values,nombre:'Pajillas nuevas',stockMinimo:'5000',
   costoReferencia:'0.030'},false)).toEqual({nombre:'Pajillas nuevas'});
 });
 it('sends an explicit lot-control change only when it really changes',()=>{
  expect(articleChanges(article,{...values,requiereLote:true},true)).toEqual({requiereLote:true});
  expect(articleChanges({...article,requiereLote:true},{...values,requiereLote:false},true))
   .toEqual({requiereLote:false});
 });
 it('changes stock independently without discarding other data',()=>{
  expect(articleChanges(article,{...values,stockMinimo:'10.500000'},true))
   .toEqual({stockMinimo:'10.5'});
 });
 it('describes active module relationships without internal identifiers or zero counts',()=>{
  const result=articleRelations({
   articuloId:'article-1',variantesActivas:0,recetasActivas:0,componentesReceta:0,
   componentesModificador:0,sustituciones:0,reglasEmpaque:0,
   presentacionesCompraActivas:1,otherInternalField:'secret'
  });
  expect(result).toEqual([{
   key:'presentacionesCompraActivas',label:'Presentaciones de compra activas',count:1
  }]);
  expect(articleRelations({articuloId:'article-1',recetasActivas:0})).toEqual([]);
 });
});
