import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { GcSessionService } from './gc-session.service';
import { GcBranchContext } from '../organization/gc-branch-context';

/** Server grants access; guards only keep the UI's navigation coherent. */
export const gcSessionGuard: CanActivateFn = () => {
  const session = inject(GcSessionService);
  const router = inject(Router);
  return session.restore().pipe(map(ok => {
    if (!ok) return router.createUrlTree(['/login']);
    if (session.passwordChangeRequired()) return router.createUrlTree(['/change-password']);
    return true;
  }));
};

export const gcPasswordChangeGuard: CanActivateFn = () => {
  const session = inject(GcSessionService);
  const router = inject(Router);
  return session.restore().pipe(map(ok =>
    !ok ? router.createUrlTree(['/login'])
      : session.passwordChangeRequired() ? true : router.createUrlTree(['/workspace']),
  ));
};

export const gcRealPermissionGuard: CanActivateFn = (route) => {
  const session = inject(GcSessionService);
  const branch = inject(GcBranchContext);
  const router = inject(Router);
  const required: unknown = route.data['permission'];
  if (!session.authenticated()) return router.createUrlTree(['/login']);
  if (typeof required !== 'string' || !branch.has(required)) {
    return router.createUrlTree(['/workspace'], { queryParams: { denied: '1' } });
  }
  return true;
};
