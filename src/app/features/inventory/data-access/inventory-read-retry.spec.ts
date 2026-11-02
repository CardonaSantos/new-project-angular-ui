import {HttpErrorResponse} from '@angular/common/http';
import {GcApiError} from '../../../core/http/api-error';
import {isTransientInventoryReadError} from './inventory-read-retry';

describe('Inventory transient GET policy',()=>{
 it('retries only network and gateway failures',()=>{
  for(const status of [0,502,503,504]){
   expect(isTransientInventoryReadError(new HttpErrorResponse({status}))).toBe(true);
   expect(isTransientInventoryReadError(new GcApiError(status,'Falló la conexión'))).toBe(true);
  }
 });
 it('never repeats denied, invalid or conflicting requests',()=>{
  for(const status of [400,401,403,404,409,422,429,500]){
   expect(isTransientInventoryReadError(new HttpErrorResponse({status}))).toBe(false);
  }
  expect(isTransientInventoryReadError(new Error('Unexpected mapper failure'))).toBe(false);
 });
});
