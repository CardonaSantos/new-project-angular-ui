import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { GcNotificationService } from '../../../core/ux/gc-notification.service';
import { GcPasswordChangeForm } from '../gc-password-change-form';

@Component({
  selector: 'gc-account-security-page',
  imports: [GcPasswordChangeForm],
  template: `
    <section class="gc-security-page">
      <h1>Seguridad</h1>
      <div class="gc-surface gc-security-card">
        <h2>Cambiar contraseña</h2>
        <p class="gc-muted">Mínimo 12 caracteres. Al guardarla, iniciarás sesión de nuevo.</p>
        <gc-password-change-form (changed)="onChanged()" />
      </div>
    </section>
  `,
  styles: [`
    :host { display:block; }
    .gc-security-page { width:min(100%, 40rem); }
    h1 { margin:0 0 1.5rem; font-size:clamp(1.5rem,2.4vw,1.9rem); }
    h2 { margin:0 0 .35rem; font-size:1.125rem; }
    p { margin:0 0 1.35rem; font-size:.875rem; line-height:1.5; }
    .gc-security-card { min-width:0; }
  `],
})
export class GcAccountSecurityPage {
  private readonly router = inject(Router);
  private readonly notices = inject(GcNotificationService);
  protected async onChanged(): Promise<void> {
    this.notices.show('Contraseña actualizada. Inicia sesión de nuevo.', 'success');
    await this.router.navigateByUrl('/login');
  }
}
