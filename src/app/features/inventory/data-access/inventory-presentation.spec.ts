import {describe,it,expect} from 'vitest';
import {inventoryCalendar,inventoryInstant,inventoryMoney,inventoryMovementLabel,
 inventoryValuationRows,valuationMethod} from './inventory-presentation';

describe('Inventory readable presentation',()=>{
 it('formats Kardex timestamps in the branch timezone, not UTC or the browser zone',()=>{
  expect(inventoryInstant('2026-10-30T16:03:40.292Z','America/Guatemala'))
   .toBe('30/10/2026 10:03');
  expect(inventoryInstant('2026-11-01T01:00:00Z','America/Guatemala'))
   .toBe('31/10/2026 19:00');
  expect(inventoryInstant('2026-10-30T16:03:40.292Z',undefined)).toBe('—');
  expect(inventoryInstant('2026-10-30T16:03:40.292Z','Bad/Zone')).toBe('Fecha no disponible');
  expect(inventoryCalendar('2026-10-31')).toBe('31/10/2026');
 });
 it('explains operational movement types instead of printing raw enum values',()=>{
  expect(inventoryMovementLabel('TRANSFERENCIA_ENTRADA')).toBe('Transferencia recibida');
  expect(inventoryMovementLabel('TRANSFERENCIA_SALIDA')).toBe('Transferencia enviada');
  expect(inventoryMovementLabel('CONSUMO')).toBe('Consumo');
  expect(inventoryMovementLabel('AJUSTE_SALIDA')).toBe('Ajuste de salida');
 });
 it('renders GTQ currency using the shared decimal formatter, preserving cents',()=>{
  expect(inventoryMoney('164.990000')).toBe('Q 164.99');
  expect(inventoryMoney('23.010000')).toBe('Q 23.01');
  expect(inventoryMoney('2.060000')).toBe('Q 2.06');
  expect(valuationMethod('PROMEDIO_PONDERADO')).toBe('Costo promedio ponderado');
 });
 it('renders named valuation records and signals old backend contracts without exposing ids',()=>{
  expect(inventoryValuationRows({articulos:[{
   articuloId:'a1',codigo:'PURPAJ',nombre:'Pajillas',valor:'23.010000'
  }]})).toEqual([{id:'a1',codigo:'PURPAJ',nombre:'Pajillas',valor:'Q 23.01'}]);
  expect(inventoryValuationRows({articulos:[{articuloId:'a1',valor:'23.010000'}]})[0].nombre)
   .toBe('Nombre no proporcionado por el servidor');
 });
});
