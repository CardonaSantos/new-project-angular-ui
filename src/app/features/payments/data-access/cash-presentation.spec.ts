import {cashBreakdown,cashFromServer,cashMovementName,oldShiftWarning} from './cash-presentation';
import type {CashMovement,CashShift} from './payments.models';
const entry=(tipo:'INGRESO'|'EGRESO',monto:string,motivo:string):CashMovement=>({
 id:motivo,turnoId:'s1',tipo,monto,motivo,creadoEn:'2026-11-03T12:00:00Z'});
describe('Caja — resumen verificable',()=>{
 it('separa entradas y salidas sin confundir el total de ventas con efectivo',()=>{
  const list=[entry('INGRESO','100.00','Cobro de cuenta'),
   entry('EGRESO','10.00','Compra menor de insumos'),
   entry('INGRESO','22.00','Efectivo entregado por repartidor')];
  expect(cashBreakdown(list)).toEqual({
   income:'122.00',outflow:'10.00',entries:2,exits:1});
 });
 it('usa el saldo del backend, sin recalcularlo para cobrar o cerrar',()=>{
  const s={fondoInicial:'0.00',efectivoCalculado:'90.00'} as CashShift;
  expect(cashFromServer(s)).toBe('90.00');
  expect(cashFromServer(null)).toBeNull();
 });
 it('da una advertencia cuando se intenta usar un turno de días anteriores',()=>{
  expect(oldShiftWarning({fechaOperativa:'2001-01-01'} as CashShift,
   'America/Guatemala')).toBe(true);
  expect(oldShiftWarning({fechaOperativa:'2999-01-01'} as CashShift,
   'America/Guatemala')).toBe(false);
 });
 it('diferencia las liquidaciones de repartidores de un cobro manual',()=>{
  expect(cashMovementName(entry('INGRESO','22.00','Efectivo entregado por repartidor')))
   .toBe('Liquidación de entregas');
  expect(cashMovementName(entry('INGRESO','24.00','Cobro de cuenta')))
   .toBe('Cobro en efectivo');
  expect(cashMovementName(entry('EGRESO','10.00','Compra menor de insumos')))
   .toBe('Salida de efectivo');
 });
});
