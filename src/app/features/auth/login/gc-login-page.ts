import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GcSessionService } from '../../../core/auth/gc-session.service';
import { gcErrorMessage } from '../../../core/http/api-error';
import { GcBrandingService } from '../../../core/branding/gc-branding.service';
import { GcAsyncAction } from '../../../core/ux/gc-async-action';
import { GcBrandLogo } from '../../../design-system/branding/gc-brand-logo';
import { GcButtonDirective } from '../../../design-system/components/button/gc-button.directive';
import { GcPasswordField } from '../../../design-system/forms/gc-password-field';

@Component({
  selector: 'gc-login-page',
  imports: [ReactiveFormsModule, GcBrandLogo, GcButtonDirective, GcPasswordField],
  template: `
    <main class="gc-auth-screen">
      <div class="gc-auth-wrap">
        <div class="gc-auth-brand">
          <gc-brand-logo [name]="branding.name()" [logoUrl]="branding.logoUrl()" />
        </div>
        <section class="gc-auth-card" aria-labelledby="gc-login-title">
          <h1 id="gc-login-title">Iniciar sesión</h1>
          <form class="gc-auth-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="gc-auth-field">
              <label for="gc-login-email">Correo electrónico</label>
              <input class="gc-auth-input" id="gc-login-email" type="email"
                formControlName="email" autocomplete="username" inputmode="email"
                [attr.aria-invalid]="form.controls.email.invalid && form.controls.email.touched ? 'true' : null"
                [attr.aria-describedby]="emailError() ? 'gc-email-error' : null" />
              @if (emailError(); as error) {
                <small id="gc-email-error" class="gc-auth-error">{{ error }}</small>
              }
            </div>
            <gc-password-field
              inputId="gc-login-password"
              label="Contraseña"
              [control]="form.controls.password"
              [errorText]="passwordError()" />
            @if (error(); as message) {
              <p class="gc-auth-alert" role="alert">{{ message }}</p>
            }
            <button gcButton [block]="true" type="submit" [disabled]="action.pending()"
              [attr.aria-busy]="action.pending()">
              {{ action.pending() ? 'Iniciando sesión…' : 'Entrar' }}
            </button>
          </form>
        </section>
      </div>
    </main>
  `,
  styleUrl: '../gc-auth-layout.scss',
})
export class GcLoginPage {
  protected readonly branding = inject(GcBrandingService);
  private readonly session = inject(GcSessionService);
  private readonly router = inject(Router);
  protected readonly action = new GcAsyncAction();
  protected readonly error = signal<string | null>(null);
  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });

  protected emailError(): string | null {
    const control = this.form.controls.email;
    if (!control.touched || !control.invalid) return null;
    return control.hasError('required') ? 'Introduce tu correo.' : 'Introduce un correo válido.';
  }
  protected passwordError(): string | null {
    const control = this.form.controls.password;
    return control.touched && control.hasError('required') ? 'Introduce tu contraseña.' : null;
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.error.set(null);
    const outcome = await this.action.run(() =>
      firstValueFrom(this.session.login(this.form.getRawValue())));
    if (!outcome.ok) {
      if (outcome.reason === 'error') this.error.set(gcErrorMessage(outcome.error));
      return;
    }
    this.form.controls.password.reset('');
    await this.router.navigateByUrl(
      outcome.value.user.debeCambiarContrasena ? '/change-password' : '/workspace',
    );
  }
}
