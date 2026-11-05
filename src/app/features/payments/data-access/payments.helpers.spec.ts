import {GcApiError} from '../../../core/http/api-error';
import {amount,checkParts,paymentError,positive,remainder,pendingTotal} from './payments.helpers';
import type {AccountDetail} from './payments.models';
describe('Pagos — validaciones antes de enviar',()=>{
 it('conserva importes exactos sin redondear cantidades inválidas',()=>{
  expect(amount('24.25')).toBe('24.25');
  expect(amount('24.255')).toBeNull();
  expect(amount('-1')).toBeNull();
  expect(positive('0.00')).toBeNull();
  expect(positive('7.2')).toBe('7.20');
 });
 it('calcula saldo disponible descontando transferencias pendientes',()=>{
  const account={saldo:'24.00',intentos:[
   {metodo:'TRANSFERENCIA',estado:'PENDIENTE',monto:'10.00'},
   {metodo:'TRANSFERENCIA',estado:'CANCELADO',monto:'3.00'},
  ]} as AccountDetail;
  expect(remainder(account)).toBe('14.00');
  expect(pendingTotal(account.intentos)).toBe('10.00');
 });
 it('valida métodos múltiples y evita sobrecobro',()=>{
  expect(checkParts([{metodo:'EFECTIVO',monto:'20.00',efectivoRecibido:'30.00'},
   {metodo:'TARJETA',monto:'4.00',codigoAutorizacion:'OK01'}],'24.00')).toBeNull();
  expect(checkParts([{metodo:'TRANSFERENCIA',monto:'2.00'}],'24.00')).toContain('referencia');
  expect(checkParts([{metodo:'TARJETA',monto:'2.00'}],'24.00')).toContain('autorización');
  expect(checkParts([{metodo:'EFECTIVO',monto:'20.00',efectivoRecibido:'10.00'}],'24.00')).toContain('cubrir');
  expect(checkParts([{metodo:'EFECTIVO',monto:'30.00'}],'24.00')).toContain('supera');
 });
 it('traduce turnos cerrados y reparto de cuenta a indicaciones humanas',()=>{
  expect(paymentError(new GcApiError(409,'Turno cerrado'))).toContain('Abre');
  expect(paymentError(new GcApiError(409,'Solo se divide cuenta principal sin pagos ni intentos')))
   .toContain('antes del primer pago');
 });
});
