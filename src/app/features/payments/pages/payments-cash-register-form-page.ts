import {Component,computed,effect,inject,signal,untracked} from '@angular/core';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcPaymentsNav} from '../payments-nav';
import {CashContext} from '../data-access/cash-context';
import {PaymentsApi} from '../data-access/payments.api';
import {PaymentsAccess} from '../data-access/payments-access';
import {paymentError} from '../data-access/payments.helpers';
@Component({
 selector:'gc-payments-cash-register-form-page',
 imports:[RouterLink,GcPaymentsNav],
 template:`<main class="ord-page pay-page pay-cash-task">
  <gc-payments-nav/>
  <a routerLink="/payments/cash/registers">← Administrar cajas</a>
  <section class="ord-card pay-cash-task-card">
   <h1>{{editing()?'Configurar caja':'Nueva caja'}}</h1>
   @if(error()||cash.error()){<p class="ord-alert" role="alert">{{error()||cash.error()}}</p>}
   @if(!access.canCashManage()){<p>No tienes permiso para administrar cajas.</p>}
   @else if(cash.loading()){<p role="status">Consultando información…</p>}
   @else if(editing()&&!current()){<p>No se encontró esta caja en la sucursal.</p>}
   @else {
    <fieldset class="ord-section"><legend>Identificación</legend>
     @if(!editing()){
      <label>Código de la caja
       <input [value]="code()" maxlength="40" placeholder="Ej. CAJA01"
        (input)="code.set($any($event.target).value)" [disabled]="busy()"/>
      </label>
     } @else {<p class="ord-muted">Código: {{current()?.codigo}}</p>}
     <label>Nombre de la caja
      <input [value]="name()" maxlength="120" placeholder="Ej. Caja principal"
       (input)="name.set($any($event.target).value)" [disabled]="busy()"/>
     </label>
    </fieldset>
    <div class="ord-actions">
     <button type="button" class="ord-primary" (click)="save()" [disabled]="busy()||name().trim().length<2">
      {{editing()?'Guardar cambios':'Crear caja'}}</button>
     <a routerLink="/payments/cash/registers">Cancelar</a>
    </div>
    @if(editing()){
     <section class="pay-cash-register-state">
      <h2>Disponibilidad</h2>
      <p>{{current()?.activa?'Esta caja está activa para abrir turnos.':'Esta caja está desactivada.'}}</p>
      <button type="button" [disabled]="busy()" [class.ord-danger]="current()?.activa"
       (click)="toggle()">{{current()?.activa?'Desactivar caja':'Activar caja'}}</button>
     </section>
    }
   }
  </section>
 </main>`
})
export class GcPaymentsCashRegisterFormPage{
 private readonly branch=inject(GcBranchContext);
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly api=inject(PaymentsApi);
 private readonly dialog=inject(ConfirmDialogService);
 protected readonly access=inject(PaymentsAccess);
 protected readonly cash=inject(CashContext);
 protected readonly editing=signal(false);
 protected readonly code=signal('');
 protected readonly name=signal('');
 protected readonly busy=signal(false);protected readonly error=signal('');
 protected readonly current=computed(()=>this.cash.registers().find(x=>x.id===this.route.snapshot.paramMap.get('id'))??null);
 constructor(){
  const id=this.route.snapshot.paramMap.get('id');
  this.editing.set(!!id);
  effect(()=>{if(this.branch.branchId())void untracked(()=>this.load())});
 }
 private async load(){
  await this.cash.refresh(true);
  if(this.editing()&&this.current())this.name.set(this.current()!.nombre);
 }
 protected async save(){
  if(!this.access.canCashManage()||this.busy())return;
  const name=this.name().trim(),id=this.current()?.id,branch=this.branch.branchId();
  if(name.length<2||!branch)return;
  if(this.editing()&&!id)return;
  const code=this.code().trim().toUpperCase();
  if(!this.editing()&&!/^[A-Z0-9_-]{2,40}$/.test(code)){
   this.error.set('El código debe tener entre 2 y 40 letras, números o guiones.');return;
  }
  this.busy.set(true);this.error.set('');
  try{
   if(id)await firstValueFrom(this.api.updateRegister(id,{nombre:name}));
   else await firstValueFrom(this.api.createRegister({sucursalId:branch,codigo:code,nombre:name}));
   await this.cash.refresh(true);
   await this.router.navigateByUrl('/payments/cash/registers');
  }catch(e){this.error.set(paymentError(e))}
  finally{this.busy.set(false)}
 }
 protected async toggle(){
  const item=this.current();if(!item||!this.access.canCashManage()||this.busy())return;
  if(item.activa&&!await this.dialog.confirm({title:'Desactivar caja',
   message:'No podrás abrir turnos nuevos en esta caja. ¿Desactivar?',
   confirmText:'Desactivar',danger:true}))return;
  this.busy.set(true);this.error.set('');
  try{await firstValueFrom(this.api.updateRegister(item.id,{activa:!item.activa}));
   await this.cash.refresh(true);
  }catch(e){this.error.set(paymentError(e))}
  finally{this.busy.set(false)}
 }
}
