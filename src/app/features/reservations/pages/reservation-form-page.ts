
import {Component,computed,effect,inject,OnInit,signal,untracked} from '@angular/core';
import {ActivatedRoute,Router} from '@angular/router';
import {firstValueFrom,Subject,debounceTime,distinctUntilChanged} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {zonedInstantFrom,calendarDateAtBranch,clockTimeAtBranch} from '../../../shared/formatting';
import {ReservationsApi} from '../data-access/reservations.api';
import {ReservationCustomerLookup} from '../data-access/reservation-customer-lookup';
import type {AvailableTable} from '../data-access/reservations.models';

const operationKey=(kind:string)=>kind+':'+crypto.randomUUID();

@Component({
 selector:'gc-reservation-form-page',
 imports:[GcPageHeader,GcButtonDirective,GcErrorState,GcSearchSelect],
 template:`
 <div class="rsv-page rsv-narrow">
  <gc-page-header [title]="isEdit?'Editar reservación':'Nueva reservación'"/>
  @if(loadError()){<gc-error-state [message]="loadError()!" (retry)="load()"/>}
  @else{
   <section class="rsv-card">
    <h2>Contacto</h2>
    <div class="rsv-grid">
     <div class="rsv-field"><label for="rf-nombre">Nombre de contacto</label>
      <input id="rf-nombre" [value]="nombreContacto()" (input)="nombreContacto.set($any($event.target).value);markDirty()" maxlength="180"/>
     </div>
     <div class="rsv-field"><label for="rf-telefono">Teléfono</label>
      <input id="rf-telefono" [value]="telefonoContacto()" (input)="telefonoContacto.set($any($event.target).value);markDirty()" maxlength="45"/>
     </div>
     <div class="rsv-field"><label for="rf-email">Email</label>
      <input id="rf-email" type="email" [value]="emailContacto()" (input)="emailContacto.set($any($event.target).value);markDirty()" maxlength="254"/>
     </div>
     <div class="rsv-field"><label for="rf-personas">Personas</label>
      <input id="rf-personas" type="number" min="1" max="100" [value]="personas()"
       (input)="personas.set($any($event.target).value);markDirty()"/>
     </div>
    </div>
    <gc-search-select id="rf-cliente" label="Cliente (opcional)" [items]="customerChoices()"
     [value]="clienteId()" [remote]="true" [loading]="customerBusy()" [clearable]="true"
     (valueChange)="chooseCustomer($event)" (searchChange)="customerSearch.next($event)"
     placeholder="Buscar cliente"/>
   </section>

   <section class="rsv-card">
    <h2>Horario</h2>
    <div class="rsv-grid-3">
     <div class="rsv-field"><label for="rf-fecha">Fecha</label>
      <input id="rf-fecha" type="date" [value]="fecha()" (change)="fecha.set($any($event.target).value);markDirty()"/>
     </div>
     <div class="rsv-field"><label for="rf-inicio">Hora de inicio</label>
      <input id="rf-inicio" type="time" [value]="horaInicio()" (change)="horaInicio.set($any($event.target).value);markDirty()"/>
     </div>
     <div class="rsv-field"><label for="rf-fin">Hora de fin</label>
      <input id="rf-fin" type="time" [value]="horaFin()" (change)="horaFin.set($any($event.target).value);markDirty()"/>
     </div>
    </div>
    @if(windowError()){<p class="rsv-alert" role="alert">{{windowError()}}</p>}
    @if(!isEdit){
     <div class="rsv-field"><label>Estado inicial</label>
      <div class="rsv-row">
       <label><input type="radio" name="rf-estado" value="PENDIENTE"
        [checked]="estadoInicial()==='PENDIENTE'" (change)="estadoInicial.set('PENDIENTE');markDirty()"/> Pendiente</label>
       <label><input type="radio" name="rf-estado" value="CONFIRMADA"
        [checked]="estadoInicial()==='CONFIRMADA'" (change)="estadoInicial.set('CONFIRMADA');markDirty()"/> Confirmada</label>
      </div>
     </div>
    }
   </section>

   <section class="rsv-card">
    <div class="rsv-row"><h2>Mesas</h2>
     <label><input type="checkbox" [checked]="manual()" (change)="toggleManual($any($event.target).checked)"/>
      Selección manual</label>
    </div>
    @if(!manual()){<p class="rsv-muted">Se asignará automáticamente la mesa más pequeña disponible con capacidad suficiente.</p>}
    @else{
     @if(availabilityBusy()){<p class="rsv-muted">Consultando disponibilidad…</p>}
     @else if(!windowReady()){<p class="rsv-muted">Completa fecha, horario y personas (mínimo 1) para ver mesas disponibles.</p>}
     @else if(availabilityError()){
      <p class="rsv-alert" role="alert">{{availabilityError()}}</p>
      <div class="rsv-actions"><button type="button" gcButton variant="outline" (click)="loadAvailability()">Reintentar</button></div>
     }
     @else if(availability().length===0){<p class="rsv-muted">No hay mesas registradas en esta sucursal (o ninguna activa). Verifica Mesas y Salas en Configuración.</p>}
     @else{
      <div class="rsv-table-chips">
       @for(t of availability();track t.id){
        <button type="button" class="rsv-table-chip"
         [class.rsv-table-chip--selected]="selectedMesaIds().includes(t.id)"
         [class.rsv-table-chip--unavailable]="!t.disponible&&!selectedMesaIds().includes(t.id)"
         [disabled]="!t.disponible&&!selectedMesaIds().includes(t.id)"
         (click)="toggleTable(t.id)">
         {{t.sala.nombre}} · Mesa {{t.numero}} ({{t.capacidad}})
         @if(!t.disponible){ — {{t.motivo==='RESERVADA'?'reservada':'ocupada'}}}
        </button>
       }
      </div>
     }
    }
   </section>

   <section class="rsv-card">
    <div class="rsv-field"><label for="rf-notas">Notas</label>
     <textarea id="rf-notas" rows="2" [value]="notas()" (input)="notas.set($any($event.target).value);markDirty()" maxlength="1000"></textarea>
    </div>
    @if(error()){<p class="rsv-alert" role="alert">{{error()}}</p>}
    <div class="rsv-actions">
     <button type="button" gcButton [disabled]="!valid()||action.busy()" (click)="save()">
      {{action.busy()?'Guardando…':(isEdit?'Guardar cambios':'Crear reservación')}}</button>
    </div>
   </section>
  }
 </div>`,
 styleUrl:'../reservations.scss'
})
export class GcReservationFormPage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly branch=inject(GcBranchContext);
 private readonly api=inject(ReservationsApi);
 private readonly customers=inject(ReservationCustomerLookup);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 protected readonly action=new GcConfirmedAction();
 protected readonly loadError=signal<string|null>(null);
 protected readonly error=signal<string|null>(null);
 protected readonly windowError=signal<string|null>(null);

 protected readonly nombreContacto=signal('');
 protected readonly telefonoContacto=signal('');
 protected readonly emailContacto=signal('');
 protected readonly personas=signal('2');
 protected readonly fecha=signal('');
 protected readonly horaInicio=signal('');
 protected readonly horaFin=signal('');
 protected readonly notas=signal('');
 // A reservation taken directly (phone call, walk-up booking) is already a commitment,
 // not a maybe — CONFIRMADA is the sensible default; staff can still switch to PENDIENTE
 // for a tentative hold that needs follow-up confirmation.
 protected readonly estadoInicial=signal<'PENDIENTE'|'CONFIRMADA'>('CONFIRMADA');
 protected readonly clienteId=signal('');
 protected readonly customerOptions=signal<{id:string;label:string}[]>([]);
 protected readonly customerChoices=computed(()=>this.customerOptions());
 protected readonly customerBusy=signal(false);
 protected readonly customerSearch=new Subject<string>();

 protected readonly manual=signal(false);
 protected readonly selectedMesaIds=signal<string[]>([]);
 protected readonly availability=signal<AvailableTable[]>([]);
 protected readonly availabilityBusy=signal(false);
 protected readonly availabilityError=signal<string|null>(null);

 private dirty=false;
 private key=operationKey('RESERVATION_CREATE');
 private existingId:string|null=null;
 private availabilityGeneration=0;
 private customerGeneration=0;

 get isEdit(){return this.existingId!==null}
 private get id(){return this.route.snapshot.paramMap.get('id')??''}
 private get sucursalId(){return this.route.snapshot.queryParamMap.get('sucursalId')??this.branch.branchId()??''}
 private get zone(){return this.branch.branches().find(b=>b.id===this.sucursalId)?.zonaHoraria??'America/Guatemala'}

 protected readonly windowReady=computed(()=>Boolean(this.sucursalId&&this.fecha()&&this.horaInicio()&&
  this.horaFin()&&Number(this.personas())>=1));
 protected readonly valid=computed(()=>{
  if(this.windowError())return false;
  return Boolean(this.nombreContacto().trim().length>=2&&this.windowReady()&&
   Number.isInteger(Number(this.personas()))&&Number(this.personas())>=1&&Number(this.personas())<=100);
 });

 constructor(){
  this.customerSearch.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed())
   .subscribe(q=>void this.loadCustomers(q));
  effect(()=>{
   this.fecha();this.horaInicio();this.horaFin();this.personas();this.manual();
   untracked(()=>{this.recomputeWindow();if(this.manual())void this.loadAvailability()});
  });
 }

 async ngOnInit(){
  const routeId=this.route.snapshot.url.some(s=>s.path==='edit')?this.id:null;
  this.existingId=routeId;
  void this.loadCustomers('');
  if(routeId)await this.load();
  else{this.fecha.set(calendarDateAtBranch(new Date().toISOString(),this.zone))}
 }

 protected async load(){
  if(!this.existingId)return;
  this.loadError.set(null);
  try{
   const r=await firstValueFrom(this.api.detail(this.existingId));
   this.nombreContacto.set(r.nombreContacto);this.telefonoContacto.set(r.telefonoContacto??'');
   this.emailContacto.set(r.emailContacto??'');this.personas.set(String(r.personas));
   this.notas.set(r.notas??'');this.clienteId.set(r.clienteId??'');
   const zone=this.zone;
   this.fecha.set(calendarDateAtBranch(r.inicio,zone));
   this.horaInicio.set(clockTimeAtBranch(r.inicio,zone));
   this.horaFin.set(clockTimeAtBranch(r.fin,zone));
   if(r.mesas.length){this.manual.set(true);this.selectedMesaIds.set(r.mesas.map(m=>m.id))}
   if(r.clienteId){
    this.customerOptions.update(rows=>rows.some(x=>x.id===r.clienteId)?rows:
     [{id:r.clienteId!,label:r.nombreContacto},...rows]);
   }
  }catch(e){this.loadError.set(gcErrorMessage(e))}
 }

 protected markDirty(){this.dirty=true;this.key=operationKey('RESERVATION_CREATE')}

 private recomputeWindow(){
  this.windowError.set(null);
  if(!this.windowReady())return;
  try{
   const inicio=zonedInstantFrom(this.fecha(),this.horaInicio(),this.zone);
   const fin=zonedInstantFrom(this.fecha(),this.horaFin(),this.zone);
   if(new Date(fin).getTime()<=new Date(inicio).getTime()){
    this.windowError.set('La hora de fin debe ser posterior a la hora de inicio.');
   }
  }catch(e){this.windowError.set(e instanceof Error?e.message:'Horario inválido.')}
 }

 protected async loadAvailability(){
  if(!this.windowReady()||this.windowError())return;
  const gen=++this.availabilityGeneration;this.availabilityBusy.set(true);this.availabilityError.set(null);
  try{
   const inicio=zonedInstantFrom(this.fecha(),this.horaInicio(),this.zone);
   const fin=zonedInstantFrom(this.fecha(),this.horaFin(),this.zone);
   const rows=await firstValueFrom(this.api.availability({sucursalId:this.sucursalId,inicio,fin,
    personas:Number(this.personas())||1}));
   if(gen!==this.availabilityGeneration)return;
   this.availability.set(rows);
  }catch(e){if(gen===this.availabilityGeneration)this.availabilityError.set(gcErrorMessage(e))}
  finally{if(gen===this.availabilityGeneration)this.availabilityBusy.set(false)}
 }

 protected toggleManual(checked:boolean){
  this.manual.set(checked);this.markDirty();
  if(!checked)this.selectedMesaIds.set([]);
  else void this.loadAvailability();
 }
 protected toggleTable(id:string){
  this.selectedMesaIds.update(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);
  this.markDirty();
 }

 private async loadCustomers(search:string){
  const gen=++this.customerGeneration;this.customerBusy.set(true);
  try{
   const result=await firstValueFrom(this.customers.options({sucursalId:this.sucursalId,search,limit:50}));
   if(gen!==this.customerGeneration)return;
   const selected=this.customerOptions().find(c=>c.id===this.clienteId());
   const mapped=result.data.map(c=>({id:c.id,label:c.nombre}));
   this.customerOptions.set(selected&&!mapped.some(c=>c.id===selected.id)?[selected,...mapped]:mapped);
  }catch(e){if(gen===this.customerGeneration)this.error.set(gcErrorMessage(e))}
  finally{if(gen===this.customerGeneration)this.customerBusy.set(false)}
 }
 // Selecting a client doesn't exempt the reservation from needing a contact name — the
 // backend always stores nombreContacto as its own field (whoever calls to book might not
 // be the client on file). So prefill it (and phone/email) from the client record instead
 // of leaving the staff to retype what they just picked; only fields still empty are
 // touched, so manual edits are never clobbered.
 protected async chooseCustomer(id:string){
  this.clienteId.set(id);this.markDirty();
  if(!id||!this.sucursalId)return;
  const gen=++this.customerGeneration;
  try{
   const c=await firstValueFrom(this.customers.detail(id,this.sucursalId));
   if(gen!==this.customerGeneration)return;
   if(!this.nombreContacto().trim())this.nombreContacto.set(c.nombre);
   if(!this.telefonoContacto().trim()&&c.telefono)this.telefonoContacto.set(c.telefono);
   if(!this.emailContacto().trim()&&c.email)this.emailContacto.set(c.email);
  }catch{
   // Best-effort prefill only; the picker still works even if the detail lookup fails.
  }
 }

 protected async save(){
  if(!this.valid()||this.action.busy()||!this.sucursalId)return;
  this.error.set(null);
  const inicio=zonedInstantFrom(this.fecha(),this.horaInicio(),this.zone);
  const fin=zonedInstantFrom(this.fecha(),this.horaFin(),this.zone);
  const mesaIds=this.manual()&&this.selectedMesaIds().length?this.selectedMesaIds():undefined;
  if(this.isEdit){
   const payload={nombreContacto:this.nombreContacto().trim(),
    telefonoContacto:this.telefonoContacto().trim()||null,emailContacto:this.emailContacto().trim()||null,
    personas:Number(this.personas()),inicio,fin,clienteId:this.clienteId()||null,
    notas:this.notas().trim()||null,mesaIds};
   const r=await this.action.runConfirmed(this.dialog,{
    title:'Guardar cambios',message:'¿Guardar los cambios de esta reservación?',confirmText:'Guardar'},
    ()=>firstValueFrom(this.api.update(this.existingId!,payload)));
   if(!r)return;
   if(!r.ok){if(r.reason==='error')this.error.set(gcErrorMessage(r.error));return}
   this.dirty=false;
   this.notices.show('Reservación actualizada.','success');
   await this.router.navigate(['/reservations',r.value.id]);
   return;
  }
  const payload={sucursalId:this.sucursalId,nombreContacto:this.nombreContacto().trim(),
   telefonoContacto:this.telefonoContacto().trim()||null,emailContacto:this.emailContacto().trim()||null,
   personas:Number(this.personas()),inicio,fin,clienteId:this.clienteId()||null,
   notas:this.notas().trim()||null,estadoInicial:this.estadoInicial(),mesaIds};
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Crear reservación',message:'¿Crear esta reservación?',confirmText:'Crear'},
   ()=>firstValueFrom(this.api.create({...payload,claveOperacion:this.key})));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.error.set(gcErrorMessage(r.error));return}
  this.dirty=false;
  this.notices.show('Reservación creada.','success');
  await this.router.navigate(['/reservations',r.value.id]);
 }

 hasUnsavedChanges(){return this.dirty&&!this.action.busy()}
}
