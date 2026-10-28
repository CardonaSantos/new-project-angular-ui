import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialog } from './confirm-dialog';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}

/** Confirmation-only. Dialogs must never be used for creating or editing data. */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly dialog = inject(MatDialog);

  async confirm(options: ConfirmDialogOptions): Promise<boolean> {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogOptions, boolean>(ConfirmDialog, {
      data: options,
      width: 'min(420px, calc(100vw - 2rem))',
      ariaLabel: options.title,
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}
