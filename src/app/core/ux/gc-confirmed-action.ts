import { computed, signal } from '@angular/core';
import { GcAsyncAction, type GcActionResult } from './gc-async-action';
import type { ConfirmDialogOptions, ConfirmDialogService } from '../../design-system/confirm-dialog/confirm-dialog.service';

/** Confirm a persistent change and prevent duplicate dialogs or submissions. */
export class GcConfirmedAction extends GcAsyncAction {
  readonly confirming = signal(false);
  readonly busy = computed(() => this.confirming() || this.pending());

  async runConfirmed<T>(
    dialog: ConfirmDialogService,
    options: ConfirmDialogOptions,
    operation: () => Promise<T>,
  ): Promise<GcActionResult<T> | null> {
    if (this.busy()) return { ok: false, reason: 'busy' };
    this.confirming.set(true);
    try {
      if (!await dialog.confirm(options)) return null;
      return await this.run(operation);
    } finally {
      this.confirming.set(false);
    }
  }
}
