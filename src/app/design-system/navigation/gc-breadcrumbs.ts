import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterLink, NavigationEnd, ActivatedRouteSnapshot } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

interface GcCrumb {
  title: string;
  link: string;
}

/** Route-driven breadcrumb; a componentless parent may supply an intermediate crumb. */
@Component({
  selector: 'gc-breadcrumbs',
  imports: [RouterLink],
  template: `
    <nav class="gc-crumbs" aria-label="Ruta de navegación">
      <a routerLink="/" aria-label="Inicio">Inicio</a>
      @for (crumb of crumbs(); track crumb.link) {
        <span class="gc-separator" aria-hidden="true">/</span>
        @if ($last) {
          <span aria-current="page" class="gc-current">{{ crumb.title }}</span>
        } @else {
          <a [routerLink]="crumb.link">{{ crumb.title }}</a>
        }
      }
    </nav>
  `,
  styles: [ `
    .gc-crumbs { display:flex; flex-wrap:wrap; align-items:center; gap:.5rem; min-width:0; font-size:.875rem; }
    .gc-crumbs a { color:var(--gc-on-surface-variant); text-decoration:none; }
    .gc-crumbs a:hover { text-decoration:underline; }
    .gc-separator { color:var(--gc-outline); }
    .gc-current { font-weight:650; color:var(--gc-on-surface); }
    @media (max-width:480px) { .gc-crumbs { font-size:.8rem; gap:.3rem; } }
  ` ],
})
export class GcBreadcrumbs {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly crumbs = signal<GcCrumb[]>([]);

  constructor() {
    this.update();
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.update());
  }

  private update(): void {
    const result: GcCrumb[] = [];
    let current: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let path = '';
    while (current) {
      const part = current.url.map((segment) => segment.path).join('/');
      if (part) path += '/' + part;
      const title: unknown = current.data['breadcrumb'];
      if (typeof title === 'string' && title.trim() && path) {
        result.push({ title, link: path });
      }
      current = current.firstChild;
    }
    this.crumbs.set(result);
  }
}
