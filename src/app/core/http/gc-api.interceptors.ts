import {
  HttpErrorResponse, HttpInterceptorFn, HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, of, switchMap, throwError } from 'rxjs';
import { GcSessionService } from '../auth/gc-session.service';
import { GcBranchContext } from '../organization/gc-branch-context';
import { GcNotificationService } from '../ux/gc-notification.service';
import { GC_BRANCH_REQUEST, GC_SILENT_ERROR, GC_SKIP_REFRESH } from './api-context';
import { gcNormalizeHttpError } from './api-error';

const isGcApi = (url: string): boolean => url.startsWith('/api/');

const publicEndpoints = new Set(['/api/auth/login', '/api/auth/refresh']);
function isPublic(url: string): boolean {
  return publicEndpoints.has(url.split('?')[0]);
}

/** Outer interceptor only notifies after attempted recovery has completed. */
export const gcApiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isGcApi(request.url)) return next(request);
  const notices = inject(GcNotificationService);
  return next(request).pipe(catchError(error => {
    if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
    const normalized = gcNormalizeHttpError(error);
    if (!request.context.get(GC_SILENT_ERROR)) notices.show(normalized.message, 'error', 0);
    return throwError(() => normalized);
  }));
};

/** Only same-origin /api/ requests may receive credentials or branch headers. */
export const gcApiAuthInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isGcApi(request.url)) return next(request);
  const session = inject(GcSessionService);
  const branch = inject(GcBranchContext);
  let headers = request.headers;
  const token = session.accessToken();
  if (token && !isPublic(request.url)) headers = headers.set('Authorization', 'Bearer ' + token);
  if (request.context.get(GC_BRANCH_REQUEST) && branch.branchId()) {
    headers = headers.set('x-sucursal-id', branch.branchId()!);
  }
  return next(request.clone({ headers }));
};

/** Never auto-replay failed writes on 0/409/5xx. Only 401 may retry once. */
export const gcApiRefreshInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isGcApi(request.url) || isPublic(request.url) || request.context.get(GC_SKIP_REFRESH)) {
    return next(request);
  }
  const session = inject(GcSessionService);
  return next(request).pipe(catchError(error => {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
      return throwError(() => error);
    }
    // A concurrent request may have already refreshed the token.
    const current = session.accessToken();
    const stale = request.headers.get('Authorization');
    const newToken = current && stale !== 'Bearer ' + current
      ? of(current) : session.refreshAccessToken();
    return newToken.pipe(switchMap(token =>
      next(retryWithBearer(request, token)),
    ));
  }));
};

function retryWithBearer(request: HttpRequest<unknown>, token: string) {
  return request.clone({ setHeaders: { Authorization: 'Bearer ' + token } });
}
