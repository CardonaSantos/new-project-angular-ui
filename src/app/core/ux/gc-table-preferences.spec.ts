import { GcTablePreferences } from './gc-table-preferences';

describe('GcTablePreferences', () => {
  it('hides and reorders columns without changing the canonical set', () => {
    const prefs = new GcTablePreferences(['name', 'price', 'status']);
    prefs.toggle('price');
    prefs.move('status', -1);
    expect(prefs.visible()).toEqual(['status', 'name']);
    prefs.reset();
    expect(prefs.visible()).toEqual(['name', 'price', 'status']);
  });
});
