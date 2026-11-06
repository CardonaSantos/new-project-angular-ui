
import {Component,computed,inject,OnInit,signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {CustomersApi} from '../data-access/customers.api';
import {CustomersAccess} from '../data-access/customers-access';
import type {CustomerAddress,CustomerDetail} from '../data-access/customers.models';

const coordinate=/^-?(?:0|[1-9]\d{0,2})(?:\.\d{1,7})?$/;
const operationKey=(kind:string)=>kind+':'+crypto.randomUUID();

@Component({
 selector:'gc-customer-detail-page',
 imports:[GcPageHeader,GcButtonDirective,GcErrorState],
 template:`
 <div class="cus-page cus-narrow">
  <gc-page-header [title]="customer()?.nombre??'Cliente'"/>
  @if(loadError()){<gc-error-state [message]="loadError()!" (retry)="load()"/>}
  @else if(customer();as c){
   <section class="cus-card">
    <div class="cus-row"><h2>Datos del cliente</h2>
     <span class="cus-state-badge" [class.cus-state-badge--inactive]="!c.activo">
      {{c.activo?'Activo':'Inactivo'}}</span></div>
    @if(!editing()){
     <dl class="cus-kv">
      <div><dt>Nombre</dt><dd>{{c.nombre}}</dd></div>
      <div><dt>NIT</dt><dd>{{c.nit??'—'}}</dd></div>
      <div><dt>Teléfono</dt><dd>{{c.telefono??'—'}}</dd></div>
      <div><dt>Email</dt><dd>{{c.email??'—'}}</dd></div>
     </dl>
     <p class="cus-muted">{{c.notas??'Sin notas.'}}</p>
     @if(canManage()){
      <div class="cus-actions">
       <button type="button" gcButton variant="outline" (click)="startEdit()">Editar</button>
       @if(c.activo){
        <button type="button" gcButton variant="outline" (click)="startDeactivate()">Desactivar</button>
       }
      </div>
     }
    }@else{
     <div class="cus-grid">
      <div class="cus-field"><label for="ce-nombre">Nombre</label>
       <input id="ce-nombre" [value]="eNombre()" (input)="setE('nombre',$any($event.target).value)" maxlength="180"/>
      </div>
      <div class="cus-field"><label for="ce-nit">NIT</label>
       <input id="ce-nit" [value]="eNit()" (input)="setE('nit',$any($event.target).value)" maxlength="40"/>
      </div>
      <div class="cus-field"><label for="ce-telefono">Teléfono</label>
       <input id="ce-telefono" [value]="eTelefono()" (input)="setE('telefono',$any($event.target).value)" maxlength="45"/>
      </div>
      <div class="cus-field"><label for="ce-email">Email</label>
       <input id="ce-email" type="email" [value]="eEmail()" (input)="setE('email',$any($event.target).value)" maxlength="254"/>
      </div>
     </div>
     <div class="cus-field"><label for="ce-notas">Notas</label>
      <textarea id="ce-notas" rows="2" [value]="eNotas()" (input)="setE('notas',$any($event.target).value)" maxlength="1000"></textarea>
     </div>
     @if(saveError()){<p class="cus-alert" role="alert">{{saveError()}}</p>}
     <div class="cus-actions">
      <button type="button" gcButton [disabled]="!eValid()||action.busy()" (click)="saveEdit()">
       {{action.busy()?'Guardando…':'Guardar cambios'}}</button>
      <button type="button" gcButton variant="outline" (click)="cancelEdit()">Cancelar</button>
     </div>
    }
    @if(deactivating()){
     <div class="cus-field"><label for="ce-motivo">Motivo de desactivación (mínimo 5 caracteres)</label>
      <input id="ce-motivo" [value]="motivo()" (input)="motivo.set($any($event.target).value)" maxlength="500"/>
     </div>
     @if(deactivateError()){<p class="cus-alert" role="alert">{{deactivateError()}}</p>}
     <div class="cus-actions">
      <button type="button" gcButton [disabled]="motivo().trim().length<5||action.busy()" (click)="confirmDeactivate()">
       {{action.busy()?'Desactivando…':'Confirmar desactivación'}}</button>
      <button type="button" gcButton variant="outline" (click)="cancelDeactivate()">Cancelar</button>
     </div>
    }
   </section>

   <section class="cus-card">
    <div class="cus-row"><h2>Direcciones</h2>
     @if(canManage()&&!addingAddress()&&!editingAddressId()){
      <button type="button" gcButton variant="outline" (click)="startAddAddress()">Agregar dirección</button>
     }</div>
    @if(addresses().length===0&&!addingAddress()){<p class="cus-muted">Sin direcciones registradas.</p>}
    @for(a of addresses();track a.id){
     <div class="cus-address-card">
      @if(editingAddressId()!==a.id){
       <div class="cus-row">
        <strong>{{a.alias??'Sin alias'}}</strong>
        <span class="cus-state-badge" [class.cus-state-badge--primary]="a.principal">
         {{a.principal?'Principal':''}}</span>
       </div>
       <p class="cus-muted">{{a.direccion}}</p>
       @if(a.referencia){<p class="cus-muted">Referencia: {{a.referencia}}</p>}
       @if(canManage()&&!addingAddress()&&!editingAddressId()){
        <div class="cus-actions">
         <button type="button" gcButton variant="outline" (click)="startEditAddress(a)">Editar</button>
         @if(!a.principal){
          <button type="button" gcButton variant="outline" (click)="makePrimary(a.id)">Marcar principal</button>
         }
         <button type="button" gcButton variant="outline" (click)="removeAddress(a.id)">Desactivar</button>
        </div>
       }
      }@else{
       <div class="cus-grid">
        <div class="cus-field"><label>Alias</label>
         <input [value]="eAlias()" (input)="eAlias.set($any($event.target).value)" maxlength="100"/>
        </div>
        <div class="cus-field"><label>Dirección</label>
         <input [value]="eDireccion()" (input)="eDireccion.set($any($event.target).value)" maxlength="500"/>
        </div>
        <div class="cus-field"><label>Referencia</label>
         <input [value]="eReferencia()" (input)="eReferencia.set($any($event.target).value)" maxlength="500"/>
        </div>
        <div class="cus-field"><label>Latitud</label>
         <input [value]="eLatitud()" (input)="eLatitud.set($any($event.target).value)" placeholder="Ej. 14.6349"/>
        </div>
        <div class="cus-field"><label>Longitud</label>
         <input [value]="eLongitud()" (input)="eLongitud.set($any($event.target).value)" placeholder="Ej. -90.5069"/>
        </div>
       </div>
       @if(addressError()){<p class="cus-alert" role="alert">{{addressError()}}</p>}
       <div class="cus-actions">
        <button type="button" gcButton [disabled]="!addressValid()||action.busy()" (click)="saveAddressEdit(a.id)">
         {{action.busy()?'Guardando…':'Guardar dirección'}}</button>
        <button type="button" gcButton variant="outline" (click)="cancelAddressEdit()">Cancelar</button>
       </div>
      }
     </div>
    }
    @if(addingAddress()){
     <div class="cus-address-card">
      <div class="cus-grid">
       <div class="cus-field"><label>Alias</label>
        <input [value]="eAlias()" (input)="eAlias.set($any($event.target).value)" maxlength="100"/>
       </div>
       <div class="cus-field"><label>Dirección</label>
        <input [value]="eDireccion()" (input)="eDireccion.set($any($event.target).value)" maxlength="500"/>
       </div>
       <div class="cus-field"><label>Referencia</label>
        <input [value]="eReferencia()" (input)="eReferencia.set($any($event.target).value)" maxlength="500"/>
       </div>
       <div class="cus-field"><label>Latitud</label>
        <input [value]="eLatitud()" (input)="eLatitud.set($any($event.target).value)" placeholder="Ej. 14.6349"/>
       </div>
       <div class="cus-field"><label>Longitud</label>
        <input [value]="eLongitud()" (input)="eLongitud.set($any($event.target).value)" placeholder="Ej. -90.5069"/>
       </div>
      </div>
      @if(addressError()){<p class="cus-alert" role="alert">{{addressError()}}</p>}
      <div class="cus-actions">
       <button type="button" gcButton [disabled]="!addressValid()||action.busy()" (click)="saveNewAddress()">
        {{action.busy()?'Guardando…':'Guardar dirección'}}</button>
       <button type="button" gcButton variant="outline" (click)="cancelAddressEdit()">Cancelar</button>
      </div>
     </div>
    }
   </section>
  }
 </div>`,
 styleUrl:'../customers.scss'
})
export class GcCustomerDetailPage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 private readonly branch=inject(GcBranchContext);
 private readonly api=inject(CustomersApi);
 private readonly access=inject(CustomersAccess);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 protected readonly customer=signal<CustomerDetail|null>(null);
 protected readonly addresses=signal<CustomerAddress[]>([]);
 protected readonly loadError=signal<string|null>(null);
 protected readonly action=new GcConfirmedAction();
 private get id(){return this.route.snapshot.paramMap.get('id')??''}
 private get sucursalId(){return this.branch.branchId()??''}
 private pendingOperation:{signature:string;key:string}|null=null;
 /** Reuse the key only for the identical mutation; a different action or payload must get a new one. */
 private keyFor(action:string,payload:unknown):string{
  const signature=action+':'+JSON.stringify(payload);
  if(this.pendingOperation?.signature!==signature)this.pendingOperation={signature,key:operationKey(action)};
  return this.pendingOperation.key;
 }
 protected canManage(){return this.access.canManage()}

 // profile edit
 protected readonly editing=signal(false);
 protected readonly eNombre=signal('');protected readonly eNit=signal('');
 protected readonly eTelefono=signal('');protected readonly eEmail=signal('');protected readonly eNotas=signal('');
 protected readonly saveError=signal<string|null>(null);
 protected readonly eValid=computed(()=>this.eNombre().trim().length>=2);
 protected setE(field:'nombre'|'nit'|'telefono'|'email'|'notas',v:string){
  if(field==='nombre')this.eNombre.set(v);
  else if(field==='nit')this.eNit.set(v);
  else if(field==='telefono')this.eTelefono.set(v);
  else if(field==='email')this.eEmail.set(v);
  else this.eNotas.set(v);
 }

 // deactivate
 protected readonly deactivating=signal(false);
 protected readonly motivo=signal('');
 protected readonly deactivateError=signal<string|null>(null);

 // address edit/create
 protected readonly addingAddress=signal(false);
 protected readonly editingAddressId=signal<string|null>(null);
 protected readonly eAlias=signal('');protected readonly eDireccion=signal('');
 protected readonly eReferencia=signal('');protected readonly eLatitud=signal('');protected readonly eLongitud=signal('');
 protected readonly addressError=signal<string|null>(null);
 protected readonly addressValid=computed(()=>this.eDireccion().trim().length>=5&&
  (!this.eLatitud().trim()||coordinate.test(this.eLatitud().trim()))&&
  (!this.eLongitud().trim()||coordinate.test(this.eLongitud().trim())));

 async ngOnInit(){await this.load()}
 protected async load(){
  this.loadError.set(null);
  try{
   const [c,a]=await Promise.all([
    firstValueFrom(this.api.detail(this.id,this.sucursalId)),
    firstValueFrom(this.api.addresses(this.id,this.sucursalId)),
   ]);
   this.customer.set(c);this.addresses.set(a.data);
  }catch(e){this.loadError.set(gcErrorMessage(e))}
 }
 protected startEdit(){
  const c=this.customer();if(!c)return;
  this.eNombre.set(c.nombre);this.eNit.set(c.nit??'');this.eTelefono.set(c.telefono??'');
  this.eEmail.set(c.email??'');this.eNotas.set(c.notas??'');
  this.saveError.set(null);this.editing.set(true);
 }
 protected cancelEdit(){this.editing.set(false);this.saveError.set(null)}
 protected async saveEdit(){
  const c=this.customer();if(!c||!this.eValid()||this.action.busy())return;
  this.saveError.set(null);
  const payload={nombre:this.eNombre().trim(),nit:this.eNit().trim()||null,telefono:this.eTelefono().trim()||null,
   email:this.eEmail().trim()||null,notas:this.eNotas().trim()||null};
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Guardar cambios',message:'¿Guardar los cambios de este cliente?',confirmText:'Guardar'},
   ()=>firstValueFrom(this.api.update(c.id,{sucursalId:this.sucursalId,
    claveOperacion:this.keyFor('CUSTOMER_UPDATE',payload),...payload})));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.saveError.set(gcErrorMessage(r.error));return}
  this.customer.set(r.value);this.editing.set(false);
  this.notices.show('Cliente actualizado.','success');
 }
 protected startDeactivate(){this.motivo.set('');this.deactivateError.set(null);this.deactivating.set(true)}
 protected cancelDeactivate(){this.deactivating.set(false);this.motivo.set('');this.deactivateError.set(null)}
 protected async confirmDeactivate(){
  const c=this.customer();if(!c||this.motivo().trim().length<5||this.action.busy())return;
  this.deactivateError.set(null);
  const payload={motivo:this.motivo().trim()};
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Desactivar cliente',message:'¿Desactivar a «'+c.nombre+'»? Podrá seguir viéndose en órdenes pasadas.',
   confirmText:'Desactivar',danger:true},
   ()=>firstValueFrom(this.api.deactivate(c.id,{sucursalId:this.sucursalId,
    claveOperacion:this.keyFor('CUSTOMER_DEACTIVATE',payload),...payload})));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.deactivateError.set(gcErrorMessage(r.error));return}
  this.deactivating.set(false);
  this.notices.show('Cliente desactivado.','success');
  await this.load();
 }
 private resetAddressForm(){
  this.eAlias.set('');this.eDireccion.set('');this.eReferencia.set('');
  this.eLatitud.set('');this.eLongitud.set('');this.addressError.set(null);
 }
 protected startAddAddress(){this.resetAddressForm();this.editingAddressId.set(null);this.addingAddress.set(true)}
 protected startEditAddress(a:CustomerAddress){
  this.eAlias.set(a.alias??'');this.eDireccion.set(a.direccion);this.eReferencia.set(a.referencia??'');
  this.eLatitud.set(a.latitud??'');this.eLongitud.set(a.longitud??'');
  this.addressError.set(null);this.addingAddress.set(false);this.editingAddressId.set(a.id);
 }
 protected cancelAddressEdit(){this.addingAddress.set(false);this.editingAddressId.set(null);this.resetAddressForm()}
 protected async saveNewAddress(){
  const c=this.customer();if(!c||!this.addressValid()||this.action.busy())return;
  this.addressError.set(null);
  const payload={alias:this.eAlias().trim()||null,direccion:this.eDireccion().trim(),
   referencia:this.eReferencia().trim()||null,latitud:this.eLatitud().trim()||null,
   longitud:this.eLongitud().trim()||null};
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Agregar dirección',message:'¿Agregar esta dirección?',confirmText:'Agregar'},
   ()=>firstValueFrom(this.api.addAddress(c.id,{sucursalId:this.sucursalId,
    claveOperacion:this.keyFor('CUSTOMER_ADDRESS_CREATE',payload),...payload})));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.addressError.set(gcErrorMessage(r.error));return}
  this.cancelAddressEdit();
  this.notices.show('Dirección agregada.','success');
  await this.load();
 }
 protected async saveAddressEdit(addressId:string){
  const c=this.customer();if(!c||!this.addressValid()||this.action.busy())return;
  this.addressError.set(null);
  const payload={alias:this.eAlias().trim()||null,direccion:this.eDireccion().trim(),
   referencia:this.eReferencia().trim()||null,latitud:this.eLatitud().trim()||null,
   longitud:this.eLongitud().trim()||null};
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Guardar dirección',message:'¿Guardar los cambios de esta dirección?',confirmText:'Guardar'},
   ()=>firstValueFrom(this.api.updateAddress(c.id,addressId,{sucursalId:this.sucursalId,
    claveOperacion:this.keyFor('CUSTOMER_ADDRESS_UPDATE:'+addressId,payload),...payload})));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.addressError.set(gcErrorMessage(r.error));return}
  this.cancelAddressEdit();
  this.notices.show('Dirección actualizada.','success');
  await this.load();
 }
 protected async makePrimary(addressId:string){
  const c=this.customer();if(!c||this.action.busy())return;
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Marcar como principal',message:'¿Marcar esta dirección como principal?',confirmText:'Marcar'},
   ()=>firstValueFrom(this.api.setPrimaryAddress(c.id,addressId,{sucursalId:this.sucursalId,
    claveOperacion:this.keyFor('CUSTOMER_ADDRESS_PRIMARY:'+addressId,{})})));
  if(!r||!r.ok)return;
  this.notices.show('Dirección principal actualizada.','success');
  await this.load();
 }
 protected async removeAddress(addressId:string){
  const c=this.customer();if(!c||this.action.busy())return;
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Desactivar dirección',message:'¿Desactivar esta dirección?',confirmText:'Desactivar',danger:true},
   ()=>firstValueFrom(this.api.deactivateAddress(c.id,addressId,{sucursalId:this.sucursalId,
    claveOperacion:this.keyFor('CUSTOMER_ADDRESS_DEACTIVATE:'+addressId,{})})));
  if(!r||!r.ok)return;
  this.notices.show('Dirección desactivada.','success');
  await this.load();
 }
 hasUnsavedChanges(){return (this.editing()||this.addingAddress()||this.editingAddressId()!==null)&&!this.action.busy()}
}
