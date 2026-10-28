import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyForm } from '@ngx-formly/core';
import { z } from 'zod';
import { ConfirmDialogService } from '../confirm-dialog/confirm-dialog.service';
import { GcFormActions } from './gc-form-actions';
import { GcFormErrorSummary } from './gc-form-error-summary';
import { GcFormReview, GcReviewField } from './gc-form-review';
import { GcFormIssue, gcFieldMessages, gcValidateSchema } from './gc-validation';

export interface GcWizardStep {
  id: string;
  title: string;
  description?: string;
  fields: FormlyFieldConfig[];
}

/** Formly wizard with step-level validation and final Zod cross-field validation. */
@Component({
  selector: 'gc-form-wizard',
  imports: [FormlyForm, GcFormActions, GcFormErrorSummary, GcFormReview],
  templateUrl: './gc-form-wizard.html',
  styleUrl: './gc-form-wizard.scss',
})
export class GcFormWizard implements OnInit {
  private readonly confirmation = inject(ConfirmDialogService);
  readonly steps = input.required<readonly GcWizardStep[]>();
  readonly model = input.required<Record<string, unknown>>();
  readonly schema = input<z.ZodType | null>(null);
  readonly reviewFields = input.required<readonly GcReviewField[]>();
  readonly confirmationTitle = input('Confirmar formulario');
  readonly completed = output<Record<string, unknown>>();

  protected readonly form = new FormGroup({});
  readonly index = signal(0);
  readonly busy = signal(false);
  readonly issues = signal<readonly GcFormIssue[]>([]);
  readonly count = computed(() => this.steps().length);
  readonly reviewing = computed(() => this.index() === this.count());
  readonly currentFields = computed(() => this.steps()[this.index()]?.fields ?? []);
  private snapshot = '';

  ngOnInit(): void {
    this.snapshot = JSON.stringify(this.model());
  }

  hasUnsavedChanges(): boolean {
    return this.snapshot !== JSON.stringify(this.model());
  }

  previous(): void {
    if (this.busy() || this.index() === 0) return;
    this.index.update((step) => step - 1);
    this.issues.set([]);
  }

  advance(): void {
    if (this.busy() || this.reviewing()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      const labels = Object.fromEntries(this.reviewFields().map((field) => [field.key, field.label]));
      this.issues.set(gcFieldMessages(this.form, labels));
      return;
    }
    this.issues.set([]);
    this.index.update((step) => Math.min(this.count(), step + 1));
  }

  selectIssue(issue: GcFormIssue): void {
    const step = this.steps().findIndex((candidate) =>
      candidate.fields.some((field) => String(field.key) === issue.field));
    if (step >= 0 && step !== this.index()) this.index.set(step);
  }

  async finish(): Promise<void> {
    if (!this.reviewing() || this.busy()) return;
    const schema = this.schema();
    if (schema) {
      const result = gcValidateSchema(schema, this.model());
      if (!result.valid) {
        this.issues.set(result.issues);
        this.selectIssue(result.issues[0]);
        return;
      }
    }
    this.busy.set(true);
    try {
      const confirmed = await this.confirmation.confirm({
        title: this.confirmationTitle(),
        message: 'Revisa los datos: esta demostración no enviará información al servidor.',
        confirmText: 'Confirmar',
      });
      if (!confirmed) return;
      const value = { ...this.model() };
      this.completed.emit(value);
      this.snapshot = JSON.stringify(this.model());
      this.form.markAsPristine();
      this.issues.set([]);
    } finally {
      this.busy.set(false);
    }
  }
}
