import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { GcButtonDirective } from '../components/button/gc-button.directive';
import type { ConfirmDialogOptions } from './confirm-dialog.service';

@Component({
  selector: 'gc-confirm-dialog',
  imports: [MatDialogModule, GcButtonDirective],
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialog {
  readonly data = inject<ConfirmDialogOptions>(MAT_DIALOG_DATA);
}
