import {describe,it,expect} from 'vitest';
import {thermalAmount,saleForBranch,printableKitchenLines,kitchenModifierNames} from './thermal-print.helpers';
import type {KitchenTicket} from '../data-access/orders.models';
import type {SaleRecord} from '../../payments/data-access/payments.models';

describe('80 mm thermal print safeguards',()=>{
 it('formats verified GTQ/USD with decimal precision and never invents a currency',()=>{
  expect(thermalAmount('1234.50','GTQ')).toBe('Q 1,234.50');
  expect(thermalAmount('1234.50','USD')).toBe('US$ 1,234.50');
  expect(thermalAmount('-10.10',null)).toBe('-10.10');
  expect(thermalAmount('98765.43','XXX')).toBe('98,765.43');
 });
 it('never prints a sale from a different selected branch',()=>{
  const sale={id:'v1',sucursalId:'s1'} as SaleRecord;
  expect(saleForBranch(sale,'s1')).toBe(true);
  expect(saleForBranch(sale,'s2')).toBe(false);
  expect(saleForBranch(sale,null)).toBe(false);
 });
 it('filters cancelled ticket lines without losing modifier snapshots',()=>{
  const ticket={
   comandaLineasComoComanda:[
    {id:'k1',canceladaEn:null},
    {id:'k2',canceladaEn:'2026-11-04T10:00:00Z'}
   ]
  } as KitchenTicket;
  expect(printableKitchenLines(ticket).map(x=>x.id)).toEqual(['k1']);
  expect(kitchenModifierNames([
   {id:'m1',modificadorId:'x',nombreSnapshot:'Canela espolvoreada',cantidad:1,recargoUnitario:'1.50'},
   {id:'m2',modificadorId:'y',nombreSnapshot:'Azúcar',cantidad:2,recargoUnitario:'0.50'}
  ])).toEqual(['Canela espolvoreada','2 × Azúcar']);
 });
});
