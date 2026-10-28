import { convertToParamMap } from '@angular/router';
import { parseGcTableQuery } from './gc-table-route-state';

describe('parseGcTableQuery', () => {
  it('restores valid pagination, search, and sort', () => {
    const data = parseGcTableQuery(convertToParamMap({
      page: '3', size: '25', search: 'cafe', sort: 'name.desc', category: 'Bebidas',
    }));
    expect(data).toEqual({
      index: 2, size: 25, search: 'cafe', sortKey: 'name', direction: 'desc', category: 'Bebidas',
    });
  });
  it('clamps invalid URL values to defaults', () => {
    const data = parseGcTableQuery(convertToParamMap({
      page: '-4', size: '999', sort: 'bad<script>.asc',
    }));
    expect(data.index).toBe(0);
    expect(data.size).toBe(5);
    expect(data.sortKey).toBeNull();
  });
});
