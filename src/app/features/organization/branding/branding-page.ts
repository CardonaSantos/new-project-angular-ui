import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GcPageState } from '../../../core/ux/gc-page-state';
import { GcConfirmedAction } from '../../../core/ux/gc-confirmed-action';
import { GcNotificationService } from '../../../core/ux/gc-notification.service';
import { gcErrorMessage } from '../../../core/http/api-error';
import { GcPageHeader } from '../../../design-system/components/page-header/gc-page-header';
import { GcButtonDirective } from '../../../design-system/components/button/gc-button.directive';
import { GcErrorState } from '../../../design-system/feedback/gc-error-state';
import { GcFileUpload } from '../../../design-system/forms/gc-file-upload';
import { GcBrandLogo } from '../../../design-system/branding/gc-brand-logo';
import { ConfirmDialogService } from '../../../design-system/confirm-dialog/confirm-dialog.service';
import { ThemeManagerService } from '../../../design-system/themes/theme-manager.service';
import { generateThemeColors, isValidHexColor } from '../../../design-system/themes/theme-palette';
import { OrganizationAccess } from '../data-access/organization-access';
import { CompanyApi } from '../data-access/organization-api';
import { MediaApi } from '../../users/data-access/users.api';
import type { Company } from '../data-access/organization.models';
import { GcOrganizationNav } from '../organization-nav';
import { GcBrandingService } from '../../../core/branding/gc-branding.service';

/** Matches the Cappuccino preset, which is what the app falls back to. */
const DEFAULT_COLOR = '#604535';

@Component({
  selector: 'gc-branding-page',
  imports: [GcPageHeader, GcButtonDirective, GcErrorState, GcOrganizationNav, GcFileUpload, GcBrandLogo],
  template: `
    <div class="gc-org-page gc-org-page--form">
      <gc-page-header title="Apariencia" />
      <gc-organization-nav />
      @if (page.busy()) { <p class="gc-org-muted" role="status">Cargando apariencia…</p> }
      @if (page.status() === 'error') {
        <gc-error-state [message]="readError()" (retry)="reload()" />
      }
      @if (page.data(); as company) {
        <section class="gc-org-card gc-org-narrow">
          <h2>Color de marca</h2>
          <p class="gc-org-muted">
            Define la identidad del negocio: la verán todos los usuarios. A partir de este color se
            genera la paleta completa (fondos, bordes, contenedores) para modo claro y oscuro.
          </p>
          <div class="gc-org-brand-row">
            <input type="color" aria-label="Color de marca" [value]="colorInput()"
              (input)="onColorPicked($event)" [disabled]="!canManage()" />
            <input type="text" class="gc-org-hex-input" maxlength="7" placeholder="#604535"
              [value]="colorInput()" (input)="onColorTyped($event)" [disabled]="!canManage()"
              [attr.aria-invalid]="!!colorError()" />
            @if (!canManage()) { <span class="gc-org-muted">Solo lectura</span> }
          </div>
          @if (colorError()) { <p class="gc-org-error" role="alert">{{ colorError() }}</p> }

          <div class="gc-org-preview-grid">
            @for (sample of previews(); track sample.mode) {
              <div class="gc-org-preview" [style.background]="sample.colors.surface"
                [style.color]="sample.colors.onSurface"
                [style.border-color]="sample.colors.outlineVariant">
                <strong>{{ sample.label }}</strong>
                <div class="gc-org-preview-card" [style.background]="sample.colors.surfaceContainer"
                  [style.border-color]="sample.colors.outlineVariant">
                  <span [style.color]="sample.colors.onSurface">Texto principal</span>
                  <span [style.color]="sample.colors.onSurfaceVariant">Texto atenuado</span>
                </div>
                <div class="gc-org-preview-chips">
                  <span [style.background]="sample.colors.primary" [style.color]="sample.colors.onPrimary">
                    Botón
                  </span>
                  <span [style.background]="sample.colors.primaryContainer"
                    [style.color]="sample.colors.onPrimaryContainer">
                    Hover
                  </span>
                  <span [style.color]="sample.colors.primary">Enlace</span>
                </div>
              </div>
            }
          </div>
          @if (adjustedModes().length) {
            <p class="gc-org-muted">
              En modo {{ adjustedModes().join(' y ') }} el color se ajusta un poco para que siga
              siendo legible como texto y enlaces sobre el fondo. El resto de la paleta sí parte
              de tu color exacto.
            </p>
          }
          <div class="gc-org-actions">
            <button gcButton type="button" [disabled]="!canManage() || !colorDirty() || color.busy()"
              (click)="saveColor()">
              {{ color.busy() ? 'Guardando…' : 'Guardar color' }}
            </button>
            @if (company.colorPrimario) {
              <button gcButton variant="outline" type="button" [disabled]="!canManage() || color.busy()"
                (click)="resetColor()">
                Restablecer al predeterminado
              </button>
            }
          </div>
        </section>

        <section class="gc-org-card gc-org-narrow">
          <h2>Logo</h2>
          <p class="gc-org-muted">Aparece en la barra lateral de la aplicación.</p>
          <div class="gc-org-brand-row">
            <gc-brand-logo [logoUrl]="company.logoUrl" [showName]="false" />
          </div>
          @if (!canPublishMedia()) {
            <p class="gc-org-muted">
              Tu rol no tiene permiso para subir el logo. Pide a un administrador que lo suba.
            </p>
          } @else {
            <gc-file-upload inputId="branding-logo-upload" label="Seleccionar logo" [maxFiles]="1"
              [maxSizeMb]="5" [acceptedMime]="logoMime" (filesSelected)="onLogoSelected($event)" />
            @if (logoError()) { <p class="gc-org-error" role="alert">{{ logoError() }}</p> }
            <div class="gc-org-actions">
              <button gcButton type="button" [disabled]="!selectedLogo() || logo.busy()" (click)="saveLogo()">
                {{ logo.busy() ? 'Subiendo…' : 'Actualizar logo' }}
              </button>
              @if (company.logoMediaId) {
                <button gcButton variant="outline" type="button" [disabled]="logo.busy()" (click)="removeLogo()">
                  Quitar logo
                </button>
              }
            </div>
          }
        </section>
      }

      <section class="gc-org-card gc-org-narrow">
        <h2>Mis preferencias</h2>
        <p class="gc-org-muted">
          Solo afectan a tu usuario en este dispositivo; no cambian lo que ven los demás.
        </p>
        <div class="gc-org-grid">
          <div class="gc-org-field">
            <label for="ap-mode">Modo</label>
            <select id="ap-mode" [value]="theme.mode()" (change)="onMode($event)">
              <option value="system">Según el sistema</option>
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
            </select>
          </div>
          <div class="gc-org-field">
            <label for="ap-density">Densidad</label>
            <select id="ap-density" [value]="theme.density()" (change)="onDensity($event)">
              <option value="comfortable">Cómoda</option>
              <option value="compact">Compacta</option>
            </select>
          </div>
          <div class="gc-org-field">
            <label for="ap-font">Tamaño de texto ({{ fontPercent() }}%)</label>
            <input id="ap-font" type="range" min="1" max="1.25" step="0.05"
              [value]="theme.fontScale()" (input)="onFontScale($event)" />
          </div>
          <div class="gc-org-field">
            <label for="ap-radius">Redondeo ({{ theme.cornerRadius() }}px)</label>
            <input id="ap-radius" type="range" min="4" max="24" step="1"
              [value]="theme.cornerRadius()" (input)="onRadius($event)" />
          </div>
        </div>
        <div class="gc-org-actions">
          <button gcButton variant="outline" type="button" (click)="resetPreferences()">
            Restablecer mis preferencias
          </button>
        </div>
      </section>
    </div>
  `,
  styleUrl: '../organization.scss',
})
export class GcBrandingPage implements OnInit {
  private readonly api = inject(CompanyApi);
  private readonly media = inject(MediaApi);
  private readonly branding = inject(GcBrandingService);
  protected readonly theme = inject(ThemeManagerService);
  protected readonly access = inject(OrganizationAccess);
  private readonly notifications = inject(GcNotificationService);
  private readonly dialogs = inject(ConfirmDialogService);
  private readonly logoPicker = viewChild(GcFileUpload);

