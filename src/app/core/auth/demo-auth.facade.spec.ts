import { TestBed } from '@angular/core/testing';
import { GcAuthFacade } from './demo-auth.facade';

describe('GcAuthFacade', () => {
  it('starts anonymous and restricts permissions until demo login', () => {
    const auth = TestBed.inject(GcAuthFacade);
    expect(auth.authenticated()).toBe(false);
    expect(auth.has('settings.manage')).toBe(false);
    auth.startDemo('cashier');
    expect(auth.authenticated()).toBe(true);
    expect(auth.has('orders.manage')).toBe(true);
    expect(auth.has('settings.manage')).toBe(false);
  });
  it('restricts branch switching to assigned branches', () => {
    const auth = TestBed.inject(GcAuthFacade);
    auth.startDemo('manager');
    expect(auth.switchBranch('unknown')).toBe(false);
    expect(auth.switchBranch('demo-norte')).toBe(true);
    auth.logout();
    expect(auth.has('orders.manage')).toBe(false);
  });
});
