import {Component,effect,inject,signal,untracked} from '@angular/core';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcPaymentsNav} from '../payments-nav';
import {CashContext} from '../data-access/cash-context';
import {PaymentsApi} from '../data-access/payments.api';
import {PaymentsAccess} from '../data-access/payments-access';
import {money,amount,operationKey,paymentError} from '../data-access/payments.helpers';

@Component({
 selector:'gc-payments-cash-open-page',
 imports:[RouterLink,GcSearchSelect,GcPaymentsNav],
 template:`<main class="ord-page pay-page pay-cash-task">
  <gc-payments-nav/>
  <a routerLink="/payments/cash">← Mi caja</a>
  <section class="ord-card pay-cash-task-card">
   <h1>Abrir mi caja</h1>
   @if(error()||cash.error()){<p class="ord-alert" role="alert">{{error()||cash.error()}}</p>}
   @if(cash.loading()){<p role="status">Consultando cajas disponibles…</p>}
   @if(cash.ownShift();as shift){
    <p>Ya tienes un turno abierto en <strong>{{shift.caja?.nombre??'tu caja'}}</strong>.</p>
    <a class="ord-primary" routerLink="/payments/cash">Volver a mi caja</a>
   } @else if(!access.canOpen()){
    <p>No tienes permiso para abrir turnos.</p>
   } @else {
    <fieldset class="ord-section">
     <legend>Datos de apertura</legend>
     <gc-search-select id="open-cash-register" label="Caja disponible"
      [items]="registerChoices()" [value]="registerId()" placeholder="Seleccionar caja"
      [clearable]="false" [searchable]="registerChoices().length>6"
      (valueChange)="registerId.set($event)"/>
     <label>Dinero inicial en efectivo
      <input inputmode="decimal" [value]="openingAmount()" placeholder="Ej. 100.00"
       [disabled]="busy()" (input)="openingAmount.set($any($event.target).value)"/>
     </label>
    </fieldset>
    @if(!registerChoices().length&&!cash.loading()){
     <p class="ord-note">No hay cajas activas. Un responsable puede habilitar una desde Administrar cajas.</p>
    }
    <div class="ord-actions">
     <button type="button" class="ord-primary" [disabled]="busy()||cash.loading()||
      !registerId()||amount(openingAmount())===null" (click)="open()">Abrir turno</button>
     <a routerLink="/payments/cash">Cancelar</a>
    </div>
   }
  </section>
 </main>`
})
export class GcPaymentsCashOpenPage{
 private readonly branch=inject(GcBranchContext);
 private readonly router=inject(Router);
 private readonly route=inject(ActivatedRoute);
 private readonly api=inject(PaymentsApi);
 private readonly dialog=inject(ConfirmDialogService);
 protected readonly cash=inject(CashContext);
 protected readonly access=inject(PaymentsAccess);
 protected readonly amount=amount;
 protected readonly registerId=signal('');
 protected readonly openingAmount=signal('0.00');
 protected readonly error=signal('');
 protected readonly busy=signal(false);
 protected readonly registerChoices=()=>{
  return this.cash.registers().filter(x=>x.activa)
   .map(x=>({id:x.id,label:x.nombre}));
 };
 private signature='';private key='';
 constructor(){effect(()=>{if(this.branch.branchId())void untracked(()=>this.cash.refresh(true))})}
 protected async open(){
  const a=amount(this.openingAmount()),id=this.registerId();
  if(!this.access.canOpen()||this.busy()||!a||!id)return;
  if(!this.cash.registers().some(r=>r.id===id&&r.activa))return;
  if(!await this.dialog.confirm({title:'Abrir caja',
    message:'¿Comenzar el turno con '+money(a)+' de efectivo inicial?',
    confirmText:'Abrir caja'}))return;
  const signature=JSON.stringify({id,a});
  if(signature!==this.signature){this.signature=signature;this.key=operationKey('cash-open')}
  this.error.set('');this.busy.set(true);
  try{
   await firstValueFrom(this.api.openShift({cajaId:id,fondoInicial:a,claveOperacion:this.key}));
   this.key='';this.signature='';
   await this.cash.refresh(true);
   const back=this.route.snapshot.queryParamMap.get('volver')??'';
   if(/^\/payments\/order\/[\w-]+$/.test(back))
    await this.router.navigateByUrl(back);
   else await this.router.navigateByUrl('/payments/cash');
  }catch(e){this.error.set(paymentError(e))}
  finally{this.busy.set(false)}
 }
}
