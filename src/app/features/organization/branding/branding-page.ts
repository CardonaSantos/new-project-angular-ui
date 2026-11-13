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
import {
  THEME_PRESETS,
  THEME_TOKEN_GROUPS,
  THEME_TOKEN_LABELS,
  type ResolvedMode,
} from '../../../design-system/themes/theme-presets';
import { OrganizationAccess } from '../data-access/organization-access';
import { CompanyApi } from '../data-access/organization-api';
import { MediaApi } from '../../users/data-access/users.api';
import type { Company } from '../data-access/organization.models';
import { GcOrganizationNav } from '../organization-nav';
import { GcBrandingService } from '../../../core/branding/gc-branding.service';
import { ThemeEditorState } from './theme-editor-state';

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
          <h2>Colores</h2>
          @if (!editor.enabled()) {
            <p class="gc-org-muted">
              Este negocio usa la paleta predeterminada. Para personalizarla, parte de una base y
              edita cada color a mano: nada se calcula solo una vez guardado.
            </p>
            <div class="gc-org-actions">
              @for (preset of presets; track preset.id) {
                <button gcButton variant="outline" type="button" [disabled]="!canManage()"
                  (click)="startFromPreset(preset.id)">
                  Partir de {{ preset.label }}
                </button>
              }
            </div>
            <div class="gc-org-brand-row">
              <input type="color" aria-label="Color base" [value]="seedColor()"
                [disabled]="!canManage()" (input)="seedColor.set($any($event.target).value)" />
              <input type="text" class="gc-org-hex-input" maxlength="7" [value]="seedColor()"
                [disabled]="!canManage()" (change)="seedColor.set($any($event.target).value)" />
              <button gcButton variant="outline" type="button" [disabled]="!canManage()"
                (click)="startFromColor()">
                Partir de este color
              </button>
            </div>
            @if (seedError()) { <p class="gc-org-error" role="alert">{{ seedError() }}</p> }
          } @else {
            <div class="gc-org-mode-tabs" role="group" aria-label="Modo a editar">
              @for (option of modes; track option.value) {
                <button type="button" [class.active]="editor.mode() === option.value"
                  [attr.aria-pressed]="editor.mode() === option.value"
                  (click)="editor.mode.set(option.value)">
                  {{ option.label }}
                </button>
              }
            </div>

            @if (editor.colors(); as colors) {
              <div class="gc-org-preview-wrap">
                <p class="gc-org-muted">Así se verá en modo {{ modeLabel() }}:</p>
                <div class="gc-org-preview" [style.background]="colors.surface"
                  [style.color]="colors.onSurface" [style.border-color]="colors.outlineVariant">
                  <div class="gc-org-preview-card" [style.background]="colors.surfaceContainerLow"
                    [style.border-color]="colors.outlineVariant">
                    <strong>Pedido #1042</strong>
                    <span [style.color]="colors.onSurfaceVariant">Mesa 3 · Sala principal</span>
                    <div class="gc-org-preview-row" [style.border-color]="colors.outlineVariant">
                      <span>Capuchino mediano</span><span>Q 22.00</span>
                    </div>
                    <div class="gc-org-preview-row" [style.background]="colors.hover"
                      [style.color]="colors.onHover" [style.border-color]="colors.outlineVariant">
                      <span>Fila con el mouse encima</span><span>Q 15.00</span>
                    </div>
                  </div>
                  <div class="gc-org-preview-chips">
                    <span [style.background]="colors.primary" [style.color]="colors.onPrimary">
                      Cobrar
                    </span>
                    <span [style.background]="colors.primaryContainer"
                      [style.color]="colors.onPrimaryContainer">Secundario</span>
                    <span [style.background]="colors.hover" [style.color]="colors.onHover">
                      Botón con mouse
                    </span>
                    <span [style.color]="colors.primary">Ver detalle</span>
                  </div>
                  <div class="gc-org-preview-chips">
                    <span [style.background]="colors.success" [style.color]="colors.onSuccess">Pagado</span>
                    <span [style.background]="colors.warning" [style.color]="colors.onWarning">Pendiente</span>
                    <span [style.background]="colors.error" [style.color]="colors.onError">Cancelado</span>
                  </div>
                  <div class="gc-org-preview-input" [style.border-color]="colors.outline"
                    [style.background]="colors.surface" [style.color]="colors.onSurfaceVariant">
                    Campo de texto
                  </div>
                </div>
              </div>

              @for (group of groups; track group.label) {
                <fieldset class="gc-org-section"><legend>{{ group.label }}</legend>
                  <div class="gc-org-grid">
                    @for (token of group.tokens; track token) {
                      <div class="gc-org-field">
                        <label [attr.for]="'tk-' + token">{{ labels[token] }}</label>
                        <div class="gc-org-brand-row">
                          <input type="color" [id]="'tk-' + token" [value]="colors[token]"
                            [disabled]="!canManage()"
                            (input)="editor.setColor(token, $any($event.target).value)" />
                          <input type="text" class="gc-org-hex-input" maxlength="7"
                            [value]="colors[token]" [disabled]="!canManage()"
                            (change)="editor.setColor(token, $any($event.target).value)" />
                        </div>
                      </div>
                    }
                  </div>
                </fieldset>
              }

              <fieldset class="gc-org-section"><legend>Contraste</legend>
                <p class="gc-org-muted">
                  Se mide cada combinación que acaba una encima de otra. Puedes guardar aunque
                  algo quede bajo, pero por debajo de 4.5 el texto cuesta leerlo.
                </p>
                <ul class="gc-org-contrast">
                  @for (entry of editor.contrast(); track entry.foreground + entry.background) {
                    <li [class.bad]="!entry.passes">
                      <span>{{ labels[entry.foreground] }} sobre {{ labels[entry.background] }}</span>
                      <strong>{{ entry.ratio.toFixed(1) }}:1</strong>
                    </li>
                  }
                </ul>
              </fieldset>
            }

            <div class="gc-org-actions">
              <button gcButton type="button"
                [disabled]="!canManage() || !editor.dirty() || theming.busy()" (click)="saveTheme()">
                {{ theming.busy() ? 'Guardando…' : 'Guardar colores' }}
              </button>
              <button gcButton variant="outline" type="button"
                [disabled]="!canManage() || theming.busy()" (click)="editor.copyToOtherMode()">
                Copiar a modo {{ otherModeLabel() }}
              </button>
              <button gcButton variant="outline" type="button"
                [disabled]="!canManage() || theming.busy()" (click)="discardTheme()">
                Volver a la paleta predeterminada
              </button>
              @if (editor.failing().length) {
                <span class="gc-org-muted">
                  {{ editor.failing().length }} combinación(es) por debajo de 4.5
                </span>
              }
            </div>
            @if (themeError()) { <p class="gc-org-error" role="alert">{{ themeError() }}</p> }
          }
          @if (!canManage()) { <p class="gc-org-muted">Solo lectura</p> }
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

  protected readonly editor = new ThemeEditorState();
  protected readonly page = new GcPageState<Company>();
  protected readonly theming = new GcConfirmedAction();
  protected readonly logo = new GcConfirmedAction();
  protected readonly themeError = signal<string | null>(null);
  protected readonly seedError = signal<string | null>(null);
  protected readonly logoError = signal<string | null>(null);
  protected readonly selectedLogo = signal<File | null>(null);
  protected readonly seedColor = signal('#604535');
  private uploadedLogoMediaId: string | null = null;

  protected readonly logoMime: readonly string[] = ['image/png', 'image/webp', 'image/jpeg'];
  protected readonly groups = THEME_TOKEN_GROUPS;
  protected readonly labels = THEME_TOKEN_LABELS;
  protected readonly presets = Object.values(THEME_PRESETS);
  protected readonly modes: readonly { value: ResolvedMode; label: string }[] = [
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' },
  ];

  protected readonly canManage = computed(() => this.access.canGlobal('organization.manage'));
  protected readonly canPublishMedia = computed(() => this.access.canGlobal('media.publish'));
  protected readonly fontPercent = computed(() => Math.round(this.theme.fontScale() * 100));
  protected readonly modeLabel = computed(() => (this.editor.mode() === 'light' ? 'claro' : 'oscuro'));
  protected readonly otherModeLabel = computed(() =>
    this.editor.mode() === 'light' ? 'oscuro' : 'claro',
  );

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
    this.editor.load(company?.tema ?? null);
    if (company?.colorPrimario) this.seedColor.set(company.colorPrimario.toUpperCase());
  }

  protected startFromPreset(preset: 'cappuccino' | 'ocean'): void {
    this.seedError.set(null);
    this.editor.fillFromPreset(preset);
  }
  /**
   * Seeding from one color is a convenience for filling the form; what gets
   * saved is whatever the fields hold after the user edits them.
   */
  protected startFromColor(): void {
    if (!this.editor.fillFromColor(this.seedColor())) {
      this.seedError.set('Usa el formato #RRGGBB.');
      return;
    }
    this.seedError.set(null);
  }

  protected async saveTheme(): Promise<void> {
    if (!this.canManage() || this.theming.busy()) return;
    const draft = this.editor.current();
    if (!draft) return;
    const failing = this.editor.failing().length;
    this.themeError.set(null);
    const result = await this.theming.runConfirmed(this.dialogs, {
      title: 'Guardar colores',
      message: failing
        ? `Hay ${failing} combinación(es) con contraste por debajo de 4.5, que puede costar leer.`
          + ' Estos colores los verán todos los usuarios. ¿Guardar de todos modos?'
        : 'Estos colores los verán todos los usuarios del negocio. ¿Guardarlos?',
      confirmText: 'Guardar',
      danger: failing > 0,
    }, () => firstValueFrom(this.api.update({ tema: draft })));
    if (!result) return;
    if (!result.ok) {
      if (result.reason === 'error') this.themeError.set(gcErrorMessage(result.error));
      return;
    }
    this.page.data.set(result.value);
    this.editor.commit(result.value.tema);
    this.theme.setBrandTheme(result.value.tema);
    this.notifications.show('Colores actualizados.', 'success');
  }

  protected async discardTheme(): Promise<void> {
    if (!this.canManage() || this.theming.busy()) return;
    this.themeError.set(null);
    const result = await this.theming.runConfirmed(this.dialogs, {
      title: 'Volver a la paleta predeterminada',
      message: '¿Descartar los colores personalizados de este negocio?',
      confirmText: 'Descartar',
      danger: true,
    }, () => firstValueFrom(this.api.update({ tema: null })));
    if (!result) return;
    if (!result.ok) {
      if (result.reason === 'error') this.themeError.set(gcErrorMessage(result.error));
      return;
    }
    this.page.data.set(result.value);
    this.editor.commit(null);
    this.theme.setBrandTheme(null);
    this.notifications.show('Se restableció la paleta predeterminada.', 'success');
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

  hasUnsavedChanges(): boolean { return this.editor.dirty() || !!this.selectedLogo(); }
}
