import {GcApiError} from '../../../core/http/api-error';
import type {KitchenTicket} from './orders.models';
import {kitchenStage,orderFriendlyError,sortKitchenQueue,kitchenReadyAt} from './orders.helpers';

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

describe('Prioridad de atención en cocina',()=>{
 const make=(id:string,time:string,table:boolean,delivered:boolean,readyTime:string):KitchenTicket=>({
  id,numero:id,enviadaEn:time,estado:'LISTA',estacionId:'s',ordenId:'o',
  orden:{id:'o',numero:'o',estado:'ABIERTA',modalidad:table?'MESA':'MOSTRADOR',
   observaciones:null,...(table?{ocupacionMesa:{mesa:{numero:'2'}}}:{})},
  comandaLineasComoComanda:[{id:'l'+id,comandaId:id,ordenLineaId:'ol',cantidad:'1',
   cantidadPreparada:'1',canceladaEn:null,listaEn:readyTime,
   entregadaEn:delivered?readyTime:null}]
 });
 it('sube las mesas listas sin entregar por encima del historial y el mostrador',()=>{
  const delivered=make('history','2026-11-03T08:00:00Z',false,true,'2026-11-03T08:05:00Z');
  const counter=make('counter','2026-11-03T09:00:00Z',false,false,'2026-11-03T09:10:00Z');
  const table=make('table','2026-11-03T10:00:00Z',true,false,'2026-11-03T10:15:00Z');
  expect(sortKitchenQueue([delivered,counter,table],'ready').map(x=>x.id))
   .toEqual(['table','counter','history']);
 });
 it('atiende primero la mesa que más tiempo lleva lista',()=>{
  const older=make('older','2026-11-03T10:00:00Z',true,false,'2026-11-03T10:10:00Z');
  const newer=make('newer','2026-11-03T10:01:00Z',true,false,'2026-11-03T10:30:00Z');
  expect(sortKitchenQueue([newer,older],'ready')[0].id).toBe('older');
  expect(kitchenReadyAt(older)).toBe('2026-11-03T10:10:00.000Z');
 });
 it('mantiene en preparación las comandas más antiguas primero dentro de cada tipo de atención',()=>{
  const old=make('old','2026-11-03T08:00:00Z',true,false,'2026-11-03T08:10:00Z');
  const recent=make('recent','2026-11-03T09:00:00Z',true,false,'2026-11-03T09:10:00Z');
  old.estado='PENDIENTE';recent.estado='PREPARANDO';
  expect(sortKitchenQueue([recent,old],'active').map(x=>x.id)).toEqual(['old','recent']);
 });
 it('no modifica el listado original al ordenar',()=>{
  const a=make('a','2026-11-03T08:00:00Z',false,true,'2026-11-03T08:10:00Z');
  const b=make('b','2026-11-03T09:00:00Z',true,false,'2026-11-03T09:10:00Z');
  const original=[a,b];sortKitchenQueue(original,'ready');expect(original[0].id).toBe('a');
 });
});
