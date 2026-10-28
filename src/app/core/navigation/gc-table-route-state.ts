import { Injectable, computed, inject } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

export interface GcTableQuery {
  search: string;
  category: string;
  index: number;
  size: number;
  sortKey: string | null;
  direction: 'asc' | 'desc' | null;
}

const SIZES = [5, 10, 25, 50];

export function parseGcTableQuery(map: ParamMap): GcTableQuery {
  const page = Number(map.get('page'));
  const rawSize = Number(map.get('size'));
  const sort = map.get('sort') ?? '';
  const match = /^([a-z][a-z0-9_-]{0,39})\.(asc|desc)$/i.exec(sort);
  return {
    search: (map.get('search') ?? '').slice(0, 120),
    category: (map.get('category') ?? '').slice(0, 60),
    index: Number.isSafeInteger(page) && page >= 1 && page <= 100000 ? page - 1 : 0,
    size: SIZES.includes(rawSize) ? rawSize : 5,
    sortKey: match?.[1] ?? null,
    direction: match ? match[2] as 'asc' | 'desc' : null,
  };
}

/**
 * Feature-scoped route state. URL is the source of truth, including back/forward.
 * All navigation updates use queryParamsHandling=merge to preserve unrelated params.
 */
@Injectable()
export class GcTableRouteState {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly map = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly query = computed(() => parseGcTableQuery(this.map()));

  async patch(patch: Partial<GcTableQuery>, replaceUrl = false): Promise<boolean> {
    const next = { ...this.query(), ...patch };
    const sort = next.sortKey && next.direction ? next.sortKey + '.' + next.direction : null;
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: next.index > 0 ? next.index + 1 : null,
        size: next.size !== 5 ? next.size : null,
        search: next.search.trim() || null,
        category: next.category || null,
        sort,
      },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  reset(): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: null, size: null, search: null, category: null, sort: null },
      queryParamsHandling: 'merge',
    });
  }
}
