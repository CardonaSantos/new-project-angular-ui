
import {Component,inject,OnInit,signal} from '@angular/core';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {FormControl,FormGroup,ReactiveFormsModule,Validators} from '@angular/forms';
import {firstValueFrom} from 'rxjs';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {gcErrorMessage} from '../../../core/http/api-error';
import {RolesApi} from '../data-access/users.api';
import {UsersAccess} from '../data-access/users-access';
import type {Role,PermissionGroup,Scope} from '../data-access/users.models';
import {GcUsersNav} from '../users-nav';
@Component({
 selector:'gc-role-detail-page',
 imports:[ReactiveFormsModule,GcPageHeader,GcButtonDirective,GcErrorState,GcUsersNav,RouterLink],
 template:`
 <div class="gc-u-page gc-u-narrow">
  <gc-page-header [title]="isNew?'Nuevo rol':(role.data()?.nombre??'Rol')"/>
  <gc-users-nav/>
  @if(role.busy()){<p role="status" class="gc-u-muted">Cargando rol…</p>}
  @if(role.status()==='error'){<gc-error-state [message]="readError()" (retry)="reload()"/>}
  @if(isNew||role.data()){
   <section class="gc-u-card gc-u-page">
    <form class="gc-u-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
     <h2>Información</h2>
     <div class="gc-u-grid">
      <div class="gc-u-field"><label for="role-code">Código</label>
       <input id="role-code" formControlName="codigo" maxlength="50" placeholder="Ej. CAJERO"
        [attr.aria-invalid]="form.controls.codigo.touched&&form.controls.codigo.invalid"/>
       @if(form.controls.codigo.touched&&form.controls.codigo.invalid){<small class="gc-u-error">Código en mayúsculas, letras, números y guion bajo.</small>}
      </div>
      <div class="gc-u-field"><label for="role-name">Nombre</label>
       <input id="role-name" formControlName="nombre" maxlength="100" placeholder="Ej. Cajero"
        [attr.aria-invalid]="form.controls.nombre.touched&&form.controls.nombre.invalid"/>
      </div>
      <div class="gc-u-field"><label for="role-scope">Alcance</label>
       <select id="role-scope" formControlName="alcance">
        <option value="SUCURSAL">Por sucursal</option><option value="GLOBAL">Global</option>
       </select>
      </div>
      @if(!isNew){
       <div class="gc-u-field"><label for="role-active">Estado</label>
        <select id="role-active" formControlName="activo">
         <option [ngValue]="true">Activo</option><option [ngValue]="false">Inactivo</option>
        </select>
       </div>
      }
     </div>
     <div class="gc-u-field"><label for="role-description">Descripción</label>
      <textarea id="role-description" formControlName="descripcion" rows="3" maxlength="500"
        placeholder="Ej. Personal de caja"></textarea>
     </div>
     @if(error()){<p class="gc-u-alert" role="alert">{{error()}}</p>}
     <div class="gc-u-actions"><button gcButton type="submit"
       [disabled]="!access.canGlobal('roles.manage')||form.invalid||(!isNew&&!form.dirty)||action.busy()">
       {{action.busy()?'Guardando…':isNew?'Crear rol':'Guardar cambios'}}</button></div>
    </form>
   </section>
   @if(!isNew&&role.data()){
    <section class="gc-u-card gc-u-page">
     <div class="gc-u-row"><h2>Permisos</h2><span class="gc-u-muted">{{selected().length}} seleccionados</span></div>
     @for(group of groups();track group.module){
      <section><h3>{{group.module}}</h3>
       <div class="gc-u-check-list">
        @for(p of group.permissions;track p.codigo){
         <label class="gc-u-check">
          <input type="checkbox" [checked]="selected().includes(p.codigo)"
           [disabled]="!access.canGlobal('roles.manage')" (change)="toggle(p.codigo,$any($event.target).checked)"/>
          <span>{{p.nombre||p.codigo}}</span>
         </label>
        }
       </div>
      </section>
     }
     @if(permissionError()){<p role="alert" class="gc-u-alert">{{permissionError()}}</p>}
     <div class="gc-u-actions"><button gcButton type="button"
       [disabled]="!access.canGlobal('roles.manage')||!permissionDirty()||permissionAction.busy()"
       (click)="savePermissions()">Guardar permisos</button></div>
    </section>
   }
  }
 </div>`,
 styleUrl:'../users.scss'
})
export class GcRoleDetailPage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly api=inject(RolesApi);
 protected readonly access=inject(UsersAccess);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 protected readonly id=this.route.snapshot.paramMap.get('id')??this.route.snapshot.parent?.paramMap.get('id')??'new';
 protected readonly isNew=this.id==='new';
 protected readonly role=new GcPageState<Role>();
 protected readonly groups=signal<PermissionGroup[]>([]);
 protected readonly selected=signal<string[]>([]);
 private readonly savedPermissions=signal<string[]>([]);
 protected readonly error=signal<string|null>(null);
 protected readonly permissionError=signal<string|null>(null);
 protected readonly action=new GcConfirmedAction();
 protected readonly permissionAction=new GcConfirmedAction();
 protected readonly form=new FormGroup({
  codigo:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.pattern(/^[A-Z][A-Z0-9_]{1,49}$/)]}),
  nombre:new FormControl('',{nonNullable:true,validators:Validators.required}),
  alcance:new FormControl<Scope>('SUCURSAL',{nonNullable:true}),
  activo:new FormControl(true,{nonNullable:true}),
  descripcion:new FormControl(''),
 });
 async ngOnInit(){
  try{if(!this.access.loaded())await this.access.load()}catch{/* role ACL */}
  if(!this.isNew)await this.load();
  if(this.access.canGlobal('roles.read')){
   try{const r=await firstValueFrom(this.api.permissions());this.groups.set(r.data)}
   catch{/* errors handled globally */}
  }
 }
 protected readError(){return gcErrorMessage(this.role.error())}
 protected reload(){void this.load()}
 private async load(){
  await this.role.load(()=>firstValueFrom(this.api.get(this.id)));
  const r=this.role.data();if(!r)return;
  this.form.reset({codigo:r.codigo,nombre:r.nombre,alcance:r.alcance,activo:r.activo,
    descripcion:r.descripcion??''});
  this.form.controls.codigo.disable();this.form.controls.alcance.disable();
  if(!this.access.canGlobal('roles.manage'))this.form.disable();
  const values=[...r.permisos];this.savedPermissions.set(values);this.selected.set(values);
 }
 protected permissionDirty(){
  return this.selected().slice().sort().join('|')!==this.savedPermissions().slice().sort().join('|');
 }
 protected toggle(code:string,checked:boolean){
  this.selected.update(values=>checked?[...new Set([...values,code])]:values.filter(x=>x!==code));
 }
 protected async save(){
  if(this.form.invalid){this.form.markAllAsTouched();return}
  const v=this.form.getRawValue();
  this.error.set(null);
  const r=await this.action.runConfirmed(this.dialog,{
   title:this.isNew?'Crear rol':'Guardar rol',
   message:this.isNew?'¿Crear este rol?':'¿Guardar los cambios de este rol?',
   confirmText:this.isNew?'Crear rol':'Guardar cambios',danger:!v.activo,
  },()=>this.isNew
   ?firstValueFrom(this.api.create({codigo:v.codigo,nombre:v.nombre.trim(),alcance:v.alcance,
      ...(v.descripcion?.trim()?{descripcion:v.descripcion.trim()}:{})}))
   :firstValueFrom(this.api.update(this.id,{nombre:v.nombre.trim(),
      descripcion:v.descripcion?.trim()||null,activo:v.activo})));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.error.set(gcErrorMessage(r.error));return}
  this.form.markAsPristine();
  if(this.isNew)await this.router.navigate(['/users/roles',r.value.id]);
  else{await this.load();this.notices.show('Rol actualizado.','success')}
 }
 protected async savePermissions(){
  if(!this.permissionDirty())return;
  this.permissionError.set(null);
  const r=await this.permissionAction.runConfirmed(this.dialog,{
   title:'Actualizar permisos',
   message:'Los cambios pueden modificar el acceso de los usuarios asignados. ¿Continuar?',
   confirmText:'Guardar permisos',danger:true,
  },()=>firstValueFrom(this.api.replacePermissions(this.id,this.selected())));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.permissionError.set(gcErrorMessage(r.error));return}
  await this.load();this.notices.show('Permisos actualizados.','success');
 }
 hasUnsavedChanges(){return this.form.dirty||this.permissionDirty()}
}
