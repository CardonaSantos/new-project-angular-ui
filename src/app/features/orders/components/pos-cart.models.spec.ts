import {addOrMergeCartEntry,asOrderLine,sameCartConfiguration,type PosCartEntry} from './pos-cart.models';

const entry=(overrides:Partial<PosCartEntry>={}):PosCartEntry=>({
 key:'line-a',variantId:'water',name:'Agua en botella',variant:'600 ml',
 price:'10.00',currency:'GTQ',quantity:1,extras:[],modifierIds:[],
 notes:'',discount:'0',...overrides
});

describe('POS: consolidation without loss of modifier or price identity',()=>{
 it('two identical bottles become one line with quantity 2 and one DTO line',()=>{
  const original=[entry()];
  const result=addOrMergeCartEntry(original,entry({key:'line-b'}));
  expect(result.status).toBe('merged');
  expect(result.entries).toHaveLength(1);
  expect(result.entries[0].key).toBe('line-a');
  expect(result.entries[0].quantity).toBe(2);
  expect(asOrderLine(result.entries[0])).toEqual({varianteId:'water',cantidad:'2',modificadores:[]});
  expect(original[0].quantity).toBe(1);
 });
 it('same modifiers in different selection order still merge',()=>{
  const left=entry({modifierIds:['sugar','cinnamon'],extras:['Azúcar','Canela']});
  const right=entry({key:'second',modifierIds:['cinnamon','sugar'],extras:['Canela','Azúcar']});
  expect(sameCartConfiguration(left,right)).toBe(true);
  expect(addOrMergeCartEntry([left],right).entries[0].quantity).toBe(2);
 });
 it('separate variants, prices, notes, modifiers and currency never merge',()=>{
  const a=entry();
  for(const second of [
   entry({key:'b',variantId:'other'}),
   entry({key:'b',price:'12.00'}),
   entry({key:'b',notes:'Sin hielo'}),
   entry({key:'b',modifierIds:['lemon'],extras:['Limón']}),
   entry({key:'b',currency:'USD'})
  ]){
   const result=addOrMergeCartEntry([a],second);
   expect(result.status).toBe('added');
   expect(result.entries).toHaveLength(2);
  }
 });
 it('discounted lines remain separate to preserve discount-per-line amounts',()=>{
  const a=entry({discount:'2.00'});
  const b=entry({key:'b',discount:'2.00'});
  expect(addOrMergeCartEntry([a],b).entries).toHaveLength(2);
  expect(asOrderLine(b).descuento).toBe('2.00');
 });
 it('may merge an existing line even at the 100-line ceiling',()=>{
  const lines=Array.from({length:100},(_,i)=>entry({key:'k'+i,variantId:'v'+i}));
  const merged=addOrMergeCartEntry(lines,entry({key:'new',variantId:'v0'}));
  expect(merged.status).toBe('merged');
  expect(merged.entries).toHaveLength(100);
  const rejected=addOrMergeCartEntry(lines,entry({variantId:'other'}));
  expect(rejected.status).toBe('too-many-lines');
  expect(rejected.entries).toBe(lines);
 });
 it('caps quantities at 999 and does not alter existing cart on failure',()=>{
  const lines=[entry({quantity:999})];
  const result=addOrMergeCartEntry(lines,entry({key:'another'}));
  expect(result.status).toBe('too-many-units');
  expect(result.entries).toBe(lines);
  expect(result.entries[0].quantity).toBe(999);
 });
});
