import { ActivatedRouteSnapshot, UrlSegment, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { GcBreadcrumbs, gcBuildBreadcrumbs } from './gc-breadcrumbs';
import { ORGANIZATION_ROUTES } from '../../features/organization/organization.routes';

/** Construct the same componentless route tree Angular exposes after navigation. */
function route(
  segments: string[],
  label?: string,
  child?: ActivatedRouteSnapshot,
): ActivatedRouteSnapshot {
  return {
    url: segments.map(part => new UrlSegment(part, {})),
    data: label ? { breadcrumb: label } : {},
    firstChild: child ?? null,
  } as unknown as ActivatedRouteSnapshot;
}

function organization(path: string, label: string, detail?: [string, string]) {
  const nested = detail ? route([detail[0]], detail[1]) : route([]);
  return route([], undefined,
    route([], undefined,
      route(['organization'], undefined, route([path], label, nested))));
}

describe('GcBreadcrumbs', () => {
  it('shows only Inicio for workspace, with no duplicate home level', () => {
    const root = route([], undefined,
      route([], undefined, route(['workspace'], 'Inicio')));
    expect(gcBuildBreadcrumbs(root)).toEqual([{ title: 'Inicio', link: '/workspace' }]);
  });

  it('links back through the real devices list before the create form', () => {
    expect(gcBuildBreadcrumbs(organization(
      'devices', 'Dispositivos', ['new', 'Nuevo dispositivo'],
    ))).toEqual([
      { title: 'Inicio', link: '/workspace' },
      { title: 'Dispositivos', link: '/organization/devices' },
      { title: 'Nuevo dispositivo', link: '/organization/devices/new' },
    ]);
  });

  it('supports details with a URL identifier without losing their parent list', () => {
    expect(gcBuildBreadcrumbs(organization(
      'branches', 'Sucursales', ['branch-123', 'Detalle de sucursal'],
    ))).toEqual([
      { title: 'Inicio', link: '/workspace' },
      { title: 'Sucursales', link: '/organization/branches' },
      { title: 'Detalle de sucursal', link: '/organization/branches/branch-123' },
    ]);
  });

  it('does not duplicate the list crumb for the empty-path child', () => {
    expect(gcBuildBreadcrumbs(organization('devices', 'Dispositivos'))).toEqual([
      { title: 'Inicio', link: '/workspace' },
      { title: 'Dispositivos', link: '/organization/devices' },
    ]);
  });

  it('handles other top-level and deeply nested views consistently', () => {
    expect(gcBuildBreadcrumbs(route([], undefined,
      route([], undefined, route(['account', 'security'], 'Seguridad'))))).toEqual([
      { title: 'Inicio', link: '/workspace' },
      { title: 'Seguridad', link: '/account/security' },
    ]);
    expect(gcBuildBreadcrumbs(route([], undefined,
      route([], undefined,
        route(['lab'], 'Laboratorio UX',
          route(['forms'], 'Formularios guiados'))))).map(x => x.title)).toEqual([
      'Inicio', 'Laboratorio UX', 'Formularios guiados',
    ]);
  });


  it('renders an ordered navigation trail with accessible current page and working parent links', async () => {
    await TestBed.configureTestingModule({
      imports: [GcBreadcrumbs],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(GcBreadcrumbs);
    fixture.componentInstance.crumbs.set([
      { title: 'Inicio', link: '/workspace' },
      { title: 'Dispositivos', link: '/organization/devices' },
      { title: 'Nuevo dispositivo', link: '/organization/devices/new' },
    ]);
    fixture.detectChanges();

    const nav = fixture.nativeElement.querySelector('nav') as HTMLElement;
    expect(nav.getAttribute('aria-label')).toBe('Ruta de navegación');
    expect(nav.querySelectorAll('ol > li').length).toBe(3);
    const links = Array.from(nav.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.map(a => a.getAttribute('href'))).toEqual([
      '/workspace', '/organization/devices',
    ]);
    const current = nav.querySelector('[aria-current="page"]') as HTMLElement;
    expect(current.tagName).toBe('SPAN');
    expect(current.textContent?.trim()).toBe('Nuevo dispositivo');
    expect(current.querySelector('a')).toBeNull();
    fixture.destroy();
  });

  it('keeps organization URLs and unsaved-changes guards unchanged', () => {
    for (const section of ['branches', 'devices']) {
      const parent = ORGANIZATION_ROUTES.find(r => r.path === section);
      expect(parent?.data?.['breadcrumb']).toBe(
        section === 'branches' ? 'Sucursales' : 'Dispositivos',
      );
      expect(parent?.children?.map(r => r.path)).toEqual(['', 'new', ':id']);
      expect(parent?.children?.[0].data?.['breadcrumb']).toBeUndefined();
      expect(parent?.children?.[1].canDeactivate?.length).toBe(1);
      expect(parent?.children?.[2].canDeactivate?.length).toBe(1);
    }
  });
});
