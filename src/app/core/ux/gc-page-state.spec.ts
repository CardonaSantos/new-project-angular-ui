import { GcPageState } from './gc-page-state';

describe('GcPageState', () => {
  it('distinguishes ready, empty and error', async () => {
    const state = new GcPageState<string[]>();
    await state.load(async () => ['record'], (rows) => rows.length === 0);
    expect(state.status()).toBe('ready');
    await state.load(async () => [], (rows) => rows.length === 0);
    expect(state.status()).toBe('empty');
    await state.load(async () => { throw new Error('demo'); });
    expect(state.status()).toBe('error');
  });

  it('ignores outdated responses', async () => {
    const state = new GcPageState<string[]>();
    let complete: ((value: string[]) => void) | undefined;
    const first = state.load(() => new Promise<string[]>((resolve) => { complete = resolve; }));
    await state.load(async () => ['new']);
    complete?.(['old']);
    await first;
    expect(state.data()).toEqual(['new']);
  });
});
