
import {Component,inject,OnInit,signal,viewChild} from '@angular/core';
import {FormControl,FormGroup,ReactiveFormsModule,Validators} from '@angular/forms';
import {firstValueFrom} from 'rxjs';
import {GcFileUpload} from '../../../design-system/forms/gc-file-upload';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {UsersAccess} from '../data-access/users-access';
import {GcCurrentAvatarStore} from '../../../core/auth/gc-current-avatar.store';
import {GcUserAvatar} from '../../../design-system/profile/gc-user-avatar';
import {MediaApi,UsersApi} from '../data-access/users.api';
import type {UserRecord} from '../data-access/users.models';
@Component({
 selector:'gc-my-profile-page',
 imports:[ReactiveFormsModule,GcFileUpload,GcPageHeader,GcButtonDirective,GcErrorState,GcUserAvatar],
 template:`
 <div class="gc-u-page gc-u-narrow">
  <gc-page-header title="Mi perfil"/>
  @if(page.busy()){<p role="status" class="gc-u-muted">Cargando perfil…</p>}
  @if(page.status()==='error'){<gc-error-state [message]="readError()" (retry)="reload()"/>}
  @if(page.data();as user){
   <section class="gc-u-card gc-u-page">
    <div class="gc-u-avatar-row">
     <gc-user-avatar [url]="user.profile.avatar.url" [name]="user.profile.nombreCompleto" size="lg"/>
     <div><strong>{{user.profile.nombreCompleto}}</strong><p class="gc-u-muted">{{user.profile.email}}</p></div>
    </div>
    <form class="gc-u-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
     <fieldset class="gc-u-section"><legend>1. Preferencias y contacto</legend>
     <div class="gc-u-grid">
      <div class="gc-u-field"><label for="my-last">Apellidos</label>
       <input id="my-last" formControlName="apellidos" maxlength="100" placeholder="Ej. López García"/>
      </div>
      <div class="gc-u-field"><label for="my-phone">Teléfono</label>
       <input id="my-phone" type="tel" autocomplete="tel" formControlName="telefono" maxlength="30" placeholder="Ej. 5555 5555"/>
      </div>
      <div class="gc-u-field"><label for="my-lang">Idioma</label>
       <input id="my-lang" formControlName="idioma" maxlength="16" placeholder="Ej. es-GT"
         [attr.aria-invalid]="form.controls.idioma.touched&&form.controls.idioma.invalid"/>
      </div>
      <div class="gc-u-field"><label for="my-zone">Zona horaria</label>
       <input id="my-zone" formControlName="zonaHoraria" maxlength="64" placeholder="Ej. America/Guatemala"
         [attr.aria-invalid]="form.controls.zonaHoraria.touched&&form.controls.zonaHoraria.invalid"/>
      </div>
     </div>
     @if(error()){<p role="alert" class="gc-u-alert">{{error()}}</p>}
     <div class="gc-u-actions"><button gcButton type="submit" [disabled]="!form.dirty||form.invalid||saving.busy()">
      {{saving.busy()?'Guardando…':'Guardar cambios'}}</button></div>
    </form>
   </section>
   <section class="gc-u-card gc-u-page">
    <h2>Fotografía</h2>
    <gc-file-upload inputId="my-avatar-upload" label="Seleccionar imagen" [maxFiles]="1" [maxSizeMb]="10" [cropSquare]="true" [acceptedMime]="avatarMime"
      (filesSelected)="selected.set($event.length?$event[0]:null);uploadedMediaId.set(null)"/>
    @if(photoError()){<p role="alert" class="gc-u-alert">{{photoError()}}</p>}
    <div class="gc-u-actions">
     <button gcButton type="button" [disabled]="!selected()||photo.busy()" (click)="savePhoto()">
      {{photo.busy()?'Subiendo…':'Actualizar fotografía'}}</button>
     @if(user.profile.avatar.mediaId){
      <button gcButton variant="outline" type="button" [disabled]="photo.busy()" (click)="removePhoto()">Quitar fotografía</button>
     }
    </div>
   </section>
  }
 </div>`,
 styleUrl:'../users.scss'
})
export class GcMyProfilePage implements OnInit {
 private readonly api=inject(UsersApi);
 private readonly avatarStore=inject(GcCurrentAvatarStore);
 private readonly media=inject(MediaApi);
 private readonly photoPicker=viewChild(GcFileUpload);
 private readonly branch=inject(GcBranchContext);
 private readonly access=inject(UsersAccess);
 private readonly notices=inject(GcNotificationService);
 private readonly dialog=inject(ConfirmDialogService);
 protected readonly avatarMime:readonly string[]=['image/jpeg','image/png'];
 protected readonly page=new GcPageState<UserRecord>();
 protected readonly saving=new GcConfirmedAction();
 protected readonly photo=new GcConfirmedAction();
 protected readonly selected=signal<File|null>(null);
 private readonly uploadedMediaId=signal<string|null>(null);
 protected readonly error=signal<string|null>(null);
 protected readonly photoError=signal<string|null>(null);
 protected readonly form=new FormGroup({
  apellidos:new FormControl(''),telefono:new FormControl(''),
  idioma:new FormControl('es-GT',{nonNullable:true,validators:[Validators.required]}),
  zonaHoraria:new FormControl('America/Guatemala',{nonNullable:true,validators:[Validators.required]})
 });
 ngOnInit(){void this.load()}
 protected readError(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load()}
 private async load(){
  await this.page.load(()=>firstValueFrom(this.api.me()));
  const u=this.page.data();
  if(u)this.form.reset({apellidos:u.profile.apellidos??'',telefono:u.profile.telefono??'',
    idioma:u.profile.idioma,zonaHoraria:u.profile.zonaHoraria});
 }
 protected async save(){
  if(this.form.invalid){this.form.markAllAsTouched();return}
  const u=this.page.data();if(!u||!this.form.dirty)return;
  const v=this.form.getRawValue();
  const dto={apellidos:v.apellidos?.trim()||null,telefono:v.telefono?.trim()||null,
    idioma:v.idioma.trim(),zonaHoraria:v.zonaHoraria.trim()};
  this.error.set(null);
  const r=await this.saving.runConfirmed(this.dialog,{title:'Guardar perfil',
    message:'¿Guardar los cambios de tu perfil?',confirmText:'Guardar cambios'},
    ()=>firstValueFrom(this.api.updateMe(dto)));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.error.set(gcErrorMessage(r.error));return}
  this.page.data.set(r.value);this.avatarStore.updateFrom(r.value);this.form.markAsPristine();
  this.notices.show('Perfil actualizado.','success');
 }
 protected async savePhoto(){
  const file=this.selected();if(!file)return;
  this.photoError.set(null);
  const r=await this.photo.runConfirmed(this.dialog,{title:'Actualizar fotografía',
    message:'¿Usar esta imagen como fotografía de perfil?',confirmText:'Actualizar'},
    async()=>{
     const scopedBranch=this.access.canGlobal('media.upload')?undefined:
       (this.branch.branchId()??undefined);
     const mediaId=this.uploadedMediaId()??(await firstValueFrom(this.media.upload(file,'PERFIL',scopedBranch))).id;
     this.uploadedMediaId.set(mediaId);
     return firstValueFrom(this.api.avatarMe(mediaId));
    });
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.photoError.set(gcErrorMessage(r.error));return}
  this.photoPicker()?.reset();this.selected.set(null);this.uploadedMediaId.set(null);this.page.data.set(r.value);
  this.avatarStore.updateFrom(r.value);
  this.notices.show('Fotografía actualizada.','success');
 }
 protected async removePhoto(){
  this.photoError.set(null);
  const r=await this.photo.runConfirmed(this.dialog,{title:'Quitar fotografía',
    message:'¿Quitar tu fotografía de perfil?',confirmText:'Quitar fotografía',danger:true},
    ()=>firstValueFrom(this.api.avatarMe(null)));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.photoError.set(gcErrorMessage(r.error));return}
  this.page.data.set(r.value);this.avatarStore.updateFrom(r.value);
  this.notices.show('Fotografía eliminada del perfil.','success');
 }
 hasUnsavedChanges(){return this.form.dirty||!!this.selected()}
}
