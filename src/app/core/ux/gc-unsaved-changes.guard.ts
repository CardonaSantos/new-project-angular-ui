import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmDialogService } from '../../design-system/confirm-dialog/confirm-dialog.service';

export interface GcDirtyAware {
  hasUnsavedChanges(): boolean;
}

/** Router guard, not a data synchronization mechanism. */
export const gcUnsavedChangesGuard: CanDeactivateFn<GcDirtyAware> = (component) =>
  !component.hasUnsavedChanges() || inject(ConfirmDialogService).confirm({
    title: 'Cambios sin guardar',
    message: 'Si sales de esta página, perderás los cambios que no guardaste.',
    confirmText: 'Salir sin guardar',
    danger: true,
  });
