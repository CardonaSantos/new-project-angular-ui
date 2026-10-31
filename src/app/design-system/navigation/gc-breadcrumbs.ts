import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterLink, NavigationEnd, ActivatedRouteSnapshot } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

export interface GcCrumb {
  title: string;
  link: string;
}

/**
 * Breadcrumbs follow the actual ActivatedRoute tree, including componentless
 * parents. Every feature owns its route labels; the shared shell owns display.
 */
export function gcBuildBreadcrumbs(root: ActivatedRouteSnapshot): GcCrumb[] {
  const result: GcCrumb[] = [{ title: 'Inicio', link: '/workspace' }];
  let current: ActivatedRouteSnapshot | null = root;
  let path = '';

  while (current) {
    const segment = current.url.map(item => item.path).join('/');
    if (segment) path += '/' + segment;

    const label: unknown = current.data['breadcrumb'];
    if (typeof label === 'string' && label.trim() && path && path !== '/workspace') {
      // A componentless route may share its final URL with an empty-path child.
      // Only one breadcrumb per navigable URL.
      if (result[result.length - 1]?.link === path) {
        result[result.length - 1] = { title: label, link: path };
      } else {
        result.push({ title: label, link: path });
      }
    }
    current = current.firstChild;
  }

  return result;
}

@Component({
  selector: 'gc-breadcrumbs',
  imports: [RouterLink],
  template: `
    <nav class="gc-crumbs" aria-label="Ruta de navegación">
      <ol class="gc-crumb-list">
        @for (crumb of crumbs(); track crumb.link) {
          <li class="gc-crumb-item">
            @if (!$first) {
              <span class="gc-separator" aria-hidden="true">/</span>
            }
            @if ($last) {
              <span aria-current="page" class="gc-current">{{ crumb.title }}</span>
            } @else {
              <a [routerLink]="crumb.link">{{ crumb.title }}</a>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: [`
    :host { display:block; min-width:0; max-width:100%; }
    .gc-crumbs { min-width:0; max-width:100%; font-size:.875rem; }
    .gc-crumb-list { display:flex; flex-wrap:wrap; align-items:center; gap:.25rem .55rem;
      list-style:none; margin:0; padding:0; min-width:0; }
    .gc-crumb-item { display:inline-flex; align-items:center; gap:.55rem; min-height:1.75rem; }
    .gc-crumbs a { color:var(--gc-on-surface-variant); text-decoration:none;
      text-underline-offset:.18rem; border-radius:.15rem; }
    .gc-crumbs a:hover { text-decoration:underline; }
    .gc-crumbs a:focus-visible { outline:2px solid var(--gc-primary);
      outline-offset:3px; text-decoration:underline; }
    .gc-separator { color:var(--gc-outline); user-select:none; }
    .gc-current { font-weight:650; color:var(--gc-on-surface); }
    @media (max-width:480px) {
      .gc-crumbs { font-size:.8rem; }
      .gc-crumb-list { column-gap:.35rem; }
      .gc-crumb-item { gap:.35rem; }
    }
  `],
})
export class GcBreadcrumbs {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly crumbs = signal<GcCrumb[]>([]);

  constructor() {
    this.update();
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.update());
  }

  private update(): void {
    this.crumbs.set(gcBuildBreadcrumbs(this.router.routerState.snapshot.root));
  }
}
