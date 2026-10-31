import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GcSessionService } from '../../../core/auth/gc-session.service';
import { gcErrorMessage } from '../../../core/http/api-error';
import { GcButtonDirective } from '../../../design-system/components/button/gc-button.directive';
import { GcNotificationService } from '../../../core/ux/gc-notification.service';

@Component({
  selector: 'gc-change-password-page',
  imports: [ReactiveFormsModule, GcButtonDirective],
  template: `
    <main class="gc-auth-page">
      <section class="gc-surface gc-auth-card" aria-labelledby="password-title">
        <h1 id="password-title">Cambiar contraseña temporal</h1>
        <p class="gc-muted">Por seguridad, crea una contraseña nueva de al menos 12 caracteres. Después deberás iniciar sesión nuevamente.</p>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label for="old-password">Contraseña actual</label>
          <input id="old-password" formControlName="oldPassword" type="password" autocomplete="current-password" />
          <label for="new-password">Nueva contraseña</label>
          <input id="new-password" formControlName="newPassword" type="password" autocomplete="new-password" />
          <label for="confirm-password">Confirmar contraseña nueva</label>
          <input id="confirm-password" formControlName="confirmation" type="password" autocomplete="new-password" />
          @if (error()) { <p role="alert" class="gc-error-text">{{ error() }}</p> }
          <button gcButton type="submit" [block]="true" [disabled]="loading()">
            {{ loading() ? 'Guardando…' : 'Cambiar contraseña' }}
          </button>
        </form>
      </section>
    </main>
  `,
  styles: [`
    .gc-auth-page { display:grid; min-height:100dvh; place-items:center; padding:1rem; }
    .gc-auth-card { width:min(100%,29rem); }
    h1 { margin:0 0 .5rem; }
    form { display:grid; gap:.65rem; margin-top:1.25rem; }
    input { width:100%; min-height:var(--gc-control-height); padding:.6rem .75rem;
      border-radius:calc(var(--gc-radius) * .65); border:1px solid var(--gc-outline);
      color:var(--gc-on-surface); background:var(--gc-surface); }
    label { font-weight:600; font-size:.875rem; }
    .gc-error-text { color:var(--gc-error); margin:.15rem 0; }
  `],
})
export class GcChangePasswordPage {
  private readonly session = inject(GcSessionService);
  private readonly router = inject(Router);
  private readonly notices = inject(GcNotificationService);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = new FormGroup({
    oldPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
    newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(12)] }),
    confirmation: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });

  protected async submit(): Promise<void> {
    if (this.loading()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Completa todos los campos. La nueva contraseña necesita al menos 12 caracteres.');
      return;
    }
    const { oldPassword, newPassword, confirmation } = this.form.getRawValue();
    if (newPassword !== confirmation) {
      this.error.set('La confirmación no coincide con la contraseña nueva.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.session.changePassword({ oldPassword, newPassword }));
      this.notices.show('Contraseña actualizada. Inicia sesión con la nueva contraseña.', 'success');
      await this.router.navigateByUrl('/login');
    } catch (error: unknown) {
      this.error.set(gcErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