  protected readonly page = new GcPageState<Company>();
  protected readonly color = new GcConfirmedAction();
  protected readonly logo = new GcConfirmedAction();
  protected readonly colorError = signal<string | null>(null);
  protected readonly logoError = signal<string | null>(null);
  protected readonly colorInput = signal(DEFAULT_COLOR);
  protected readonly selectedLogo = signal<File | null>(null);
  private uploadedLogoMediaId: string | null = null;
  protected readonly logoMime: readonly string[] = ['image/png', 'image/webp', 'image/jpeg'];

  protected readonly canManage = computed(() => this.access.canGlobal('organization.manage'));
  protected readonly canPublishMedia = computed(() => this.access.canGlobal('media.publish'));
  protected readonly fontPercent = computed(() => Math.round(this.theme.fontScale() * 100));

  /** Both modes are previewed, since the saved color applies to whichever each user picks. */
  protected readonly previews = computed(() => {
    const hex = isValidHexColor(this.colorInput()) ? this.colorInput() : DEFAULT_COLOR;
    return [
      { mode: 'light' as const, label: 'Claro', colors: generateThemeColors(hex, 'light') },
      { mode: 'dark' as const, label: 'Oscuro', colors: generateThemeColors(hex, 'dark') },
    ];
  });
  /**
   * `--gc-primary` doubles as a text color throughout the app, so a color too
   * close to the background gets nudged. Saying so beats the user wondering
   * why the saved color looks slightly off.
   */
  protected readonly adjustedModes = computed(() => {
    const hex = this.colorInput().toLowerCase();
    if (!isValidHexColor(hex)) return [];
    return this.previews()
      .filter(sample => sample.colors.primary.toLowerCase() !== hex)
      .map(sample => sample.label.toLowerCase());
  });
  protected readonly colorDirty = computed(() => {
    const current = this.page.data()?.colorPrimario ?? DEFAULT_COLOR;
    return current.toUpperCase() !== this.colorInput().toUpperCase() && !this.colorError();
  });

