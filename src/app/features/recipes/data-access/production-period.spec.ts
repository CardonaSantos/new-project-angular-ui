import {branchDayStart,inclusiveBranchPeriod} from './production-period';
describe('production day filters use the destination branch zone',()=>{
 it('starts Guatemala day at local midnight with correct offset',()=>{
  expect(branchDayStart('2026-11-02','America/Guatemala')).toBe('2026-11-02T00:00:00-06:00');
 });
 it('makes the end calendar day inclusive with exclusive following midnight',()=>{
  expect(inclusiveBranchPeriod('2026-11-01','2026-11-02','America/Guatemala')).toEqual({
   fechaDesde:'2026-11-01T00:00:00-06:00',
   fechaHasta:'2026-11-03T00:00:00-06:00'
  });
 });
 it('rejects inverted dates before sending the report request',()=>{
  expect(()=>inclusiveBranchPeriod('2026-11-08','2026-11-02','America/Guatemala')).toThrow();
 });
});
