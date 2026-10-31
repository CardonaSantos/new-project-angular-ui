import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { GcBrandingService } from '../../../core/branding/gc-branding.service';
import { GcNotificationService } from '../../../core/ux/gc-notification.service';
import { GcBrandLogo } from '../../../design-system/branding/gc-brand-logo';
import { GcPasswordChangeForm } from '../gc-password-change-form';

@Component({
  selector: 'gc-change-password-page',
  imports: [GcBrandLogo, GcPasswordChangeForm],
  template: `
    <main class="gc-auth-screen">
      <div class="gc-auth-wrap">
        <div class="gc-auth-brand">
          <gc-brand-logo [name]="branding.name()" [logoUrl]="branding.logoUrl()" />
        </div>
        <section class="gc-auth-card" aria-labelledby="gc-password-title">
          <h1 id="gc-password-title">Cambiar contraseña</h1>
          <p class="gc-auth-help">Usa una contraseña nueva de al menos 12 caracteres.</p>
          <gc-password-change-form (changed)="onChanged()" />
        </section>
      </div>
    </main>
  `,
  styleUrl: '../gc-auth-layout.scss',
})
export class GcChangePasswordPage {
  protected readonly branding = inject(GcBrandingService);
  private readonly router = inject(Router);
  private readonly notices = inject(GcNotificationService);

  protected async onChanged(): Promise<void> {
    this.notices.show('Contraseña actualizada. Inicia sesión de nuevo.', 'success');
    await this.router.navigateByUrl('/login');
  }
}
