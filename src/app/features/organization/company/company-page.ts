import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { GcPageState } from '../../../core/ux/gc-page-state';
import { GcAsyncAction } from '../../../core/ux/gc-async-action';
import { GcNotificationService } from '../../../core/ux/gc-notification.service';
import { gcErrorMessage } from '../../../core/http/api-error';
import { GcPageHeader } from '../../../design-system/components/page-header/gc-page-header';
import { GcButtonDirective } from '../../../design-system/components/button/gc-button.directive';
import { GcErrorState } from '../../../design-system/feedback/gc-error-state';
import { ConfirmDialogService } from '../../../design-system/confirm-dialog/confirm-dialog.service';
import { OrganizationAccess } from '../data-access/organization-access';
import { CompanyApi } from '../data-access/organization-api';
import type { Company, CompanyUpdate, ValuationMethod } from '../data-access/organization.models';
import { GcOrganizationNav } from '../organization-nav';

@Component({
  selector: 'gc-company-page',
  imports: [ReactiveFormsModule, GcPageHeader, GcButtonDirective, GcErrorState, GcOrganizationNav],
  template: `
    <div class="gc-org-page gc-org-page--form">
      <gc-page-header title="Empresa" />
      <gc-organization-nav />
      @if (page.busy()) { <p class="gc-org-muted" role="status">Cargando empresa…</p> }
      @if (page.status() === 'error') {
        <gc-error-state [message]="readError()" (retry)="reload()" />
      }
      @if (page.data(); as company) {
        <section class="gc-org-card gc-org-narrow">
          <form class="gc-org-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
            <div class="gc-org-grid">
              <div class="gc-org-field">
                <label for="co-name">Nombre comercial</label>
                <input id="co-name" formControlName="nombreComercial" maxlength="150"
                  [attr.aria-invalid]="invalid('nombreComercial')"
                  [attr.aria-describedby]="invalid('nombreComercial') ? 'co-name-error' : null" />
                @if (invalid('nombreComercial')) { <small id="co-name-error" class="gc-org-error">Introduce el nombre comercial.</small> }
              </div>
              <div class="gc-org-field">
                <label for="co-legal">Razón social</label>
                <input id="co-legal" formControlName="razonSocial" maxlength="180"/>
              </div>
              <div class="gc-org-field">
                <label for="co-nit">NIT</label>
                <input id="co-nit" formControlName="nit" maxlength="40"/>
              </div>
              <div class="gc-org-field">
                <label for="co-currency">Moneda base</label>
                <input id="co-currency" formControlName="moneda" maxlength="3"
                  [attr.aria-invalid]="invalid('moneda')" />
                @if (invalid('moneda')) { <small class="gc-org-error">Usa un código de tres letras.</small> }
                <small>Ejemplo: GTQ</small>
              </div>
              <div class="gc-org-field">
                <label for="co-zone">Zona horaria</label>
                <input id="co-zone" formControlName="zonaHoraria" maxlength="64"
                  [attr.aria-invalid]="invalid('zonaHoraria')" />
                @if (invalid('zonaHoraria')) { <small class="gc-org-error">Introduce una zona horaria.</small> }
                <small>Ejemplo: America/Guatemala</small>
              </div>
              <div class="gc-org-field">
                <label for="co-valuation">Valoración de inventario</label>
                <select id="co-valuation" formControlName="metodoValoracion">
                  @for (method of methods(); track method) {
                    <option [value]="method">{{ method === 'FIFO' ? 'Primeras entradas, primeras salidas' : 'Promedio ponderado' }}</option>
                  }
                </select>
              </div>
            </div>
            @if (form.invalid && form.touched) {
              <p class="gc-org-alert" role="alert">Revisa los campos obligatorios y sus formatos.</p>
            }
            @if (error()) { <p class="gc-org-alert" role="alert">{{ error() }}</p> }
            <div class="gc-org-actions">
              <button gcButton type="submit"
                [disabled]="!access.canGlobal('organization.manage') || !form.dirty || action.pending()">
                {{ action.pending() ? 'Guardando…' : 'Guardar cambios' }}
              </button>
              @if (!access.canGlobal('organization.manage')) {
                <span class="gc-org-muted">Solo lectura</span>
              }
            </div>
          </form>
        </section>
      }
    </div>
  `,
  styleUrl: '../organization.scss',
})
export class GcCompanyPage implements OnInit {
  private readonly api = inject(CompanyApi);
  protected readonly access = inject(OrganizationAccess);
  private readonly notifications = inject(GcNotificationService);
  private readonly dialogs = inject(ConfirmDialogService);
  protected readonly page = new GcPageState<Company>();
  protected readonly action = new GcAsyncAction();
  protected readonly error = signal<string | null>(null);
  protected readonly methods = signal<ValuationMethod[]>(['PROMEDIO_PONDERADO','FIFO']);
  protected readonly form = new FormGroup({
    nombreComercial: new FormControl('', { nonNullable:true, validators:[Validators.required, Validators.maxLength(150)] }),
    razonSocial: new FormControl(''),
    nit: new FormControl(''),
    moneda: new FormControl('', { nonNullable:true, validators:[Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)] }),
    zonaHoraria: new FormControl('', { nonNullable:true, validators:Validators.required }),
    metodoValoracion: new FormControl<ValuationMethod>('PROMEDIO_PONDERADO', { nonNullable:true }),
  });
  ngOnInit(): void { void this.initialize(); }
  private async initialize(): Promise<void> {
    if (!this.access.loaded()) {
      try { await this.access.load(); } catch { /* API errors surface in global notifications. */ }
    }
    await this.load();
    try {
      const caps = await firstValueFrom(this.api.capabilities());
      this.methods.set(caps.valuationMethods);
    } catch { /* The current company values remain visible. */ }
  }
  protected invalid(field: 'nombreComercial'|'moneda'|'zonaHoraria'): boolean {
    const c = this.form.controls[field]; return c.invalid && c.touched;
  }
  protected readError(): string { return gcErrorMessage(this.page.error()); }
  protected reload(): void { void this.load(); }
  private async load(): Promise<void> {
    await this.page.load(() => firstValueFrom(this.api.get()));
    if (this.page.data()) {
      const c=this.page.data()!;
      this.form.reset({
        nombreComercial:c.nombreComercial, razonSocial:c.razonSocial??'',
        nit:c.nit??'', moneda:c.moneda, zonaHoraria:c.zonaHoraria,
        metodoValoracion:c.metodoValoracion,
      });
      if (!this.access.canGlobal('organization.manage')) this.form.disable();
      else this.form.enable();
    }
  }
  protected async save(): Promise<void> {
    if (!this.access.canGlobal('organization.manage') || this.action.pending()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const original = this.page.data(); if (!original) return;
    const values = this.form.getRawValue();
    const changes: CompanyUpdate = {};
    for (const key of Object.keys(values) as (keyof CompanyUpdate)[]) {
      const value = values[key];
      const normalized = key === 'moneda' ? String(value).trim().toUpperCase() :
        key === 'razonSocial' || key === 'nit' ? (String(value ?? '').trim() || null) :
          String(value ?? '').trim();
      if (original[key] !== normalized) {
        Object.assign(changes,{[key]:normalized});
      }
    }
    if (!Object.keys(changes).length) { this.form.markAsPristine(); return; }
    if (changes.moneda || changes.zonaHoraria || changes.metodoValoracion) {
      const accepted = await this.dialogs.confirm({
        title:'Confirmar cambios',
        message:'Cambiar la moneda, la zona horaria o la valoración puede afectar las operaciones.',
        confirmText:'Guardar cambios', danger:true,
      });
      if (!accepted) return;
    }
    this.error.set(null);
    const result=await this.action.run(()=>firstValueFrom(this.api.update(changes)));
    if (!result.ok) {
      if (result.reason==='error') this.error.set(gcErrorMessage(result.error));
      return;
    }
    this.notifications.show('Empresa actualizada.', 'success');
    await this.load();
  }
  hasUnsavedChanges(): boolean { return this.form.enabled && this.form.dirty && !this.action.pending(); }
}
