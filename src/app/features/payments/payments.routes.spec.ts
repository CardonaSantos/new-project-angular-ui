import {PAYMENTS_ROUTES} from './payments.routes';
describe('Caja — navegación por responsabilidades',()=>{
 const paths=PAYMENTS_ROUTES.map(x=>x.path);
 it('conserva la ruta original de caja para enlaces del POS',()=>{
  expect(paths).toContain('cash');
  expect(paths).toContain('order/:id');
 });
 it('separa la apertura del cierre, el historial, los movimientos y la administración',()=>{
  expect(paths).toEqual(expect.arrayContaining([
   'cash/open','cash/movement','cash/close','cash/shift/:id',
   'cash/history','cash/registers','cash/registers/new','cash/registers/:id',
   'cash/shift/:id/receipt'
  ]));
 });
 it('mantiene la venta y resumen financiero en sus páginas propias',()=>{
  expect(paths).toContain('sales');
  expect(paths).toContain('sales/:id/receipt');
  expect(paths).toContain('reports');
 });
});
