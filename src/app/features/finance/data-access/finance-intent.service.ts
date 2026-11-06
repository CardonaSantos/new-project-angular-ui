
import {inject,Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {FinanceApi} from './finance.api';
import type {FinanceIntentAction} from './finance.models';

/**
 * Finanzas issues the idempotency key server-side (operationId), unlike the client-generated
 * claveOperacion used elsewhere in the app. A form must request one when it opens and reuse it
 * across retries/double submits — never issue a new one per save attempt, and never issue one
 * just because a page loaded. This service caches the in-flight/resolved intent per
 * (sucursalId, acción) so every Finanzas form can share the same one-line call.
 */
@Injectable({providedIn:'root'})
export class FinanceIntentService{
 private readonly api=inject(FinanceApi);
 private readonly cache=new Map<string,Promise<string>>();
 private key(sucursalId:string,accion:FinanceIntentAction){return accion+':'+sucursalId}
 /** Call once when a create/mutate form opens (or the relevant branch changes), not on every keystroke. */
 async require(sucursalId:string,accion:FinanceIntentAction):Promise<string>{
  const key=this.key(sucursalId,accion);
  let pending=this.cache.get(key);
  if(!pending){
   pending=firstValueFrom(this.api.issueIntent(sucursalId,accion)).then(r=>r.operationId);
   this.cache.set(key,pending);
  }
  try{return await pending}
  catch(e){this.cache.delete(key);throw e}
 }
 /** Call after a successful submit, or when the form is reset/closed, so the next attempt gets a fresh intent. */
 release(sucursalId:string,accion:FinanceIntentAction){this.cache.delete(this.key(sucursalId,accion))}
}
