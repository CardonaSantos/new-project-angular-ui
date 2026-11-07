
import {Component,computed,inject,signal} from '@angular/core';
import {ActivatedRoute,Router} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {CustomersApi} from '../data-access/customers.api';

@Component({
 selector:'gc-customer-create-page',
 imports:[GcPageHeader,GcButtonDirective],
 template:`
 <div class="cus-page cus-narrow">
  <gc-page-header title="Nuevo cliente"/>
  <section class="cus-card">
   <div class="cus-grid">
    <div class="cus-field"><label for="cc-nombre">Nombre</label>
     <input id="cc-nombre" [value]="nombre()" (input)="setNombre($any($event.target).value)" maxlength="180"/>
    </div>
    <div class="cus-field"><label for="cc-nit">NIT</label>
     <input id="cc-nit" [value]="nit()" (input)="setNit($any($event.target).value)" maxlength="40"/>
    </div>
    <div class="cus-field"><label for="cc-telefono">Teléfono</label>
     <input id="cc-telefono" [value]="telefono()" (input)="setTelefono($any($event.target).value)" maxlength="45"/>
    </div>
    <div class="cus-field"><label for="cc-email">Email</label>
     <input id="cc-email" type="email" [value]="email()" (input)="setEmail($any($event.target).value)" maxlength="254"/>
    </div>
   </div>
   <div class="cus-field"><label for="cc-notas">Notas</label>
    <textarea id="cc-notas" rows="2" [value]="notas()" (input)="setNotas($any($event.target).value)" maxlength="1000"></textarea>
   </div>
   @if(error()){<p class="cus-alert" role="alert">{{error()}}</p>}
   <div class="cus-actions">
    <button type="button" gcButton [disabled]="!valid()||action.busy()" (click)="save()">
     {{action.busy()?'Creando…':'Crear cliente'}}</button>
   </div>
  </section>
 </div>`,
 styleUrl:'../customers.scss'
})
export class GcCustomerCreatePage {
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly branch=inject(GcBranchContext);
 private readonly api=inject(CustomersApi);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 protected readonly nombre=signal('');
 protected readonly nit=signal('');
 protected readonly telefono=signal('');
 protected readonly email=signal('');
 protected readonly notas=signal('');
 protected readonly error=signal<string|null>(null);
 protected readonly action=new GcConfirmedAction();
 protected readonly valid=computed(()=>this.nombre().trim().length>=2);
 private dirty=false;
 private key=crypto.randomUUID();
 private get sucursalId(){return this.route.snapshot.queryParamMap.get('sucursalId')??this.branch.branchId()??''}
 private markDirty(){this.dirty=true;this.key=crypto.randomUUID()}
 protected setNombre(v:string){this.nombre.set(v);this.markDirty()}
 protected setNit(v:string){this.nit.set(v);this.markDirty()}
 protected setTelefono(v:string){this.telefono.set(v);this.markDirty()}
 protected setEmail(v:string){this.email.set(v);this.markDirty()}
 protected setNotas(v:string){this.notas.set(v);this.markDirty()}
 protected async save(){
  if(!this.valid()||this.action.busy()||!this.sucursalId)return;
  this.error.set(null);
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Crear cliente',message:'¿Crear el cliente «'+this.nombre().trim()+'»?',confirmText:'Crear cliente'},
   ()=>firstValueFrom(this.api.create({sucursalId:this.sucursalId,claveOperacion:this.key,
    nombre:this.nombre().trim(),nit:this.nit().trim()||null,telefono:this.telefono().trim()||null,
    email:this.email().trim()||null,notas:this.notas().trim()||null})));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.error.set(gcErrorMessage(r.error));return}
  this.dirty=false;
  this.notices.show('Cliente creado.','success');
  await this.router.navigate(['/customers',r.value.id]);
 }
 hasUnsavedChanges(){return this.dirty&&!this.action.busy()}
}
