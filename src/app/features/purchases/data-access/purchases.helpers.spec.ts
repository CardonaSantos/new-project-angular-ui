import {decimal,canConfirmReceipt,canEditReceipt} from './purchases.helpers';

describe('Compras: reglas de interfaz sin simular backend',()=>{
 it('requires a positive, finite quantity with at most six decimals',()=>{
  expect(decimal('0')).toBeNull();
  expect(decimal('-1')).toBeNull();
  expect(decimal('1.0000001')).toBeNull();
  expect(decimal('1.5')).toBe('1.5');
  expect(decimal(' 2,5 ')).toBe('2.5');
 });
 it('permits zero when validating nonnegative costs or rejects',()=>{
  expect(decimal('0',true)).toBe('0');
  expect(decimal('0.000000',true)).toBe('0');
 });
 it('never allows editing or confirming stock already posted',()=>{
  expect(canConfirmReceipt('BORRADOR',true)).toBe(true);
  expect(canConfirmReceipt('CONFIRMADO',true)).toBe(false);
  expect(canConfirmReceipt('BORRADOR',false)).toBe(false);
  expect(canEditReceipt('CANCELADO',true)).toBe(false);
  expect(canEditReceipt('CONFIRMADO',true)).toBe(false);
 });
});
