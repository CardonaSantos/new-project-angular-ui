import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FormlyFieldConfig, FormlyForm } from '@ngx-formly/core';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ThemeManagerService } from '../../design-system/themes/theme-manager.service';
import {
  THEME_PRESETS,
  ThemePreference,
  ThemePresetId,
} from '../../design-system/themes/theme-presets';
import { GcButtonDirective } from '../../design-system/components/button/gc-button.directive';
import { GcStatusBadge } from '../../design-system/components/status-badge/gc-status-badge';
import { GcPageHeader } from '../../design-system/components/page-header/gc-page-header';
import { GcEmptyState } from '../../design-system/components/empty-state/gc-empty-state';
import { ConfirmDialogService } from '../../design-system/confirm-dialog/confirm-dialog.service';
import { gcTextField, gcSelectField } from '../../design-system/forms/formly-field-factory';

@Component({
  selector: 'gc-foundation-page',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    FormlyForm,
    MatCardModule,
    GcButtonDirective,
    GcStatusBadge,
    GcPageHeader,
    GcEmptyState,
  ],
  templateUrl: './foundation-page.html',
  styleUrl: './foundation-page.scss',
})
export class FoundationPage {
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly theme = inject(ThemeManagerService);
  protected readonly presets = Object.values(THEME_PRESETS);
  protected readonly menuOpen = signal(false);

  protected readonly form = new FormGroup({});
  protected readonly model: Record<string, unknown> = { nombre: '', categoria: 'BEBIDA' };
  protected readonly fields: FormlyFieldConfig[] = [
    {
      ...gcTextField('nombre', 'Nombre del producto', true),
      props: {
        label: 'Nombre del producto',
        placeholder: 'Cappuccino clásico',
        required: true,
        minLength: 2,
      },
    },
    gcSelectField('categoria', 'Categoría', [
      { label: 'Bebida', value: 'BEBIDA' },
      { label: 'Alimento', value: 'ALIMENTO' },
    ], true),
    {
      key: 'observaciones',
      type: 'textarea',
      props: { label: 'Observaciones', rows: 2 },
      expressions: { hide: (field) => field.model?.categoria !== 'ALIMENTO' },
    },
  ];

  protected onPreset(value: string): void {
    if (value === 'cappuccino' || value === 'ocean') this.theme.setPreset(value as ThemePresetId);
  }

  protected onMode(value: string): void {
    if (value === 'light' || value === 'dark' || value === 'system') this.theme.setMode(value as ThemePreference);
  }

  protected onScale(value: string): void {
    this.theme.setFontScale(Number(value));
  }

  protected onRadius(value: string): void {
    this.theme.setCornerRadius(Number(value));
  }

  protected onAccent(value: string): void {
    this.theme.setPrimaryHex(value);
  }

  protected validateForm(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.snackBar.open('Formulario válido. No se guardaron datos.', 'Cerrar', { duration: 3500 });
  }

  protected async confirmExample(): Promise<void> {
    const accepted = await this.confirmDialog.confirm({
      title: 'Confirmación de ejemplo',
      message: 'Los diálogos solo confirman operaciones. Ningún dato será modificado.',
      confirmText: 'Confirmar',
    });
    if (accepted) this.snackBar.open('Ejemplo confirmado', 'Cerrar', { duration: 3000 });
  }
}
