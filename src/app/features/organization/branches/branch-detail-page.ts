import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { GcAsyncAction } from '../../../core/ux/gc-async-action';
import { GcPageState } from '../../../core/ux/gc-page-state';
import { GcBranchContext } from '../../../core/organization/gc-branch-context';
import { GcBranchesApi } from '../../../core/organization/gc-branches.api';
import { gcErrorMessage } from '../../../core/http/api-error';
import { GcPageHeader } from '../../../design-system/components/page-header/gc-page-header';
import { GcButtonDirective } from '../../../design-system/components/button/gc-button.directive';
import { GcErrorState } from '../../../design-system/feedback/gc-error-state';
import { GcNotificationService } from '../../../core/ux/gc-notification.service';
import { ConfirmDialogService } from '../../../design-system/confirm-dialog/confirm-dialog.service';
import { OrganizationAccess } from '../data-access/organization-access';
import { BranchesApi } from '../data-access/organization-api';
import type { Branch, BranchConfig, BranchCreate, BranchUpdate, BranchOverview, ConfigUpdate } from '../data-access/organization.models';
import { GcOrganizationNav } from '../organization-nav';

@Component({
  selector: 'gc-branch-detail-page',
  imports: [ReactiveFormsModule, RouterLink, GcPageHeader, GcButtonDirective,
    GcErrorState, GcOrganizationNav],
  template: `
  <div class="gc-org-page">
    <gc-page-header [title]="isNew ? 'Nueva sucursal' : (branch.data()?.nombre ?? 'Sucursal')"/>
    <gc-organization-nav />
    <div><a routerLink="/organization/branches">Volver a sucursales</a></div>
    @if (branch.busy()) { <p role="status" class="gc-org-muted">Cargando sucursal…</p> }
    @if (branch.status()==='error') {
      <gc-error-state [message]="readError()" (retry)="reload()" />
    }
    @if (isNew || branch.data()) {
      <section class="gc-org-card gc-org-narrow">
        <form class="gc-org-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <div class="gc-org-row"><h2>Información</h2>
            @if (!isNew) { <span class="gc-org-status">{{ branch.data()?.activa ? 'Activa' : 'Inactiva' }}</span> }
          </div>
          <div class="gc-org-grid">
            <div class="gc-org-field">
              <label for="br-code">Código</label>
              <input id="br-code" formControlName="codigo" maxlength="32"
                [attr.aria-invalid]="form.controls.codigo.invalid && form.controls.codigo.touched" />
              @if (form.controls.codigo.touched && form.controls.codigo.invalid) {
                <small class="gc-org-error">Usa entre 2 y 32 caracteres: letras, números, guion o guion bajo.</small>
              }
            </div>
            <div class="gc-org-field">
              <label for="br-name">Nombre</label>
              <input id="br-name" formControlName="nombre" maxlength="120"
                [attr.aria-invalid]="form.controls.nombre.invalid && form.controls.nombre.touched"/>
            </div>
            <div class="gc-org-field">
              <label for="br-phone">Teléfono</label>
              <input id="br-phone" formControlName="telefono" maxlength="35"/>
            </div>
            <div class="gc-org-field">
              <label for="br-timezone">Zona horaria</label>
              <input id="br-timezone" formControlName="zonaHoraria" maxlength="64"/>
            </div>
            <div class="gc-org-field">
              <label for="br-address">Dirección</label>
              <textarea id="br-address" formControlName="direccion" maxlength="300" rows="2"></textarea>
            </div>
          </div>
          @if (saveError()) { <p class="gc-org-alert" role="alert">{{ saveError() }}</p> }
          <div class="gc-org-actions">
            <button gcButton type="submit" [disabled]="!canManage() || !form.dirty || action.pending()">
              {{ action.pending() ? 'Guardando…' : (isNew ? 'Crear sucursal' : 'Guardar cambios') }}
            </button>
            @if (!canManage()) { <span class="gc-org-muted">Solo lectura</span> }
          </div>
        </form>
      </section>
      @if (!isNew && branch.data()) {
        <section class="gc-org-card gc-org-narrow">
          <div class="gc-org-row"><h2>Configuración</h2></div>
          <form [formGroup]="settings" class="gc-org-form" (ngSubmit)="saveConfig()" novalidate>
            <div class="gc-org-grid">
              <div class="gc-org-field">
                <label for="br-cutoff">Corte operativo</label>
                <input id="br-cutoff" type="time" formControlName="horaCorteOperativo" />
              </div>
              <div class="gc-org-field">
                <label for="br-currency">Moneda</label>
                <input id="br-currency" formControlName="moneda" maxlength="3" />
              </div>
            </div>
            <div class="gc-org-switches">
              <label class="gc-org-switch"><input type="checkbox" formControlName="exigeCobroAntesPreparar" />
                Exigir cobro antes de preparar</label>
              <label class="gc-org-switch"><input type="checkbox" formControlName="permiteStockNegativo" />
                Permitir stock negativo</label>
              <label class="gc-org-switch"><input type="checkbox" formControlName="permiteOrdenesQR" />
                Permitir órdenes QR</label>
            </div>
            @if (configError()) { <p class="gc-org-alert" role="alert">{{ configError() }}</p> }
            <div class="gc-org-actions">
              <button gcButton type="submit" [disabled]="!canManage() || !settings.dirty || configAction.pending()">
                {{ configAction.pending() ? 'Guardando…' : 'Guardar configuración' }}
              </button>
            </div>
          </form>
        </section>
        @if (overview(); as counts) {
          <section class="gc-org-card gc-org-page">
            <h2>Resumen operativo</h2>
            <div class="gc-org-metrics">
              @for (stat of metrics(counts); track stat.label) {
                <div class="gc-org-metric"><strong>{{ stat.value }}</strong><span>{{ stat.label }}</span></div>
              }
            </div>
          </section>
        }
        <section class="gc-org-card gc-org-narrow">
          <h2>Estado de sucursal</h2>
          <p class="gc-org-muted">No se puede desactivar mientras tenga operaciones pendientes.</p>
          <div class="gc-org-field">
            <label for="br-reason">Motivo</label>
            <input id="br-reason" [value]="reason()" (input)="reason.set($any($event.target).value)"
              maxlength="500" />
          </div>
          @if (statusError()) { <p class="gc-org-alert" role="alert">{{ statusError() }}</p> }
          <div class="gc-org-actions">
            <button type="button" gcButton [variant]="branch.data()?.activa ? 'danger' : 'secondary'"
              [disabled]="!canManage() || statusAction.pending() || reason().trim().length < 3"
              (click)="changeStatus()">
              {{ branch.data()?.activa ? 'Desactivar sucursal' : 'Activar sucursal' }}
            </button>
          </div>
        </section>
      }
    }
  </div>
  `,
  styleUrl: '../organization.scss',
})
export class GcBranchDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(BranchesApi);
  private readonly context = inject(GcBranchContext);
  private readonly branchAuth = inject(GcBranchesApi);
  private readonly targetPermissions = signal<readonly string[]>([]);
  private readonly access = inject(OrganizationAccess);
  private readonly notify = inject(GcNotificationService);
  private readonly dialogs = inject(ConfirmDialogService);
  protected readonly id = this.route.snapshot.paramMap.get('id') ?? 'new';
  protected readonly isNew = this.id === 'new';
  protected readonly branch = new GcPageState<Branch>();
  protected readonly config = signal<BranchConfig|null>(null);
  protected readonly overview = signal<BranchOverview|null>(null);
  protected readonly reason = signal('');
  protected readonly saveError = signal<string|null>(null);
  protected readonly configError = signal<string|null>(null);
  protected readonly statusError = signal<string|null>(null);
  protected readonly action = new GcAsyncAction();
  protected readonly configAction = new GcAsyncAction();
  protected readonly statusAction = new GcAsyncAction();
  protected readonly form = new FormGroup({
    codigo:new FormControl('',{nonNullable:true,validators:[
      Validators.required,Validators.pattern(/^[A-Za-z][A-Za-z0-9_-]{1,31}$/)]}),
    nombre:new FormControl('',{nonNullable:true,validators:Validators.required}),
    direccion:new FormControl(''),telefono:new FormControl(''),
    zonaHoraria:new FormControl('',{nonNullable:true}),
  });
  protected readonly settings = new FormGroup({
    horaCorteOperativo:new FormControl('04:00',{nonNullable:true,validators:Validators.pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/)}),
    moneda:new FormControl('GTQ',{nonNullable:true,validators:Validators.pattern(/^[A-Za-z]{3}$/)}),
    exigeCobroAntesPreparar:new FormControl(false,{nonNullable:true}),
    permiteStockNegativo:new FormControl(false,{nonNullable:true}),
    permiteOrdenesQR:new FormControl(false,{nonNullable:true}),
  });
  ngOnInit(): void { void this.initialize(); }
  private async initialize(): Promise<void> {
    try { if (!this.access.loaded()) await this.access.load(); } catch { /* handled globally */ }
    if (!this.isNew) await this.load();
  }
  protected canManage(): boolean {
    return this.isNew ? this.access.canGlobal('branches.manage') :
      this.targetPermissions().includes('branches.manage');
  }
  protected readError(): string { return gcErrorMessage(this.branch.error()); }
  protected reload(): void { void this.load(); }
  private async load(): Promise<void> {
    await this.branch.load(() => firstValueFrom(this.api.get(this.id)));
    const item=this.branch.data();
    if (!item) return;
    try {
      const scope = await firstValueFrom(this.branchAuth.capabilities(this.id));
      this.targetPermissions.set(scope.permissions);
    } catch { this.targetPermissions.set([]); }
    this.form.reset({
      codigo:item.codigo,nombre:item.nombre,direccion:item.direccion??'',
      telefono:item.telefono??'',zonaHoraria:item.zonaHoraria,
    });
    this.form.controls.codigo.disable();
    if (!this.canManage()) this.form.disable();
    else { this.form.enable(); this.form.controls.codigo.disable(); }
    this.configError.set(null);
    const results=await Promise.allSettled([
      firstValueFrom(this.api.config(this.id)),
      firstValueFrom(this.api.overview(this.id)),
    ]);
    if (results[0].status==='fulfilled') {
      const value=results[0].value;
      this.config.set(value);
      this.settings.reset({
        horaCorteOperativo:value.horaCorteOperativo, moneda:value.moneda,
        exigeCobroAntesPreparar:value.exigeCobroAntesPreparar,
        permiteStockNegativo:value.permiteStockNegativo, permiteOrdenesQR:value.permiteOrdenesQR,
      });
      if (!this.canManage()) this.settings.disable();
    } else this.configError.set(gcErrorMessage(results[0].reason));
    if (results[1].status==='fulfilled') this.overview.set(results[1].value);
  }
  protected metrics(counts: BranchOverview) {
    return [
      {label:'Personal asignado',value:counts.usuariosAsignados},
      {label:'Dispositivos',value:counts.dispositivos},
      {label:'Almacenes',value:counts.almacenes},
      {label:'Cajas',value:counts.cajas},
      {label:'Estaciones',value:counts.estacionesPreparacion},
      {label:'Órdenes abiertas',value:counts.ordenesAbiertas},
      {label:'Turnos abiertos',value:counts.turnosCajaAbiertos},
      {label:'Entregas pendientes',value:counts.entregasPendientes},
    ];
  }
  protected async save(): Promise<void> {
    if (!this.canManage() || this.action.pending()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value=this.form.getRawValue();
    this.saveError.set(null);
    const dto: BranchCreate={codigo:value.codigo.trim().toUpperCase(),nombre:value.nombre.trim(),
      direccion:value.direccion?.trim()??'',telefono:value.telefono?.trim()??'',
      ...(value.zonaHoraria.trim() ? {zonaHoraria:value.zonaHoraria.trim()} : {})};
    const original=this.branch.data();
    const changes:BranchUpdate={};
    if (original) {
      if (dto.nombre!==original.nombre) changes.nombre=dto.nombre;
      if (dto.direccion!==(original.direccion??'')) changes.direccion=dto.direccion;
      if (dto.telefono!==(original.telefono??'')) changes.telefono=dto.telefono;
      if (dto.zonaHoraria!==undefined && dto.zonaHoraria!==original.zonaHoraria) changes.zonaHoraria=dto.zonaHoraria;
      if (!Object.keys(changes).length) { this.form.markAsPristine(); return; }
    }
    const result=await this.action.run(()=>firstValueFrom(this.isNew
      ? this.api.create(dto) : this.api.update(this.id,changes)));
    if (!result.ok) { if(result.reason==='error')this.saveError.set(gcErrorMessage(result.error)); return; }
    this.notify.show(this.isNew?'Sucursal creada.':'Sucursal actualizada.','success');
    if (this.isNew) {
      this.form.markAsPristine();
      await this.router.navigate(['/organization/branches',result.value.id]);
    } else await this.load();
    await this.refreshAccess();
  }
  protected async saveConfig(): Promise<void> {
    if (!this.canManage() || this.settings.invalid || this.configAction.pending()) {
      this.settings.markAllAsTouched(); return;
    }
    const original=this.config(); if(!original) return;
    const value=this.settings.getRawValue();
    const changes:ConfigUpdate={};
    if (value.horaCorteOperativo!==original.horaCorteOperativo) changes.horaCorteOperativo=value.horaCorteOperativo;
    if (value.moneda.toUpperCase()!==original.moneda) changes.moneda=value.moneda.trim().toUpperCase();
    if (value.exigeCobroAntesPreparar!==original.exigeCobroAntesPreparar) changes.exigeCobroAntesPreparar=value.exigeCobroAntesPreparar;
    if (value.permiteStockNegativo!==original.permiteStockNegativo) changes.permiteStockNegativo=value.permiteStockNegativo;
    if (value.permiteOrdenesQR!==original.permiteOrdenesQR) changes.permiteOrdenesQR=value.permiteOrdenesQR;
    if (!Object.keys(changes).length) { this.settings.markAsPristine(); return; }
    if (changes.horaCorteOperativo || changes.moneda) {
      if (!await this.dialogs.confirm({title:'Confirmar configuración',
        message:'La moneda o el corte operativo pueden afectar los registros existentes.',
        confirmText:'Guardar configuración',danger:true})) return;
    }
    this.configError.set(null);
    const result=await this.configAction.run(()=>firstValueFrom(this.api.updateConfig(this.id,changes)));
    if (!result.ok) { if(result.reason==='error')this.configError.set(gcErrorMessage(result.error)); return; }
    this.config.set(result.value);
    this.settings.markAsPristine();
    this.notify.show('Configuración guardada.','success');
  }
  protected async changeStatus(): Promise<void> {
    if (!this.canManage() || this.statusAction.pending() || this.reason().trim().length<3) return;
    const current=this.branch.data();if(!current)return;
    const active=!current.activa;
    const ok=await this.dialogs.confirm({
      title:active?'Activar sucursal':'Desactivar sucursal',
      message:active?'¿Quieres activar esta sucursal?':'¿Quieres desactivar esta sucursal?',
      confirmText:active?'Activar':'Desactivar',danger:!active,
    });
    if (!ok) return;
    this.statusError.set(null);
    const result=await this.statusAction.run(()=>firstValueFrom(this.api.status(this.id,active,this.reason().trim())));
    if (!result.ok) {if(result.reason==='error')this.statusError.set(gcErrorMessage(result.error));return;}
    this.reason.set('');
    this.notify.show(active?'Sucursal activada.':'Sucursal desactivada.','success');
    await this.load(); await this.refreshAccess();
  }
  private async refreshAccess():Promise<void> {
    try { await firstValueFrom(this.context.load()); }
    catch { /* The existing API toast explains failures; no silent authorization. */ }
  }
  hasUnsavedChanges():boolean {
    return !this.action.pending() && !this.configAction.pending() &&
      (this.form.dirty || this.settings.dirty);
  }
}
