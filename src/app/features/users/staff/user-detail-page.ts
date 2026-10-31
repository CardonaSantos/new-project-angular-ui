
import {Component,inject,OnInit,signal} from '@angular/core';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {ReactiveFormsModule,FormControl,FormGroup,Validators} from '@angular/forms';
import {firstValueFrom} from 'rxjs';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcFileUpload} from '../../../design-system/forms/gc-file-upload';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcSessionService} from '../../../core/auth/gc-session.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {gcErrorMessage} from '../../../core/http/api-error';
import {UsersApi,RolesApi,MediaApi} from '../data-access/users.api';
import {UsersAccess} from '../data-access/users-access';
import type {UserRecord,Role,UserUpdate,CredentialsIssued} from '../data-access/users.models';
import {GcUsersNav} from '../users-nav';
@Component({
 selector:'gc-user-detail-page',
 imports:[ReactiveFormsModule,RouterLink,GcPageHeader,GcButtonDirective,GcUsersNav,GcFileUpload,GcErrorState],
 template:`
 <div class="gc-u-page gc-u-narrow">
  <gc-page-header [title]="isNew?'Nuevo usuario':(page.data()?.profile?.nombreCompleto??'Usuario')"/>
  <gc-users-nav/>
  @if(!isNew&&page.busy()){<p role="status" class="gc-u-muted">Cargando usuario…</p>}
  @if(!isNew&&page.status()==='error'){<gc-error-state [message]="readError()" (retry)="reload()"/>}
  @if(createdSecret()){
   <section class="gc-u-secret" role="status">
    <strong>Contraseña temporal</strong>
    <span class="gc-u-muted">Se muestra una sola vez. Compártela de forma segura.</span>
    <code class="gc-u-code">{{createdSecret()}}</code>
    <div class="gc-u-actions">
      <button gcButton type="button" (click)="copySecret()">Copiar contraseña</button>
      <button gcButton variant="outline" type="button" (click)="dismissSecret()">Continuar</button>
    </div>
   </section>
  } @else if(isNew||page.data();as user) {
   <section class="gc-u-card gc-u-page">
    <form class="gc-u-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
     <h2>Datos personales</h2>
     <div class="gc-u-grid">
      <div class="gc-u-field"><label for="usr-name">Nombre</label>
       <input id="usr-name" formControlName="nombre" maxlength="100" placeholder="Ej. María"
         [attr.aria-invalid]="form.controls.nombre.touched&&form.controls.nombre.invalid"/>
       @if(form.controls.nombre.touched&&form.controls.nombre.invalid){<small class="gc-u-error">Introduce un nombre.</small>}
      </div>
      <div class="gc-u-field"><label for="usr-last">Apellidos</label>
       <input id="usr-last" formControlName="apellidos" maxlength="100" placeholder="Ej. López García"/>
      </div>
      <div class="gc-u-field"><label for="usr-email">Correo electrónico</label>
       <input id="usr-email" formControlName="email" type="email" autocomplete="off" maxlength="254"
         placeholder="Ej. maria@empresa.com" [attr.aria-invalid]="form.controls.email.touched&&form.controls.email.invalid"/>
       @if(form.controls.email.touched&&form.controls.email.invalid){<small class="gc-u-error">Introduce un correo válido.</small>}
      </div>
      <div class="gc-u-field"><label for="usr-phone">Teléfono</label>
       <input id="usr-phone" formControlName="telefono" type="tel" maxlength="30" placeholder="Ej. 5555 5555"/>
      </div>
      @if(!isNew){
       <div class="gc-u-field"><label for="usr-lang">Idioma</label>
        <input id="usr-lang" formControlName="idioma" maxlength="16" placeholder="Ej. es-GT"/></div>
       <div class="gc-u-field"><label for="usr-zone">Zona horaria</label>
        <input id="usr-zone" formControlName="zonaHoraria" maxlength="64" placeholder="Ej. America/Guatemala"/></div>
      }
     </div>
     @if(saveError()){<p role="alert" class="gc-u-alert">{{saveError()}}</p>}
     <div class="gc-u-actions">
      <button gcButton type="submit" [disabled]="!access.isGlobalAdmin()||form.invalid||(!isNew&&!form.dirty)||saveAction.busy()">
       {{saveAction.busy()?'Guardando…':(isNew?'Crear usuario':'Guardar cambios')}}</button>
     </div>
    </form>
   </section>
   @if(!isNew&&page.data();as user){
    <section class="gc-u-card gc-u-page">
     <div class="gc-u-row"><h2>Asignaciones</h2><span class="gc-u-muted">{{user.access.assignments.length}} registradas</span></div>
     @for(a of user.access.assignments;track a.id??(a.rolId+':'+a.sucursalId)){
      <div class="gc-u-row">
       <span>{{a.rolNombre}} — {{a.sucursalNombre??'Global'}}</span>
       @if(access.canGlobal('users.roles.assign')&&user.id!==session.user()?.id){
        <button type="button" gcButton variant="outline" [disabled]="assignmentAction.busy()||form.dirty"
         (click)="removeAssignment(a.rolId,a.sucursalId)">Quitar</button>
       }
      </div>
     } @empty{<p class="gc-u-muted">Sin roles asignados.</p>}
     @if(access.canGlobal('users.roles.assign')&&user.id!==session.user()?.id){
      <div class="gc-u-grid">
       <div class="gc-u-field"><label for="assign-role">Rol</label>
        <select id="assign-role" [value]="roleId()" (change)="selectRole($any($event.target).value)">
         <option value="">Seleccionar rol</option>
         @for(role of roles();track role.id){<option [value]="role.id">{{role.nombre}}</option>}
        </select>
       </div>
       @if(selectedRoleScope()==='SUCURSAL'){
        <div class="gc-u-field"><label for="assign-branch">Sucursal</label>
         <select id="assign-branch" [value]="assignmentBranch()" (change)="assignmentBranch.set($any($event.target).value)">
          <option value="">Seleccionar sucursal</option>
          @for(b of branch.branches();track b.id){<option [value]="b.id">{{b.nombre}}</option>}
         </select>
        </div>
       }
      </div>
      @if(assignmentError()){<p class="gc-u-alert" role="alert">{{assignmentError()}}</p>}
      <div class="gc-u-actions"><button gcButton type="button"
        [disabled]="!roleId()||(selectedRoleScope()==='SUCURSAL'&&!assignmentBranch())||assignmentAction.busy()||form.dirty"
        (click)="addAssignment()">Asignar rol</button></div>
     }
    </section>
    <section class="gc-u-card gc-u-page">
     <h2>Fotografía</h2>
     <div class="gc-u-avatar-row">
      @if(user.profile.avatar.url){<img class="gc-u-avatar" [src]="user.profile.avatar.url" alt="Fotografía de usuario"/>}
      @else{<div class="gc-u-avatar" aria-label="Sin fotografía">{{user.profile.nombre.slice(0,1)}}</div>}
     </div>
     @if(access.isGlobalAdmin()){
      <gc-file-upload inputId="user-photo" label="Seleccionar imagen" [maxFiles]="1" [maxSizeMb]="10"
        (filesSelected)="photoFile.set($event.length?$event[0]:null);uploadedMediaId.set(null)"/>
      @if(photoError()){<p class="gc-u-alert" role="alert">{{photoError()}}</p>}
      <div class="gc-u-actions">
       <button gcButton type="button" [disabled]="!photoFile()||photoAction.busy()||form.dirty" (click)="savePhoto()">
        {{photoAction.busy()?'Subiendo…':'Actualizar fotografía'}}</button>
       @if(user.profile.avatar.mediaId){<button gcButton variant="outline" type="button" [disabled]="photoAction.busy()||form.dirty"
         (click)="removePhoto()">Quitar fotografía</button>}
      </div>
     }
    </section>
    @if(access.isGlobalAdmin()&&user.id!==session.user()?.id){
     <section class="gc-u-card gc-u-page">
      <h2>Estado de la cuenta</h2>
      <p class="gc-u-muted">{{user.account.activo?'Activa':'Inactiva'}}</p>
      <div class="gc-u-field gc-u-reason"><label for="user-status-reason">Motivo</label>
       <input id="user-status-reason" [value]="reason()" (input)="reason.set($any($event.target).value)"
        maxlength="500" placeholder="Ej. Finalización de contrato"/>
      </div>
      @if(statusError()){<p class="gc-u-alert" role="alert">{{statusError()}}</p>}
      <div class="gc-u-actions"><button type="button" gcButton
       [variant]="user.account.activo?'danger':'secondary'"
       [disabled]="reason().trim().length<3||statusAction.busy()||form.dirty"
       (click)="changeStatus()">{{user.account.activo?'Desactivar usuario':'Activar usuario'}}</button></div>
     </section>
    }
    <nav class="gc-u-card gc-u-actions" aria-label="Más opciones de usuario">
     @if(access.isGlobalAdmin()){<a routerLink="security">Sesiones y contraseña</a>}
     @if(access.canGlobal('users.audit.read')||access.canBranch('users.audit.read')){<a routerLink="audit">Auditoría y actividad</a>}
    </nav>
   }
  }
 </div>`,
 styleUrl:'../users.scss'
})
export class GcUserDetailPage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly api=inject(UsersApi);
 private readonly rolesApi=inject(RolesApi);
 private readonly media=inject(MediaApi);
 protected readonly access=inject(UsersAccess);
 protected readonly branch=inject(GcBranchContext);
 protected readonly session=inject(GcSessionService);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 protected readonly id=this.route.snapshot.paramMap.get('id')??this.route.snapshot.parent?.paramMap.get('id')??'new';
 protected readonly isNew=this.id==='new';
 protected readonly page=new GcPageState<UserRecord>();
 protected readonly saveAction=new GcConfirmedAction();
 protected readonly statusAction=new GcConfirmedAction();
 protected readonly assignmentAction=new GcConfirmedAction();
 protected readonly photoAction=new GcConfirmedAction();
 protected readonly roles=signal<Role[]>([]);
 protected readonly roleId=signal('');
 protected readonly assignmentBranch=signal('');
 protected readonly selectedRoleScope=signal<'GLOBAL'|'SUCURSAL'>('SUCURSAL');
 protected readonly reason=signal('');
 protected readonly photoFile=signal<File|null>(null);
 private readonly uploadedMediaId=signal<string|null>(null);
 protected readonly createdSecret=signal<string|null>(null);
 private readonly createdId=signal<string|null>(null);
 protected readonly saveError=signal<string|null>(null);
 protected readonly assignmentError=signal<string|null>(null);
 protected readonly statusError=signal<string|null>(null);
 protected readonly photoError=signal<string|null>(null);
 protected readonly form=new FormGroup({
  nombre:new FormControl('',{nonNullable:true,validators:Validators.required}),
  apellidos:new FormControl(''),
  email:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.email]}),
  telefono:new FormControl(''),idioma:new FormControl('es-GT',{nonNullable:true}),
  zonaHoraria:new FormControl('America/Guatemala',{nonNullable:true})
 });
 async ngOnInit(){
  if(!this.access.loaded())try{await this.access.load()}catch{/* handled by API */}
  if(this.isNew)return;
  await this.load();
  if(this.access.canGlobal('users.roles.assign'))this.loadRoles();
 }
 protected readError(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load()}
 private async load(){
  await this.page.load(()=>firstValueFrom(this.api.detail(this.id,
   this.access.canGlobal('users.read')?undefined:this.branch.branchId()??undefined)));
  const u=this.page.data();if(!u)return;
  this.form.reset({nombre:u.profile.nombre,apellidos:u.profile.apellidos??'',
   email:u.profile.email,telefono:u.profile.telefono??'',
   idioma:u.profile.idioma,zonaHoraria:u.profile.zonaHoraria});
  if(!this.access.isGlobalAdmin())this.form.disable();
 }
 private async loadRoles(){
  try{const r=await firstValueFrom(this.rolesApi.list({page:1,limit:100,activo:true}));
   this.roles.set(r.data)}catch{/* no invented roles */}
 }
 protected selectRole(id:string){
  this.roleId.set(id);
  const role=this.roles().find(r=>r.id===id);
  this.selectedRoleScope.set(role?.alcance??'SUCURSAL');
  this.assignmentBranch.set('');
 }
 protected async save(){
  if(!this.access.isGlobalAdmin()||this.form.invalid){this.form.markAllAsTouched();return}
  const v=this.form.getRawValue();
  const name=v.nombre.trim(),email=v.email.trim().toLowerCase();
  if(!name||!email)return;
  const dto:UserUpdate={nombre:name,email,apellidos:v.apellidos?.trim()||null,telefono:v.telefono?.trim()||null,
   idioma:v.idioma.trim(),zonaHoraria:v.zonaHoraria.trim()};
  this.saveError.set(null);
  const r=await this.saveAction.runConfirmed<UserRecord|CredentialsIssued>(this.dialog,{
   title:this.isNew?'Crear usuario':'Guardar usuario',
   message:this.isNew?'¿Crear esta cuenta de usuario?':'¿Guardar los cambios de usuario?',
   confirmText:this.isNew?'Crear usuario':'Guardar cambios'
  },()=>this.isNew
    ?firstValueFrom(this.api.create({nombre:name,email,
      ...(v.apellidos?.trim()?{apellidos:v.apellidos.trim()}:{}),
      ...(v.telefono?.trim()?{telefono:v.telefono.trim()}:{} )}))
    :firstValueFrom(this.api.update(this.id,dto)));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.saveError.set(gcErrorMessage(r.error));return}
  if(this.isNew){const created=r.value as CredentialsIssued;
   this.createdId.set(created.user.id);
   this.createdSecret.set(created.temporaryPassword);
   this.form.markAsPristine();}
  else{await this.load();this.notices.show('Usuario actualizado.','success')}
 }
 protected async copySecret(){
  const secret=this.createdSecret();if(!secret)return;
  try{await navigator.clipboard.writeText(secret);this.notices.show('Contraseña copiada.','success')}
  catch{this.notices.show('Selecciona la contraseña para copiarla.','error')}
 }
 protected async dismissSecret(){
  const id=this.createdId();this.createdSecret.set(null);this.createdId.set(null);
  if(id)await this.router.navigate(['/users/staff',id]);
 }
 protected async addAssignment(){
  const id=this.roleId();if(!id||this.assignmentAction.busy())return;
  if(this.form.dirty){this.assignmentError.set('Guarda los cambios del usuario antes de modificar sus roles.');return;}
  const scope=this.selectedRoleScope();
  const sucursalId=scope==='GLOBAL'?null:this.assignmentBranch();
  if(scope==='SUCURSAL'&&!sucursalId)return;
  this.assignmentError.set(null);
  const r=await this.assignmentAction.runConfirmed(this.dialog,{
   title:'Asignar rol',message:'¿Asignar este rol al usuario?',confirmText:'Asignar rol',danger:true,
  },()=>firstValueFrom(this.api.addAssignment(this.id,id,sucursalId)));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.assignmentError.set(gcErrorMessage(r.error));return}
  this.roleId.set('');await this.load();this.notices.show('Rol asignado.','success');
 }
 protected async removeAssignment(roleId:string,branchId:string|null){
  const u=this.page.data();if(!u)return;
  if(this.form.dirty){this.assignmentError.set('Guarda los cambios del usuario antes de modificar sus roles.');return;}
  const next=u.access.assignments.filter(a=>!(a.rolId===roleId&&a.sucursalId===branchId))
    .map(a=>({rolId:a.rolId,sucursalId:a.sucursalId}));
  this.assignmentError.set(null);
  const r=await this.assignmentAction.runConfirmed(this.dialog,{
    title:'Quitar rol',message:'El usuario perderá los permisos de este rol. ¿Continuar?',
    confirmText:'Quitar rol',danger:true
  },()=>firstValueFrom(this.api.replaceAssignments(this.id,next)));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.assignmentError.set(gcErrorMessage(r.error));return}
  await this.load();this.notices.show('Rol eliminado.','success');
 }
 protected async changeStatus(){
  const u=this.page.data();if(!u||this.reason().trim().length<3)return;
  this.statusError.set(null);
  const next=!u.account.activo;
  const r=await this.statusAction.runConfirmed(this.dialog,{
   title:next?'Activar usuario':'Desactivar usuario',
   message:next?'¿Activar esta cuenta?':'La cuenta perderá el acceso al sistema. ¿Desactivarla?',
   confirmText:next?'Activar':'Desactivar',danger:!next
  },()=>firstValueFrom(this.api.status(this.id,next,this.reason().trim())));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.statusError.set(gcErrorMessage(r.error));return}
  this.reason.set('');await this.load();this.notices.show('Estado actualizado.','success');
 }
 protected async savePhoto(){
  const f=this.photoFile();if(!f)return;this.photoError.set(null);
  const r=await this.photoAction.runConfirmed(this.dialog,{
   title:'Actualizar fotografía',message:'¿Usar esta imagen para el usuario?',
   confirmText:'Actualizar'
  },async()=>{
    const id=this.uploadedMediaId()??(await firstValueFrom(this.media.upload(f))).id;
    this.uploadedMediaId.set(id);
    return firstValueFrom(this.api.avatar(this.id,id));
  });
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.photoError.set(gcErrorMessage(r.error));return}
  this.photoFile.set(null);this.uploadedMediaId.set(null);this.page.data.set(r.value);this.notices.show('Fotografía actualizada.','success');
 }
 protected async removePhoto(){
  this.photoError.set(null);
  const r=await this.photoAction.runConfirmed(this.dialog,{
   title:'Quitar fotografía',message:'¿Quitar la fotografía de este usuario?',
   confirmText:'Quitar fotografía',danger:true
  },()=>firstValueFrom(this.api.avatar(this.id,null)));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.photoError.set(gcErrorMessage(r.error));return}
  this.page.data.set(r.value);this.notices.show('Fotografía eliminada.','success');
 }
 hasUnsavedChanges(){return !!this.createdSecret()||this.form.dirty||!!this.photoFile()}
}
