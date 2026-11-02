import {GcApiError} from '../../../core/http/api-error';
import {catalogUiError} from './catalog-ui-copy';

describe('Catalog user-friendly errors',()=>{
 it('does not expose article IDs or internal warning codes from publishing',()=>{
  const error=new GcApiError(409,'Menú incompleto: variante cm0123, sucursal CM: SIN_PRECIO');
  const result=catalogUiError(error);
  expect(result).toContain('Revisa las fotos, los precios');
  expect(result).not.toContain('cm0123');
  expect(result).not.toContain('SIN_PRECIO');
 });
 it('explains concurrent edits in normal language',()=>{
  expect(catalogUiError(new GcApiError(409,'La versión del menú cambió; actualice antes de publicar')))
   .toContain('otra sesión');
 });
});
