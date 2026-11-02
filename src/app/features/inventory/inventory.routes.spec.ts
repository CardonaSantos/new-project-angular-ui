
import type {Routes,Route} from '@angular/router';
import {INVENTORY_ROUTES} from './inventory.routes';
function leaves(routes:Routes,prefix=''):string[]{
 return routes.flatMap(route=>{
  const path=prefix+'/'+(route.path??'');
  return [...(route.loadComponent?[path]:[]),...leaves(route.children??[],path)];
 });
}
function flatten(routes:Routes):Route[]{
 return routes.flatMap(route=>[route,...flatten(route.children??[])]);
}
describe('Inventory route conventions',()=>{
 it('maps 18 lazy views under one /inventory branch with parent breadcrumb labels',()=>{
  const list=leaves(INVENTORY_ROUTES);
  expect(list).toHaveLength(18);
  expect(list).toContain('//articles/new');
  expect(list).toContain('//operations/counts/new');
  expect(list).toContain('//operations/transfers/:id');
  const parents=flatten(INVENTORY_ROUTES).filter(r=>r.children?.length);
  expect(parents.find(r=>r.path==='articles')?.data?.['breadcrumb']).toBe('Artículos');
  expect(parents.find(r=>r.path==='counts')?.data?.['breadcrumb']).toBe('Conteos');
 });
 it('keeps unsaved-changes guards on transactional forms and editors',()=>{
  for(const path of ['new','manual','units','warehouses']){
   const match=flatten(INVENTORY_ROUTES).filter(r=>r.path===path);
   expect(match.length).toBeGreaterThan(0);
   for(const route of match)expect(route.canDeactivate?.length).toBeGreaterThan(0);
  }
 });
});
