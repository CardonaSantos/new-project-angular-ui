import { vi } from 'vitest';
import type { ConfirmDialogService } from '../../design-system/confirm-dialog/confirm-dialog.service';
import { GcConfirmedAction } from './gc-confirmed-action';

const dialogs = (confirm: (value: { title: string }) => Promise<boolean>) =>
  ({ confirm } as ConfirmDialogService);

describe('GcConfirmedAction', () => {
  it('cancels without sending a write', async () => {
    const action = new GcConfirmedAction();
    const write = vi.fn(async () => 'saved');
    expect(await action.runConfirmed(dialogs(async () => false),
      { title: 'Guardar' }, write)).toBeNull();
    expect(write).not.toHaveBeenCalled();
    expect(action.busy()).toBe(false);
  });
  it('performs a write once after confirmation', async () => {
    const action = new GcConfirmedAction();
    const write = vi.fn(async () => 'saved');
    expect(await action.runConfirmed(dialogs(async () => true),
      { title: 'Guardar' }, write)).toEqual({ ok: true, value: 'saved' });
    expect(write).toHaveBeenCalledTimes(1);
  });
  it('prevents multiple dialogs from rapid clicks', async () => {
    const action = new GcConfirmedAction();
    let answer!: (ok: boolean) => void;
    const hold = new Promise<boolean>(resolve => { answer = resolve; });
    const confirm = vi.fn(() => hold);
    const write = vi.fn(async () => 'done');
    const first = action.runConfirmed(dialogs(confirm), { title: 'Crear' }, write);
    expect(await action.runConfirmed(dialogs(confirm), { title: 'Crear' }, write))
      .toEqual({ ok: false, reason: 'busy' });
    expect(confirm).toHaveBeenCalledTimes(1);
    answer(true);
    expect(await first).toEqual({ ok: true, value: 'done' });
    expect(write).toHaveBeenCalledTimes(1);
  });
  it('clears busy on write failure', async () => {
    const action = new GcConfirmedAction();
    const result = await action.runConfirmed(dialogs(async () => true),
      { title: 'Guardar' }, async () => { throw Error('Conflict'); });
    expect(result?.ok).toBe(false);
    expect(action.busy()).toBe(false);
  });
});