  ngOnInit(): void {
    void this.initialize();
  }
  private async initialize(): Promise<void> {
    if (!this.access.loaded()) {
      try { await this.access.load(); } catch { /* API errors surface in global notifications. */ }
    }
    await this.load();
  }
  protected readError(): string { return gcErrorMessage(this.page.error()); }
  protected reload(): void { void this.load(); }
  private async load(): Promise<void> {
    await this.page.load(() => firstValueFrom(this.api.get()));
    const company = this.page.data();
    if (company) this.colorInput.set((company.colorPrimario ?? DEFAULT_COLOR).toUpperCase());
  }

  protected onColorPicked(event: Event): void {
    this.colorError.set(null);
    this.colorInput.set((event.target as HTMLInputElement).value.toUpperCase());
  }
  protected onColorTyped(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    this.colorInput.set(value.toUpperCase());
    this.colorError.set(isValidHexColor(value) ? null : 'Usa el formato #RRGGBB.');
  }
  protected async saveColor(): Promise<void> {
    if (!this.canManage() || this.color.busy()) return;
    const value = this.colorInput();
    if (!isValidHexColor(value)) { this.colorError.set('Usa el formato #RRGGBB.'); return; }
    await this.applyColor(value, 'Guardar color de marca',
      'Este color lo verán todos los usuarios del negocio. ¿Guardarlo?');
  }
  protected async resetColor(): Promise<void> {
    if (!this.canManage() || this.color.busy()) return;
    await this.applyColor(null, 'Restablecer color de marca',
      '¿Volver al color predeterminado de la aplicación?');
  }
  private async applyColor(
    colorPrimario: string | null, title: string, message: string,
  ): Promise<void> {
    this.colorError.set(null);
    const result = await this.color.runConfirmed(this.dialogs, { title, message, confirmText: 'Guardar' },
      () => firstValueFrom(this.api.update({ colorPrimario })));
    if (!result) return;
    if (!result.ok) {
      if (result.reason === 'error') this.colorError.set(gcErrorMessage(result.error));
      return;
    }
    this.page.data.set(result.value);
    this.colorInput.set((result.value.colorPrimario ?? DEFAULT_COLOR).toUpperCase());
    this.theme.setBrandColor(result.value.colorPrimario);
    this.notifications.show('Color de marca actualizado.', 'success');
  }

  protected onLogoSelected(files: readonly File[]): void {
    this.selectedLogo.set(files.length ? files[0] : null);
    this.uploadedLogoMediaId = null;
  }
  protected async saveLogo(): Promise<void> {
    const file = this.selectedLogo();
    if (!file || this.logo.busy()) return;
    this.logoError.set(null);
    const result = await this.logo.runConfirmed(this.dialogs, {
      title: 'Actualizar logo', message: '¿Usar esta imagen como logo de la aplicación?',
      confirmText: 'Actualizar',
    }, async () => {
      const mediaId = this.uploadedLogoMediaId ??
        (await firstValueFrom(this.media.upload(file, 'MARCA', undefined, true))).id;
      this.uploadedLogoMediaId = mediaId;
      return firstValueFrom(this.api.update({ logoMediaId: mediaId }));
    });
    if (!result) return;
    if (!result.ok) {
      if (result.reason === 'error') this.logoError.set(gcErrorMessage(result.error));
      return;
    }
    this.logoPicker()?.reset();
    this.selectedLogo.set(null);
    this.uploadedLogoMediaId = null;
    this.page.data.set(result.value);
    if (result.value.logoUrl) this.branding.setLogo(result.value.logoUrl);
    this.notifications.show('Logo actualizado.', 'success');
  }
  protected async removeLogo(): Promise<void> {
    this.logoError.set(null);
    const result = await this.logo.runConfirmed(this.dialogs, {
      title: 'Quitar logo', message: '¿Quitar el logo de la aplicación?',
      confirmText: 'Quitar logo', danger: true,
    }, () => firstValueFrom(this.api.update({ logoMediaId: null })));
    if (!result) return;
    if (!result.ok) {
      if (result.reason === 'error') this.logoError.set(gcErrorMessage(result.error));
      return;
    }
    this.page.data.set(result.value);
    this.branding.clearLogo();
    this.notifications.show('Logo eliminado.', 'success');
  }

  protected onMode(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'light' || value === 'dark' || value === 'system') this.theme.setMode(value);
  }
  protected onDensity(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'comfortable' || value === 'compact') this.theme.setDensity(value);
  }
  protected onFontScale(event: Event): void {
    this.theme.setFontScale(Number((event.target as HTMLInputElement).value));
  }
  protected onRadius(event: Event): void {
    this.theme.setCornerRadius(Number((event.target as HTMLInputElement).value));
  }
  protected resetPreferences(): void {
    this.theme.reset();
    this.notifications.show('Preferencias restablecidas.', 'success');
  }

  hasUnsavedChanges(): boolean { return this.colorDirty() || !!this.selectedLogo(); }
}
