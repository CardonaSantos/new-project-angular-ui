import {CATALOG_ROUTES} from './catalog.routes';

describe('CAT-A navigation and menu editing',()=>{
 it('registers C4/C5 admin routes in the authenticated catalog feature',()=>{
  const paths=CATALOG_ROUTES.map(route=>route.path);
  expect(paths).toContain('menus');
  expect(paths).toContain('preview');
  expect(paths).toContain('reports');
 });
 it('has independent new and detail pages guarded against unsaved edits',()=>{
  const menus=CATALOG_ROUTES.find(route=>route.path==='menus');
  const children=menus?.children??[];
  expect(children.map(child=>child.path)).toEqual(['','new',':id']);
  expect(children.find(child=>child.path==='new')?.canDeactivate).toHaveLength(1);
  expect(children.find(child=>child.path===':id')?.canDeactivate).toHaveLength(1);
 });
 it('keeps guided new product separate from the advanced existing-product editor',()=>{
  const products=CATALOG_ROUTES.find(route=>route.path==='products');
  const children=products?.children??[];
  expect(children.find(route=>route.path==='new')?.canDeactivate).toHaveLength(1);
  expect(children.find(route=>route.path===':id')?.canDeactivate).toHaveLength(1);
  expect(children.find(route=>route.path==='new')?.loadComponent).not.toBe(
   children.find(route=>route.path===':id')?.loadComponent);
 });
 it('keeps sensitive editor actions behind authenticated routes rather than public kiosk paths',()=>{
  const keys=CATALOG_ROUTES.map(route=>route.path);
  expect(keys).not.toContain('checkout');
  expect(keys).not.toContain('kiosk');
  expect(keys).not.toContain('tablet');
 });
});
