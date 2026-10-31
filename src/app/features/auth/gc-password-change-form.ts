import { Component, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { GcSessionService } from '../../core/auth/gc-session.service';
import { gcErrorMessage } from '../../core/http/api-error';
import { GcAsyncAction } from '../../core/ux/gc-async-action';
import { GcButtonDirective } from '../../design-system/components/button/gc-button.directive';
import { GcPasswordField } from '../../design-system/forms/gc-password-field';

@Component({
  selector: 'gc-password-change-form',
  imports: [ReactiveFormsModule, GcPasswordField, GcButtonDirective],
  template: `
    <form class="gc-password-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <gc-password-field inputId="gc-old-password" label="Contraseña actual"
        [control]="form.controls.oldPassword" autocomplete="current-password"
        [errorText]="fieldError('oldPassword')" />
      <gc-password-field inputId="gc-new-password" label="Nueva contraseña"
        [control]="form.controls.newPassword" autocomplete="new-password"
        [errorText]="fieldError('newPassword')" />
      <gc-password-field inputId="gc-confirm-password" label="Confirmar contraseña"
        [control]="form.controls.confirmation" autocomplete="new-password"
        [errorText]="fieldError('confirmation')" />
      @if (error(); as message) { <p class="gc-form-alert" role="alert">{{ message }}</p> }
      <button gcButton type="submit" [disabled]="action.pending()" [attr.aria-busy]="action.pending()">
        {{ action.pending() ? 'Guardando…' : 'Guardar contraseña' }}
      </button>
    </form>
  `,
  styles: [`
    .gc-password-form { display:grid; gap:1.1rem; min-width:0; }
    .gc-password-form button { justify-self:stretch; }
    .gc-form-alert { border:1px solid var(--gc-error); color:var(--gc-on-surface);
      padding:.7rem .85rem; border-radius:.5rem; font-size:.875rem; margin:0;
      overflow-wrap:anywhere; }
  `],
})
export class GcPasswordChangeForm {
  private readonly session = inject(GcSessionService);
  readonly changed = output<void>();
  readonly action = new GcAsyncAction();
  readonly error = signal<string | null>(null);
  protected readonly form = new FormGroup({
    oldPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12)],
    }),
    confirmation: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });

  protected fieldError(field: 'oldPassword' | 'newPassword' | 'confirmation'): string | null {
    const control = this.form.controls[field];
    if (!control.touched) return null;
    if (control.hasError('required')) return 'Campo obligatorio.';
    if (control.hasError('minlength')) return 'Mínimo 12 caracteres.';
    if (field === 'confirmation' &&
        control.value !== this.form.controls.newPassword.value) return 'Las contraseñas no coinciden.';
    return null;
  }

  protected async submit(): Promise<void> {
    this.error.set(null);
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const { oldPassword, newPassword, confirmation } = this.form.getRawValue();
    if (newPassword !== confirmation) {
      this.form.controls.confirmation.markAsTouched();
      return;
    }
    const outcome = await this.action.run(() =>
      firstValueFrom(this.session.changePassword({ oldPassword, newPassword })));
    if (!outcome.ok) {
      if (outcome.reason === 'error') this.error.set(gcErrorMessage(outcome.error));
      return;
    }
    this.form.reset();
    this.changed.emit();
  }
}
