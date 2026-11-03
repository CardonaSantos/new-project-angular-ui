
import {Component,inject,OnInit,signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {ActivatedRoute} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcPagination,type GcPageChange} from '../../../design-system/data/gc-pagination';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {GcSessionService} from '../../../core/auth/gc-session.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {gcErrorMessage} from '../../../core/http/api-error';
import {UsersApi} from '../data-access/users.api';
import type {Page,Session} from '../data-access/users.models';
@Component({
 selector:'gc-user-security-page',
 imports:[DatePipe,GcPageHeader,GcButtonDirective,GcErrorState,GcPagination],
 template:`
 <div class="gc-u-page gc-u-narrow">
  <gc-page-header title="Sesiones y contraseña"/>
  <section class="gc-u-card gc-u-page">
   <h2>Restablecer contraseña</h2>
   <div class="gc-u-inline-action">
    <div class="gc-u-field">
     <label for="security-reason">Motivo</label>
     <input id="security-reason" [value]="reason()" (input)="reason.set($any($event.target).value)"
        placeholder="Ej. Solicitud del empleado" maxlength="500"/>
    </div>
    <button type="button" gcButton [disabled]="reason().trim().length<3||reset.busy()||isSelf()||!!resetSecret()"
     (click)="resetPassword()">Restablecer contraseña</button>
   </div>
   @if(resetSecret()){
    <div class="gc-u-secret" role="status">
     <strong>Contraseña temporal</strong>
     <span class="gc-u-muted">Se muestra una sola vez. Las sesiones anteriores se revocaron.</span>
     <code class="gc-u-code">{{resetSecret()}}</code>
     <div class="gc-u-actions">
      <button type="button" gcButton (click)="copySecret()">Copiar contraseña</button>
      <button type="button" gcButton variant="outline" (click)="resetSecret.set(null)">Cerrar</button>
     </div>
    </div>
   }
   @if(resetError()){<p class="gc-u-alert" role="alert">{{resetError()}}</p>}
  </section>
  <section class="gc-u-card gc-u-page">
   <div class="gc-u-row"><h2>Sesiones</h2><button type="button" gcButton variant="outline"
    [disabled]="reason().trim().length<3||revoke.busy()||isSelf()" (click)="revokeAll()">Revocar todas</button></div>
   @if(sessions.busy()){<p role="status" class="gc-u-muted">Cargando sesiones…</p>}
   @if(sessions.status()==='error'){<gc-error-state [message]="readError()" (retry)="reload()"/>}
   @if(sessions.data();as collection){
    @for(item of collection.data;track item.id){
     <div class="gc-u-row">
      <div>
       <strong>{{item.dispositivoNombre||item.userAgent||'Sesión'}}</strong>
       <p class="gc-u-muted">{{item.active?'Activa':'Finalizada'}} · {{item.creadaEn| date:'medium'}}</p>
      </div>
      @if(item.active){
       <button type="button" gcButton variant="outline" [disabled]="reason().trim().length<3||revoke.busy()||isSelf()"
         (click)="revokeOne(item.id)">Revocar</button>
      }
     </div>
    } @empty{<p class="gc-u-muted">No hay sesiones.</p>}
    <gc-pagination [index]="index()" [size]="size()" [total]="collection.meta.total"
      (pageChange)="onPage($event)"/>
   }
   @if(revokeError()){<p class="gc-u-alert" role="alert">{{revokeError()}}</p>}
  </section>
 </div>`,
 styleUrl:'../users.scss'
})
export class GcUserSecurityPage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 private readonly api=inject(UsersApi);
 private readonly session=inject(GcSessionService);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 protected readonly id=this.route.snapshot.paramMap.get('id')??this.route.snapshot.parent?.paramMap.get('id')??'';
 protected readonly sessions=new GcPageState<Page<Session>>();
 protected readonly reset=new GcConfirmedAction();
 protected readonly revoke=new GcConfirmedAction();
 protected readonly reason=signal('');
 protected readonly resetSecret=signal<string|null>(null);
 protected readonly resetError=signal<string|null>(null);
 protected readonly revokeError=signal<string|null>(null);
 protected readonly index=signal(0);protected readonly size=signal(10);
 ngOnInit(){void this.load()}
 protected isSelf(){return this.session.user()?.id===this.id}
 protected readError(){return gcErrorMessage(this.sessions.error())}
 protected reload(){void this.load()}
 private async load(){await this.sessions.load(()=>firstValueFrom(this.api.sessions(this.id,this.index()+1,this.size())))}
 protected onPage(e:GcPageChange){this.index.set(e.index);this.size.set(e.size);void this.load()}
 protected async resetPassword(){
  if(this.reason().trim().length<3||this.isSelf()||this.resetSecret())return;
  this.resetError.set(null);
  const r=await this.reset.runConfirmed(this.dialog,{title:'Restablecer contraseña',
   message:'Se revocarán las sesiones del usuario. ¿Continuar?',
   confirmText:'Restablecer',danger:true},
   ()=>firstValueFrom(this.api.resetPassword(this.id,this.reason().trim())));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.resetError.set(gcErrorMessage(r.error));return}
  this.resetSecret.set(r.value.temporaryPassword);this.reason.set('');
  await this.load();
 }
 protected async revokeOne(sid:string){await this.revokeSessions(sid)}
 protected async revokeAll(){await this.revokeSessions()}
 private async revokeSessions(sid?:string){
  if(this.reason().trim().length<3||this.isSelf())return;
  this.revokeError.set(null);
  const r=await this.revoke.runConfirmed(this.dialog,{
   title:sid?'Revocar sesión':'Revocar todas las sesiones',
   message:sid?'El usuario tendrá que volver a iniciar sesión en este dispositivo.':
    'El usuario tendrá que volver a iniciar sesión en todos sus dispositivos.',
   confirmText:'Revocar',danger:true},
   ()=>firstValueFrom(this.api.revokeSessions(this.id,this.reason().trim(),sid)));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.revokeError.set(gcErrorMessage(r.error));return}
  this.reason.set('');
  this.notices.show('Sesiones revocadas.','success');await this.load();
 }
 protected async copySecret(){
  if(!this.resetSecret())return;
  try{await navigator.clipboard.writeText(this.resetSecret()!);
   this.notices.show('Contraseña copiada.','success')}
  catch{this.notices.show('Selecciona la contraseña para copiarla.','error')}
 }
 hasUnsavedChanges(){return !!this.resetSecret()}
}
