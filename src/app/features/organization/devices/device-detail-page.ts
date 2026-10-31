import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { GcConfirmedAction } from '../../../core/ux/gc-confirmed-action';
import { GcPageState } from '../../../core/ux/gc-page-state';
import { GcBranchContext } from '../../../core/organization/gc-branch-context';
import { GcBranchesApi } from '../../../core/organization/gc-branches.api';
import { gcErrorMessage } from '../../../core/http/api-error';
import { GcPageHeader } from '../../../design-system/components/page-header/gc-page-header';
import { GcButtonDirective } from '../../../design-system/components/button/gc-button.directive';
import { GcErrorState } from '../../../design-system/feedback/gc-error-state';
import { GcNotificationService } from '../../../core/ux/gc-notification.service';
import { ConfirmDialogService } from '../../../design-system/confirm-dialog/confirm-dialog.service';
import { DevicesApi } from '../data-access/organization-api';
import { DEVICE_TYPES } from '../data-access/organization.models';
import type { Device, DeviceCreate, DeviceType, DeviceUpdate } from '../data-access/organization.models';
import { GcOrganizationNav } from '../organization-nav';

interface KitchenStation {id:string;nombre:string;activa:boolean}

@Component({
  selector:'gc-device-detail-page',
  imports:[ReactiveFormsModule,GcPageHeader,GcButtonDirective,GcErrorState,GcOrganizationNav],
  template:`
  <div class="gc-org-page gc-org-page--form">
    <gc-page-header [title]="isNew ? 'Nuevo dispositivo' : (device.data()?.nombre ?? 'Dispositivo')"/>
    <gc-organization-nav />
    @if (device.busy()) {<p role="status" class="gc-org-muted">Cargando dispositivo…</p>}
    @if (device.status()==='error') {
      <gc-error-state [message]="readError()" (retry)="reload()" />
    }
    @if (isNew || device.data()) {
      <section class="gc-org-card gc-org-narrow">
        <form [formGroup]="form" class="gc-org-form" (ngSubmit)="save()" novalidate>
          <div class="gc-org-grid">
            <div class="gc-org-field">
              <label for="dv-code">Código</label>
              <input id="dv-code" formControlName="codigo" maxlength="32"
                placeholder="Ej. POS_CAJA_01" spellcheck="false"
                [attr.aria-invalid]="form.controls.codigo.invalid && form.controls.codigo.touched"
                [attr.aria-describedby]="form.controls.codigo.invalid && form.controls.codigo.touched ? 'dv-code-error' : null" />
              @if (form.controls.codigo.touched && form.controls.codigo.invalid) {
                <small id="dv-code-error" class="gc-org-error">Usa entre 2 y 32 caracteres: letras, números, guion o guion bajo.</small>
              }
            </div>
            <div class="gc-org-field">
              <label for="dv-name">Nombre</label>
              <input id="dv-name" formControlName="nombre" maxlength="120"
                placeholder="Ej. Caja principal"
                [attr.aria-invalid]="form.controls.nombre.invalid && form.controls.nombre.touched"
                [attr.aria-describedby]="form.controls.nombre.invalid && form.controls.nombre.touched ? 'dv-name-error' : null" />
              @if (form.controls.nombre.invalid && form.controls.nombre.touched) {
                <small id="dv-name-error" class="gc-org-error">Introduce un nombre.</small>
              }
            </div>
            <div class="gc-org-field">
              <label for="dv-branch">Sucursal</label>
              <select id="dv-branch" formControlName="sucursalId" (change)="loadStations()">
                <option value="">Seleccionar sucursal</option>
                @for (item of branch.branches(); track item.id) {
                  <option [value]="item.id">{{ item.nombre }}</option>
                }
              </select>
            </div>
            <div class="gc-org-field">
              <label for="dv-type">Tipo</label>
              <select id="dv-type" formControlName="tipo" (change)="onType()">
                @for (item of types; track item.value) {
                  <option [value]="item.value">{{ item.label }}</option>
                }
              </select>
            </div>
            @if (form.controls.tipo.value==='KDS') {
              <div class="gc-org-field">
                <label for="dv-station">Estación de preparación</label>
                <select id="dv-station" formControlName="estacionPreparacionId">
                  <option value="">Sin estación</option>
                  @for (item of stations(); track item.id) {
                    <option [value]="item.id">{{ item.nombre }}</option>
                  }
                </select>
                @if (stationError()) {<small class="gc-org-error">{{ stationError() }}</small>}
              </div>
            }
          </div>
          @if (error()) {<p class="gc-org-alert" role="alert">{{ error() }}</p>}
          <div class="gc-org-actions">
            <button gcButton type="submit" [disabled]="!canManage() || !form.dirty || action.busy()">
              {{ action.busy() ? 'Guardando…' : (isNew ? 'Registrar dispositivo' : 'Guardar cambios') }}
            </button>
            @if (!canManage()) { <span class="gc-org-muted">Solo lectura</span> }
          </div>
        </form>
      </section>
      @if (!isNew && device.data()) {
        <section class="gc-org-card gc-org-narrow gc-org-page">
          <div class="gc-org-row"><h2>Estado</h2>
            <span class="gc-org-status">{{ device.data()?.activo ? 'Activo' : 'Inactivo' }}</span>
          </div>
          @if (form.dirty) {
            <p class="gc-org-muted">Guarda los cambios pendientes antes de modificar el estado.</p>
          }
          <div class="gc-org-field">
            <label for="dv-reason">Motivo</label>
            <input id="dv-reason" maxlength="500" [value]="reason()"
              placeholder="Ej. Equipo en mantenimiento"
              aria-describedby="dv-reason-help" (input)="reason.set($any($event.target).value)"/>
            <small id="dv-reason-help">Mínimo 3 caracteres.</small>
          </div>
          @if (statusError()) {<p class="gc-org-alert" role="alert">{{ statusError() }}</p>}
          <div class="gc-org-actions">
            <button type="button" gcButton [variant]="device.data()?.activo ? 'danger':'secondary'"
              [disabled]="!canManage() || statusAction.busy() || form.dirty || reason().trim().length<3"
              (click)="changeStatus()">
              {{ device.data()?.activo ? 'Desactivar dispositivo' : 'Activar dispositivo' }}
            </button>
          </div>
        </section>
      }
    }
  </div>
  `,
  styleUrl:'../organization.scss',
})
export class GcDeviceDetailPage implements OnInit {
  private readonly api=inject(DevicesApi);
  private readonly route=inject(ActivatedRoute);
  private readonly router=inject(Router);
  private readonly http=inject(HttpClient);
  private readonly branchApi=inject(GcBranchesApi);
  protected readonly branch=inject(GcBranchContext);
  private readonly notify=inject(GcNotificationService);
  private readonly dialogs=inject(ConfirmDialogService);
  protected readonly id=this.route.snapshot.paramMap.get('id')??'new';
  protected readonly isNew=this.id==='new';
  protected readonly types=DEVICE_TYPES;
  protected readonly device=new GcPageState<Device>();
  protected readonly stations=signal<readonly KitchenStation[]>([]);
  protected readonly stationError=signal<string|null>(null);
  protected readonly error=signal<string|null>(null);
  protected readonly statusError=signal<string|null>(null);
  protected readonly reason=signal('');
  protected readonly action=new GcConfirmedAction();
  protected readonly statusAction=new GcConfirmedAction();
  private readonly canEdit=signal(false);
  protected readonly form=new FormGroup({
    codigo:new FormControl('',{nonNullable:true,validators:[Validators.required,
      Validators.pattern(/^[A-Za-z][A-Za-z0-9_-]{1,31}$/)]}),
    nombre:new FormControl('',{nonNullable:true,validators:Validators.required}),
    sucursalId:new FormControl('',{nonNullable:true,validators:Validators.required}),
    tipo:new FormControl<DeviceType>('POS',{nonNullable:true}),
    estacionPreparacionId:new FormControl(''),
  });
  ngOnInit():void {void this.initialize();}
  private async initialize():Promise<void> {
    if(this.isNew) {
      const id=this.branch.branchId()??'';
      this.form.patchValue({sucursalId:id});
      await this.checkAccess(id);
      return;
    }
    await this.load();
  }
  protected canManage():boolean {return this.canEdit();}
  protected readError():string {return gcErrorMessage(this.device.error());}
  protected reload():void {void this.load();}
  private async checkAccess(branchId:string):Promise<void> {
    this.canEdit.set(false);
    if(!branchId)return;
    try {
      const response=await firstValueFrom(this.branchApi.capabilities(branchId));
      this.canEdit.set(response.permissions.includes('devices.manage'));
    }catch{this.canEdit.set(false);}
  }
  protected onType():void {
    if(this.form.controls.tipo.value!=='KDS') this.form.controls.estacionPreparacionId.setValue('');
    else void this.loadStations();
  }
  protected loadStations():void {void this.refreshStations();}
  private async refreshStations():Promise<void> {
    const branchId=this.form.controls.sucursalId.value;
    await this.checkAccess(branchId);
    this.stations.set([]);
    this.stationError.set(null);
    if (this.form.controls.tipo.value!=='KDS'||!branchId) return;
    try {
      const stations=await firstValueFrom(this.http.get<KitchenStation[]>('/api/kitchen/stations',
        {params:{sucursalId:branchId}}));
      this.stations.set(stations.filter(x=>x.activa));
    } catch (error:unknown) {this.stationError.set(gcErrorMessage(error));}
  }
  private async load():Promise<void> {
    await this.device.load(()=>firstValueFrom(this.api.get(this.id)));
    const value=this.device.data();if(!value)return;
    this.form.reset({codigo:value.codigo,nombre:value.nombre,sucursalId:value.sucursalId,
      tipo:value.tipo,estacionPreparacionId:value.estacionPreparacionId??''});
    this.form.controls.codigo.disable();
    this.form.controls.sucursalId.disable();
    await this.checkAccess(value.sucursalId);
    if (!this.canManage()) this.form.disable();
    else {this.form.enable();this.form.controls.codigo.disable();this.form.controls.sucursalId.disable();}
    await this.refreshStations();
  }
  protected async save():Promise<void> {
    if(!this.canManage()||this.action.busy())return;
    if(this.form.invalid){this.form.markAllAsTouched();return;}
    const v=this.form.getRawValue();
    const dto:DeviceCreate={codigo:v.codigo.trim().toUpperCase(),nombre:v.nombre.trim(),
      sucursalId:v.sucursalId,tipo:v.tipo,
      estacionPreparacionId:v.tipo==='KDS' ? (v.estacionPreparacionId||null):null};
    if(dto.tipo==='KDS' && dto.estacionPreparacionId && this.stationError()) {
      this.error.set('No se pudo verificar la estación seleccionada.');return;
    }
    this.error.set(null);
    const prior=this.device.data();
    const changes:DeviceUpdate={};
    if(prior){
      if(dto.nombre!==prior.nombre)changes.nombre=dto.nombre;
      if(dto.tipo!==prior.tipo)changes.tipo=dto.tipo;
      if(dto.estacionPreparacionId!==prior.estacionPreparacionId)
        changes.estacionPreparacionId=dto.estacionPreparacionId;
      if(!Object.keys(changes).length){this.form.markAsPristine();return;}
    }
    const result = await this.action.runConfirmed(this.dialogs, {
      title: this.isNew ? 'Registrar dispositivo' : 'Guardar cambios de dispositivo',
      message: this.isNew
        ? '¿Registrar el dispositivo «' + dto.nombre + '»?'
        : '¿Guardar los cambios de este dispositivo?',
      confirmText: this.isNew ? 'Registrar dispositivo' : 'Guardar cambios',
    }, () => firstValueFrom(this.isNew
      ? this.api.create(dto) : this.api.update(this.id, changes)));
    if (!result) return;
    if (!result.ok) {if(result.reason==='error')this.error.set(gcErrorMessage(result.error));return;}
    this.notify.show(this.isNew?'Dispositivo registrado.':'Dispositivo actualizado.','success');
    if(this.isNew) { this.form.markAsPristine(); await this.router.navigate(['/organization/devices',result.value.id]);
    } else await this.load();
  }
  protected async changeStatus():Promise<void> {
    if(!this.canManage()||this.statusAction.busy()||this.reason().trim().length<3)return;
    const current=this.device.data();if(!current)return;
    const next=!current.activo;
    this.statusError.set(null);
    const result = await this.statusAction.runConfirmed(this.dialogs, {
      title: next ? 'Activar dispositivo' : 'Desactivar dispositivo',
      message: next ? '¿Activar este dispositivo?' : '¿Desactivar este dispositivo?',
      confirmText: next ? 'Activar' : 'Desactivar',
      danger: !next,
    }, () => firstValueFrom(this.api.status(this.id, next, this.reason().trim())));
    if (!result) return;
    if (!result.ok) {if(result.reason==='error')this.statusError.set(gcErrorMessage(result.error));return;}
    this.reason.set('');this.notify.show(next?'Dispositivo activado.':'Dispositivo desactivado.','success');
    await this.load();
  }
  hasUnsavedChanges():boolean {return this.form.dirty && !this.action.busy();}
}
