import {GcApiError} from '../../../core/http/api-error';
import type {KitchenTicket} from './orders.models';
import {kitchenStage,orderFriendlyError} from './orders.helpers';

describe('Comandas — estado operativo y mensajes',()=>{
 const ticket=(estado:'PENDIENTE'|'PREPARANDO'|'LISTA'|'CANCELADA',
  lines:{canceladaEn:string|null;listaEn:string|null;entregadaEn:string|null}[]):KitchenTicket=>
  ({id:'t1',numero:'CO-1',estado,comandaLineasComoComanda:lines.map((l,i)=>({
   id:String(i),comandaId:'t1',ordenLineaId:'l1',cantidad:'1',cantidadPreparada:'1',
   ...l}))} as KitchenTicket);
 const ready={canceladaEn:null,listaEn:'2026-11-03T12:00:00',entregadaEn:null};
 const delivered={...ready,entregadaEn:'2026-11-03T12:05:00'};
 it('no confunde lista con entregada',()=>{
  expect(kitchenStage(ticket('LISTA',[ready])).label).toBe('Lista para entregar');
  expect(kitchenStage(ticket('LISTA',[delivered])).label).toBe('Entregada');
  expect(kitchenStage(ticket('LISTA',[delivered,ready])).label).toBe('Entrega parcial');
 });
 it('excluye líneas canceladas al calcular entrega',()=>{
  expect(kitchenStage(ticket('LISTA',[delivered,{...ready,canceladaEn:'2026-11-03'}])).label).toBe('Entregada');
  expect(kitchenStage(ticket('LISTA',[])).label).toBe('Lista para entregar');
 });
 it('conserva estados operativos pendientes y cancelados',()=>{
  expect(kitchenStage(ticket('PENDIENTE',[ready])).label).toBe('Pendiente');
  expect(kitchenStage(ticket('PREPARANDO',[ready])).label).toBe('En preparación');
  expect(kitchenStage(ticket('CANCELADA',[ready])).label).toBe('Cancelada');
 });
 it('explica conflicto 409 de receta y precio con acciones comprensibles',()=>{
  const recipe=orderFriendlyError(new GcApiError(409,'Variante preparada sin receta publicada'));
  const price=orderFriendlyError(new GcApiError(409,'Variante sin precio vigente en sucursal'));
  expect(recipe).toContain('Publícala en Recetas');
  expect(price).toContain('Catálogo > Precios');
  expect(recipe).not.toContain('409');
 });
});
