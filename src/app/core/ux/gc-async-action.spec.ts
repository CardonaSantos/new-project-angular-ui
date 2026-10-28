import { GcAsyncAction } from './gc-async-action';

describe('GcAsyncAction', () => {
  it('blocks concurrent operations, then releases loading state', async () => {
    const action = new GcAsyncAction();
    let release: ((value: string) => void) | undefined;
    const first = action.run(() => new Promise<string>((resolve) => { release = resolve; }));
    const duplicate = await action.run(() => Promise.resolve('duplicate'));
    expect(duplicate).toEqual({ ok: false, reason: 'busy' });
    expect(action.pending()).toBe(true);
    release?.('ok');
    expect(await first).toEqual({ ok: true, value: 'ok' });
    expect(action.status()).toBe('success');
  });

  it('returns error state without throwing to templates', async () => {
    const action = new GcAsyncAction();
    const result = await action.run(async () => { throw Error('demo'); });
    expect(result.ok).toBe(false);
    expect(action.status()).toBe('error');
  });
});
