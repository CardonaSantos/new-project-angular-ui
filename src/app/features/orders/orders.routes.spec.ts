import {ORDERS_ROUTES} from './orders.routes';

describe('ORD-UI — navegación por responsabilidades',()=>{
 const paths=ORDERS_ROUTES.map(x=>x.path);
 it('mantiene todas las rutas operativas y de cobros existentes',()=>{
  expect(paths).toEqual(expect.arrayContaining([
   '', 'pos','list','list/:id','print/:id','tables','kitchen','kitchen/tickets/:id/print','settings'
  ]));
 });
 it('separa el tablero de mesas de su administración sin duplicar API',()=>{
  expect(paths).toContain('tables/manage');
  const admin=ORDERS_ROUTES.find(x=>x.path==='tables/manage');
  expect(admin?.data?.['manage']).toBe(true);
  expect(ORDERS_ROUTES.find(x=>x.path==='tables')?.data?.['manage']).toBeUndefined();
 });
 it('no elimina la protección frente a cambios sin guardar en el POS',()=>{
  expect(ORDERS_ROUTES.find(x=>x.path==='pos')?.canDeactivate?.length).toBeGreaterThan(0);
 });
});
