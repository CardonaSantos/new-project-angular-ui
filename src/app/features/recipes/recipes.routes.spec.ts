import {RECIPES_ROUTES} from './recipes.routes';
describe('REC-A route structure',()=>{
 it('offers five first-phase entry points without production commands',()=>{
  expect(RECIPES_ROUTES.map(x=>x.path)).toEqual(['','summary','list','extras','packaging','production','reports']);
  expect(RECIPES_ROUTES.find(x=>x.path==='production')?.children?.map(x=>x.path)).toEqual(['','new',':id']);
 });
 it('protects all forms that can contain unsaved changes',()=>{
  const entries=RECIPES_ROUTES.find(x=>x.path==='list')?.children??[];
  expect(entries.find(x=>x.path==='new')?.canDeactivate).toHaveLength(1);
  expect(entries.find(x=>x.path===':id')?.canDeactivate).toHaveLength(1);
  expect(RECIPES_ROUTES.find(x=>x.path==='extras')?.canDeactivate).toHaveLength(1);
  expect(RECIPES_ROUTES.find(x=>x.path==='packaging')?.canDeactivate).toHaveLength(1);
 });
});
