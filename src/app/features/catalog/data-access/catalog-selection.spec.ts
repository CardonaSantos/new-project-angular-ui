import {keepSelected,readableCategory} from './catalog-selection';

describe('Catalog edit forms retain saved selections',()=>{
 const saved={id:'linked',nombre:'Cafés calientes'};
 it('shows an existing selection omitted by paginated search results',()=>{
  expect(keepSelected([{id:'other',nombre:'Bebidas frías'}],saved))
   .toEqual([saved,{id:'other',nombre:'Bebidas frías'}]);
 });
 it('does not duplicate the selected option when already loaded',()=>{
  expect(keepSelected([saved],saved)).toEqual([saved]);
 });
 it('keeps a newly selected value even when searching unrelated categories',()=>{
  const changed={id:'changed',nombre:'Desayunos'};
  expect(keepSelected([{id:'unrelated',nombre:'Pasteles'}],changed)[0]).toEqual(changed);
 });
 it('converts abbreviated details to a stable label and never shows raw IDs',()=>{
  expect(readableCategory({id:'cm123',nombre:'Cafés calientes'}))
   .toEqual({id:'cm123',nombre:'Cafés calientes',parentId:null,orden:0,activa:true});
  expect(readableCategory(null)).toBeNull();
 });
});
