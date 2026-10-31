import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GcSessionService } from '../../../core/auth/gc-session.service';
import { gcErrorMessage } from '../../../core/http/api-error';
import { GcButtonDirective } from '../../../design-system/components/button/gc-button.directive';

@Component({
  selector: 'gc-login-page',
  imports: [ReactiveFormsModule, GcButtonDirective],
  template: `
    <main class="gc-auth-page">
      <section class="gc-surface gc-auth-card" aria-labelledby="login-title">
        <p class="gc-muted">GASTRO CORE</p>
        <h1 id="login-title">Iniciar sesión</h1>
        <p class="gc-muted">Accede con las credenciales asignadas por el administrador.</p>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label for="gc-login-email">Correo electrónico</label>
          <input id="gc-login-email" type="email" formControlName="email" autocomplete="username"
            [attr.aria-invalid]="form.controls.email.invalid && form.controls.email.touched" />
          @if (form.controls.email.invalid && form.controls.email.touched) {
            <small class="gc-error-text">Introduce un correo válido.</small>
          }
          <label for="gc-login-password">Contraseña</label>
          <input id="gc-login-password" type="password" formControlName="password"
            autocomplete="current-password" />
          @if (error()) { <p role="alert" class="gc-error-text">{{ error() }}</p> }
          <button gcButton type="submit" block [disabled]="loading()">
            {{ loading() ? 'Verificando…' : 'Iniciar sesión' }}
          </button>
        </form>
      </section>
    </main>
  `,
  styles: [`
    .gc-auth-page { display:grid; min-height:100dvh; place-items:center; padding:1rem; }
    .gc-auth-card { width:min(100%,28rem); }
    h1 { margin:0 0 .5rem; }
    form { display:grid; gap:.65rem; margin-top:1.25rem; }
    input { width:100%; min-height:var(--gc-control-height); padding:.6rem .75rem;
      border-radius:calc(var(--gc-radius) * .65); border:1px solid var(--gc-outline);
      color:var(--gc-on-surface); background:var(--gc-surface); }
    label { font-weight:600; font-size:.875rem; }
    .gc-error-text { color:var(--gc-error); margin:.15rem 0; }
  `],
})
export class GcLoginPage {
  private readonly session = inject(GcSessionService);
  private readonly router = inject(Router);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });

  protected async submit(): Promise<void> {
    if (this.loading()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.error.set(null);
    this.loading.set(true);
    try {
      const result = await firstValueFrom(this.session.login(this.form.getRawValue()));
      await this.router.navigateByUrl(result.user.debeCambiarContrasena ? '/change-password' : '/workspace');
    } catch (error: unknown) {
      this.error.set(gcErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
