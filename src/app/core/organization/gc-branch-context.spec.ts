import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GcBranchContext } from './gc-branch-context';

describe('GcBranchContext', () => {
  it('keeps only server-granted branch capabilities and discards stale responses', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const branch = TestBed.inject(GcBranchContext);
    const mock = TestBed.inject(HttpTestingController);
    branch.load().subscribe();
    const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));
    mock.expectOne('/api/branches/my-access').flush({ data: [
      { id: 'b1', codigo: 'A', nombre: 'A', zonaHoraria: 'UTC', roles: [] },
      { id: 'b2', codigo: 'B', nombre: 'B', zonaHoraria: 'UTC', roles: [] },
    ] });
    await tick();
    mock.expectOne('/api/auth/capabilities?sucursalId=b1')
      .flush({ sucursalId: 'b1', permissions: ['inventory.read'] });
    await tick();
    expect(branch.has('inventory.read')).toBe(true);

    branch.select('b1').subscribe();
    branch.select('b2').subscribe();
    expect(branch.permissions()).toEqual([]);
    mock.expectOne('/api/auth/capabilities?sucursalId=b2')
      .flush({ sucursalId: 'b2', permissions: ['orders.read'] });
    mock.expectOne('/api/auth/capabilities?sucursalId=b1')
      .flush({ sucursalId: 'b1', permissions: ['inventory.read'] });
    await tick();
    expect(branch.branchId()).toBe('b2');
    expect(branch.has('orders.read')).toBe(true);
    expect(branch.has('inventory.read')).toBe(false);
    mock.verify();
  });
});
