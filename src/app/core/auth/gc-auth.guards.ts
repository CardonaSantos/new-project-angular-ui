import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { GcAuthFacade, GcPermission } from './demo-auth.facade';

export const gcAuthGuard: CanActivateFn = () => {
  const auth = inject(GcAuthFacade);
  return auth.authenticated() || inject(Router).createUrlTree(['/lab/behaviors'], { queryParams: { gate: 'login' } });
};

export const gcPermissionGuard: CanActivateFn = (route) => {
  const auth = inject(GcAuthFacade);
  const permission: unknown = route.data['permission'];
  if (!auth.authenticated()) {
    return inject(Router).createUrlTree(['/lab/behaviors'], { queryParams: { gate: 'login' } });
  }
  if (typeof permission !== 'string' || !auth.has(permission as GcPermission)) {
    return inject(Router).createUrlTree(['/lab/behaviors'], { queryParams: { gate: 'denied' } });
  }
  return true;
};
