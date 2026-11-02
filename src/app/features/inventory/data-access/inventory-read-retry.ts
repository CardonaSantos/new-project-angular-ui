import {HttpErrorResponse} from '@angular/common/http';
import {GcApiError} from '../../../core/http/api-error';

/** Only read-only GET requests may be reattempted after transient connectivity failures.
 * Never retry 401/403/404/409, validation errors, or failed writes. */
export function isTransientInventoryReadError(error:unknown):boolean{
 const status=error instanceof GcApiError||error instanceof HttpErrorResponse?error.status:null;
 return status===0||status===502||status===503||status===504;
}
