import {catalogProductRoute} from './catalog-product-route';

describe('Catalog product route recognition',()=>{
 it('treats the static /catalog/products/new path as creation without an ID',()=>{
  expect(catalogProductRoute('new',null)).toEqual({isNew:true,id:null});
  expect(catalogProductRoute('new','new')).toEqual({isNew:true,id:null});
 });
 it('only requests an existing product if the dynamic route supplies an ID',()=>{
  expect(catalogProductRoute(':id','cmproduct001')).toEqual({isNew:false,id:'cmproduct001'});
 });
 it('never turns a static creation URL into an empty detail identifier',()=>{
  expect(catalogProductRoute(':id','new').isNew).toBe(true);
 });
});
