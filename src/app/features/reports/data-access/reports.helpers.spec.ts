import {describe,expect,it} from 'vitest';
import {asReportQuery,chartAmount,periodValid,reportMoney,sourceScalar} from './reports.helpers';
describe('REP-A: visible money, dates, and missing data are truthful',()=>{
 it('uses GTQ thousands separators and USD without float transformations',()=>{
  expect(reportMoney('1234567.85','GTQ')).toBe('Q 1,234,567.85');
  expect(reportMoney('-12.50','GTQ')).toBe('-Q 12.50');
  expect(reportMoney('18.2','USD')).toBe('US$ 18.20');
  expect(reportMoney(null,'GTQ')).toBe('Sin datos');
 });
 it('does not invent a margin or zero cash differences',()=>{
  expect(reportMoney(undefined,'GTQ')).toBe('Sin datos');
  expect(sourceScalar(null,'costoTotal','GTQ')).toBe('—');
 });
 it('rejects malformed and inverted operational date ranges',()=>{
  expect(periodValid({sucursalId:'b1',periodo:'PERSONALIZADO',
   desde:'2026-11-05',hasta:'2026-11-04'})).toBe(false);
  expect(periodValid({sucursalId:'b1',periodo:'PERSONALIZADO',
   desde:'2026-11-01',hasta:'2026-11-30'})).toBe(true);
  expect(periodValid({sucursalId:'b1',periodo:'PERSONALIZADO',
   desde:'2024-01-01',hasta:'2026-11-04'})).toBe(false);
 });
 it('never includes stale calendar fields in noncustom API queries',()=>{
  expect(asReportQuery({sucursalId:'b1',periodo:'MES',
   desde:'2026-09-01',hasta:'2026-10-01',fecha:'2026-11-04'}))
   .toEqual({sucursalId:'b1',periodo:'MES',fecha:'2026-11-04'});
 });
 it('converts money to Number only for chart projection',()=>{
  expect(chartAmount('155.50')).toBe(155.5);
  expect(sourceScalar('1234.50','subtotal','GTQ')).toBe('Q 1,234.50');
 });
});
