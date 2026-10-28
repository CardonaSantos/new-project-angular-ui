import { Component, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MaskitoOptions } from '@maskito/core';
import { z } from 'zod';
import { GcPageHeader } from '../../design-system/components/page-header/gc-page-header';
import { GcButtonDirective } from '../../design-system/components/button/gc-button.directive';
import { GcFormWizard, GcWizardStep } from '../../design-system/forms/gc-form-wizard';
import { GcMaskedInput } from '../../design-system/forms/gc-masked-input';
import { GcFileUpload } from '../../design-system/forms/gc-file-upload';
import { GcFormErrorSummary } from '../../design-system/forms/gc-form-error-summary';
import { GcFormIssue, gcApplyServerErrors, gcFieldMessages } from '../../design-system/forms/gc-validation';
import { GcReviewField } from '../../design-system/forms/gc-form-review';
import { gcSelectField, gcTextField } from '../../design-system/forms/formly-field-factory';
import { GcDirtyAware } from '../../core/ux/gc-unsaved-changes.guard';
import { GcNotificationService } from '../../core/ux/gc-notification.service';

const articleSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  categoria: z.enum(['Bebida', 'Alimento', 'Insumo']),
  codigo: z.string().trim().min(3, 'El código requiere al menos 3 caracteres.'),
  costo: z.coerce.number().min(0, 'El costo debe ser positivo o cero.'),
  precio: z.coerce.number().gt(0, 'El precio debe ser mayor que cero.'),
  observaciones: z.string().optional(),
}).superRefine((data, context) => {
  if (data.precio < data.costo) {
    context.addIssue({
      code: 'custom',
      path: ['precio'],
      message: 'El precio no puede ser menor que el costo.',
    });
  }
});

@Component({
  selector: 'gc-form-lab',
  imports: [
    RouterLink, ReactiveFormsModule, GcPageHeader, GcButtonDirective, GcFormWizard,
    GcMaskedInput, GcFileUpload, GcFormErrorSummary,
  ],
  templateUrl: './form-lab.html',
  styleUrl: './form-lab.scss',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class GcFormLab implements GcDirtyAware {
  private readonly notifications = inject(GcNotificationService);
  private readonly wizard = viewChild(GcFormWizard);
  protected readonly model: Record<string, unknown> = {
    nombre: '', categoria: 'Bebida', codigo: '', costo: 0, precio: 0, observaciones: '',
  };
  protected readonly schema = articleSchema;
  protected readonly steps: readonly GcWizardStep[] = [
    {
      id: 'identidad',
      title: 'Identificación',
      description: 'Define cómo se identificará el artículo.',
      fields: [
        { ...gcTextField('nombre', 'Nombre del artículo', true),
          props: { label: 'Nombre del artículo', required: true, minLength: 2, placeholder: 'Cappuccino clásico' } },
        gcSelectField('categoria', 'Categoría', [
          { label: 'Bebida', value: 'Bebida' },
          { label: 'Alimento', value: 'Alimento' },
          { label: 'Insumo', value: 'Insumo' },
        ], true),
        { ...gcTextField('codigo', 'Código interno', true),
          props: { label: 'Código interno', required: true, minLength: 3, placeholder: 'BEB-001' } },
      ],
    },
    {
      id: 'valores',
      title: 'Valores',
      description: 'El precio no podrá ser inferior al costo al revisar el formulario.',
      fields: [
        { key: 'costo', type: 'input', props: { label: 'Costo (demo)', type: 'number', required: true, min: 0 } },
        { key: 'precio', type: 'input', props: { label: 'Precio (demo)', type: 'number', required: true, min: 0.01 } },
      ],
    },
    {
      id: 'detalles',
      title: 'Detalles',
      description: 'Información opcional que acompañará al registro.',
      fields: [
        { key: 'observaciones', type: 'textarea', props: { label: 'Observaciones', rows: 3 } },
      ],
    },
  ];
  protected readonly reviewFields: readonly GcReviewField[] = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'categoria', label: 'Categoría' },
    { key: 'codigo', label: 'Código' },
    { key: 'costo', label: 'Costo' },
    { key: 'precio', label: 'Precio' },
    { key: 'observaciones', label: 'Observaciones' },
  ];

  protected readonly phone = new FormControl('', { nonNullable: true });
  protected readonly phoneMask: MaskitoOptions = { mask: /^\d{0,8}$/ };
  protected readonly selectedFiles = signal<readonly File[]>([]);
  protected readonly fileDirty = signal(false);
  protected readonly serverForm = new FormGroup({
    email: new FormControl('demo@ejemplo.com', { nonNullable: true, validators: [Validators.email] }),
  });
  protected readonly serverIssues = signal<readonly GcFormIssue[]>([]);

  hasUnsavedChanges(): boolean {
    return Boolean(this.wizard()?.hasUnsavedChanges() || this.phone.dirty || this.fileDirty());
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  protected completed(value: Record<string, unknown>): void {
    this.phone.markAsPristine();
    this.fileDirty.set(false);
    this.notifications.show('Confirmación recibida. ' + String(value['nombre']) + ' no se guardó en el servidor.', 'success');
  }

  protected onFiles(files: readonly File[]): void {
    this.selectedFiles.set(files);
    this.fileDirty.set(true);
  }

  protected mockServerError(): void {
    const normalized: GcFormIssue[] = [
      { field: 'email', message: 'Este correo ya está registrado (respuesta simulada).' },
    ];
    gcApplyServerErrors(this.serverForm, normalized);
    this.serverIssues.set(gcFieldMessages(this.serverForm, { email: 'Correo' }));
  }

  protected clearServerError(): void {
    this.serverForm.controls.email.setErrors(null);
    this.serverIssues.set([]);
  }
}
