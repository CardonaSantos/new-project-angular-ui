import {REPORTS_ROUTES} from './reports.routes';
describe('Analítica route separation',()=>{
 it('loads report views without exposing them as payments reports',()=>{
  expect(REPORTS_ROUTES.map(route=>route.path)).toEqual(['']);
  expect(REPORTS_ROUTES[0].loadComponent).toBeDefined();
 });
});
