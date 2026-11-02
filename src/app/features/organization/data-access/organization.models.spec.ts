import { DEVICE_TYPES, deviceLabel } from './organization.models';
describe('Organization domain view models',()=>{
  it('maps only the backend-supported device types',()=>{
    expect(DEVICE_TYPES.map(t=>t.value)).toEqual([
      'POS','KDS','QUIOSCO','PANTALLA_TURNOS','IMPRESORA','OTRO',
    ]);
    expect(deviceLabel('KDS')).toBe('Pantalla de cocina');
    expect(deviceLabel('IMPRESORA')).toBe('Impresora');
  });
});
