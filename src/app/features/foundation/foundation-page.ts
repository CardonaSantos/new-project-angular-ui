import { Component, inject } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormlyFieldConfig, FormlyForm } from '@ngx-formly/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialog } from '../../design-system/confirm-dialog/confirm-dialog';
import { AppearancePreferences, Theme } from '../../core/appearance/appearance-preferences';

@Component({
  selector: 'app-foundation-page',
  imports: [ReactiveFormsModule, FormlyForm, MatButtonModule, MatCardModule, MatDialogModule, MatSnackBarModule],
  templateUrl: './foundation-page.html',
  styleUrl: './foundation-page.scss',
})
export class FoundationPage {
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(MatSnackBar);
  protected readonly appearance = inject(AppearancePreferences);
  protected readonly form = new FormGroup({});
  protected readonly model = { nombre: '', categoria: 'BEBIDA' };
  protected readonly fields: FormlyFieldConfig[] = [
    {
      key: 'nombre',
      type: 'input',
      props: { label: 'Nombre (ejemplo)', required: true, minLength: 2, placeholder: 'Capuchino' },
    },
    {
      key: 'categoria',
      type: 'select',
      defaultValue: 'BEBIDA',
      props: {
        label: 'Categoría de ejemplo',
        required: true,
        options: [{ label: 'Bebida', value: 'BEBIDA' }, { label: 'Alimento', value: 'ALIMENTO' }],
      },
    },
    {
      key: 'observaciones',
      type: 'textarea',
      props: { label: 'Observaciones' },
      expressions: { hide: (field) => field.model?.categoria !== 'ALIMENTO' },
    },
  ];

  protected setTheme(value: string): void {
    if (value === 'system' || value === 'dark' || value === 'light') {
      this.appearance.theme.set(value as Theme);
    }
  }

  protected validateExample(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.snackbar.open('Ejemplo válido; no se envían datos al backend.', 'Cerrar', { duration: 3500 });
  }

  protected confirmExample(): void {
    this.dialog.open(ConfirmDialog, { data: { title: 'Confirmar ejemplo', message: 'Este diálogo no contiene formularios.' } });
  }
}
