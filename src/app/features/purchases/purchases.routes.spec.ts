import {PURCHASES_ROUTES} from './purchases.routes';

describe('PUR/SUP navigation split by operational responsibilities',()=>{
 const paths=PURCHASES_ROUTES.map(x=>x.path);
 it('provides all independent stock-entry and purchase workflows',()=>{
  expect(paths).toEqual(expect.arrayContaining([
   '', 'quick','receipts','receipts/new','receipts/:id','receipts/:id/edit',
   'suppliers','orders','orders/new','orders/:id','presentations',
   'requisitions','requisitions/:id','transfers/:id'
  ]));
 });
 it('protects unfinished direct entries, receipts and purchase orders',()=>{
  for(const p of ['quick','receipts/new','receipts/:id/edit','orders/new']){
   expect(PURCHASES_ROUTES.find(r=>r.path===p)?.canDeactivate?.length).toBeGreaterThan(0);
  }
 });
});
