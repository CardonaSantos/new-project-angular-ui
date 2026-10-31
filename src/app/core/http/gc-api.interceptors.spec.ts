import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GcSessionService } from '../auth/gc-session.service';
import { GcBranchContext } from '../organization/gc-branch-context';
import { GcNotificationService } from '../ux/gc-notification.service';
import { GC_BRANCH_REQUEST, GC_SILENT_ERROR } from './api-context';
import { GcApiError } from './api-error';
import { gcApiAuthInterceptor, gcApiErrorInterceptor, gcApiRefreshInterceptor } from './gc-api.interceptors';

const sessionResponse = (token = 'access-v1') => ({
  accessToken: token,
  tokenType: 'Bearer',
  expiresIn: 900,
  session: { id: 's1', expiresAt: '2026-11-07T00:00:00Z' },
  user: { id: 'u1', email: 'a@example.com', nombre: 'Operador', debeCambiarContrasena: false },
});
const branches = { data: [{ id: 'b1', codigo: 'CENTRAL', nombre: 'Central', zonaHoraria: 'America/Guatemala', roles: [] }] };

describe('Gastro Core HTTP interceptors', () => {
  let http: HttpClient;
  let mock: HttpTestingController;
  let session: GcSessionService;
  let branch: GcBranchContext;
  let notices: GcNotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([
          gcApiErrorInterceptor, gcApiAuthInterceptor, gcApiRefreshInterceptor,
        ])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(GcSessionService);
    branch = TestBed.inject(GcBranchContext);
    notices = TestBed.inject(GcNotificationService);
  });

  afterEach(() => mock.verify());

  const flushAsyncParsers = (): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, 0));

  async function logIn(): Promise<void> {
    session.login({ email: 'a@example.com', password: 'secret' }).subscribe();
    const login = mock.expectOne('/api/auth/login');
    expect(login.request.withCredentials).toBe(true);
    expect(login.request.headers.has('Authorization')).toBe(false);
    login.flush(sessionResponse());
    await flushAsyncParsers();
    mock.expectOne('/api/auth/me').flush({ user: sessionResponse().user, roles: [] });
    mock.expectOne('/api/branches/my-access').flush(branches);
    await flushAsyncParsers();
    mock.expectOne('/api/auth/capabilities?sucursalId=b1')
      .flush({ sucursalId: 'b1', permissions: ['inventory.read'] });
    await flushAsyncParsers();
    expect(session.authenticated()).toBe(true);
    expect(branch.has('inventory.read')).toBe(true);
  }

  it('attaches Bearer only to /api and branch header only with opt-in context', async () => {
    await logIn();
    http.get('/api/inventory/articles', {
      context: new HttpContext().set(GC_BRANCH_REQUEST, true),
    }).subscribe();
    const scoped = mock.expectOne('/api/inventory/articles');
    expect(scoped.request.headers.get('Authorization')).toBe('Bearer access-v1');
    expect(scoped.request.headers.get('x-sucursal-id')).toBe('b1');
    scoped.flush([]);

    http.get('/api/auth/me').subscribe();
    const unscoped = mock.expectOne('/api/auth/me');
    expect(unscoped.request.headers.has('x-sucursal-id')).toBe(false);
    unscoped.flush({ user: sessionResponse().user, roles: [] });

    http.get('https://example.org/external').subscribe();
    const external = mock.expectOne('https://example.org/external');
    expect(external.request.headers.has('Authorization')).toBe(false);
    external.flush({ ok: true });
  });

  it('rotates refresh cookie once for concurrent 401s and replays each request once', async () => {
    await logIn();
    const results: unknown[] = [];
    http.get('/api/orders').subscribe(value => results.push(value));
    http.get('/api/inventory/stock').subscribe(value => results.push(value));
    const order = mock.expectOne('/api/orders');
    const stock = mock.expectOne('/api/inventory/stock');
    order.flush({ message: 'Token caducado' }, { status: 401, statusText: 'Unauthorized' });
    stock.flush({ message: 'Token caducado' }, { status: 401, statusText: 'Unauthorized' });
    const refresh = mock.expectOne('/api/auth/refresh');
    expect(refresh.request.withCredentials).toBe(true);
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush(sessionResponse('access-v2'));
    await flushAsyncParsers();
    const orderRetry = mock.expectOne('/api/orders');
    const stockRetry = mock.expectOne('/api/inventory/stock');
    expect(orderRetry.request.headers.get('Authorization')).toBe('Bearer access-v2');
    expect(stockRetry.request.headers.get('Authorization')).toBe('Bearer access-v2');
    orderRetry.flush({ id: 'order' });
    stockRetry.flush({ data: [] });
    expect(results.length).toBe(2);
    expect(notices.notices()).toEqual([]);
  });

  it('surfaces a readable error and never retries 409 conflicts', async () => {
    await logIn();
    let error: unknown;
    http.post('/api/orders', { key: 'x' }).subscribe({ error: failure => { error = failure; } });
    mock.expectOne('/api/orders').flush(
      { message: 'La orden ya fue enviada' }, { status: 409, statusText: 'Conflict' },
    );
    expect(error).toBeInstanceOf(GcApiError);
    expect((error as GcApiError).message).toBe('La orden ya fue enviada');
    expect(notices.notices().at(-1)?.message).toBe('La orden ya fue enviada');
    mock.expectNone('/api/auth/refresh');
  });

  it('suppresses duplicate global toasts for inline form requests', () => {
    http.post('/api/auth/login', {}, {
      context: new HttpContext().set(GC_SILENT_ERROR, true),
    }).subscribe({ error: () => undefined });
    mock.expectOne('/api/auth/login').flush(
      { message: 'Credenciales inválidas' }, { status: 401, statusText: 'Unauthorized' },
    );
    expect(notices.notices()).toEqual([]);
  });

  it('revokes local credentials after failed refresh without replaying failed requests', async () => {
    await logIn();
    let error: unknown;
    http.get('/api/orders').subscribe({ error: failure => { error = failure; } });
    mock.expectOne('/api/orders').flush({}, { status: 401, statusText: 'Unauthorized' });
    mock.expectOne('/api/auth/refresh').flush(
      { message: 'Refresh token inválido' }, { status: 401, statusText: 'Unauthorized' },
    );
    await flushAsyncParsers();
    expect(session.accessToken()).toBeNull();
    expect(session.status()).toBe('expired');
    expect(error).toBeInstanceOf(GcApiError);
  });
});
