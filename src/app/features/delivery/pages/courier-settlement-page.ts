
import {Component,computed,inject,signal} from '@angular/core';
import {Router,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcSearchSelect,type GcSelectOption} from '../../../design-system/forms/gc-search-select';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {gcErrorMessage} from '../../../core/http/api-error';
import {money,operationKey} from '../../orders/data-access/orders.helpers';
import {parseApiDecimal,formatInstant} from '../../../shared/formatting';
import {UsersApi} from '../../users/data-access/users.api';
import {CashContext} from '../../payments/data-access/cash-context';
import {DeliveryAccess} from '../data-access/delivery-access';
import {DeliverySettlementsApi} from '../data-access/delivery-settlements.api';
import type {CourierPendingPayment} from '../data-access/delivery-settlements.models';

@Component({
 selector:'gc-courier-settlement-page',
 imports:[RouterLink,GcPageHeader,GcButtonDirective,GcErrorState,GcSearchSelect],
 template:`
 <main class="del-page del-narrow">
  <gc-page-header title="Liquidar repartidor"
   description="Selecciona al repartidor, revisa el efectivo pendiente y cierra la liquidación contra una caja abierta.">
   @if(access.canPlatformManage()){
    <a gcPageActions gcButton variant="outline" routerLink="/delivery/settlements/channels">Canales externos</a>
   }
  </gc-page-header>

  <section class="del-card">
   <div class="del-field">
    <gc-search-select id="stl-courier" label="Repartidor" [items]="courierChoices()"
     [value]="repartidorId()" [remote]="true" [loading]="courierBusy()"
     placeholder="Buscar repartidor por nombre…"
     (valueChange)="selectCourier($event)" (searchChange)="searchCouriers($event)" (opened)="searchCouriers('')"/>
   </div>
  </section>

  @if(loadError()){<gc-error-state [message]="loadError()!" (retry)="loadPending()"/>}

  @if(repartidorId()&&!loadError()){
   <section class="del-card">
    <div class="del-row"><h2>Efectivo pendiente</h2>
     @if(pendingBusy()){<span class="del-muted">Consultando…</span>}
    </div>
    @if(!pendingBusy()&&!payments().length){
     <p class="del-muted">Este repartidor no tiene efectivo pendiente de liquidar.</p>
    }
    @if(payments().length){
     <div class="del-blockers">
      @for(p of payments();track p.pagoId){
       <label class="del-row" style="justify-content:flex-start;border:1px solid var(--gc-outline-variant);border-radius:.5rem;padding:.5rem .65rem;">
        <input type="checkbox" [checked]="selected().has(p.pagoId)" (change)="toggle(p.pagoId)"/>
        <span>Cobrado {{formatDate(p.cobradoEn)}}</span>
        <strong style="margin-left:auto">{{money(p.monto)}}</strong>
       </label>
      }
     </div>
     <div class="del-row">
      <span class="del-muted">Total esperado</span>
      <strong>{{money(totalEsperado())}}</strong>
     </div>
    }
   </section>
  }

  @if(repartidorId()&&selected().size>0){
   <section class="del-card">
    <h2>Cerrar liquidación</h2>
    <div class="del-field">
     <gc-search-select id="stl-shift" label="Caja de destino" [items]="shiftChoices()"
      [value]="turnoCajaId()" [searchable]="false" [loading]="shiftBusy()"
      placeholder="Selecciona una caja abierta…" (valueChange)="turnoCajaId.set($event)"/>
     @if(!shiftBusy()&&!shiftChoices().length){
      <small>No hay ninguna caja abierta en esta sucursal. Abre un turno antes de continuar.</small>
     }
    </div>
    <div class="del-field">
     <label for="stl-entregado">Efectivo entregado</label>
     <input id="stl-entregado" [value]="totalEntregado()" inputmode="decimal"
      (input)="totalEntregado.set($any($event.target).value)"/>
     <small>Debe coincidir exactamente con el total esperado. Si hay diferencia, documenta una discrepancia aparte.</small>
    </div>
    @if(actionError()){<p class="del-alert" role="alert">{{actionError()}}</p>}
    <div class="del-actions">
     <button type="button" gcButton [disabled]="!canSubmit()||actionBusy()" (click)="confirmClose()">
      {{actionBusy()?'Cerrando…':'Cerrar liquidación'}}</button>
    </div>
   </section>
  }
 </main>`,
 styleUrl:'../delivery.scss'
})
export class GcCourierSettlementPage{
 protected readonly access=inject(DeliveryAccess);
 private readonly branch=inject(GcBranchContext);
 private readonly users=inject(UsersApi);
 private readonly cash=inject(CashContext);
 private readonly api=inject(DeliverySettlementsApi);
 private readonly notice=inject(GcNotificationService);
 private readonly dialogs=inject(ConfirmDialogService);
 private readonly router=inject(Router);
 protected readonly money=money;
 protected readonly courierChoices=signal<GcSelectOption[]>([]);
 protected readonly courierBusy=signal(false);
 protected readonly repartidorId=signal('');
 protected readonly payments=signal<CourierPendingPayment[]>([]);
 protected readonly pendingBusy=signal(false);
 protected readonly loadError=signal<string|null>(null);
 protected readonly selected=signal<Set<string>>(new Set());
 protected readonly shiftChoices=signal<GcSelectOption[]>([]);
 protected readonly shiftBusy=signal(false);
 protected readonly turnoCajaId=signal('');
 protected readonly totalEntregado=signal('0.00');
 protected readonly actionBusy=signal(false);protected readonly actionError=signal('');
 protected readonly totalEsperado=computed(()=>{
  const ids=this.selected();
  const sum=this.payments().filter(p=>ids.has(p.pagoId))
   .reduce((v,p)=>v.plus(parseApiDecimal(p.monto)),parseApiDecimal('0'));
  return sum.toFixed(2);
 });
 protected canSubmit(){
  return this.selected().size>0&&!!this.turnoCajaId()&&
   parseApiDecimal(this.totalEntregado()||'0').gt(0);
 }
 protected formatDate(value:string){return formatInstant(value,this.branch.active()?.zonaHoraria??'America/Guatemala')}
 protected searchCouriers(term:string){void this.loadCouriers(term)}
 private async loadCouriers(term:string){
  const branchId=this.branch.branchId();if(!branchId)return;
  this.courierBusy.set(true);
  try{
   const result=await firstValueFrom(this.users.options(
    {sucursalId:branchId,purpose:'delivery.courier',search:term||undefined,limit:20}));
   this.courierChoices.set(result.data.map(u=>({id:u.id,label:u.label})));
  }catch{/* Leave previous choices; the select shows none found. */}
  finally{this.courierBusy.set(false)}
 }
 protected selectCourier(id:string){
  this.repartidorId.set(id);this.selected.set(new Set());this.turnoCajaId.set('');
  this.totalEntregado.set('0.00');
  void this.loadPending();void this.loadShifts();
 }
 protected toggle(pagoId:string){
  const next=new Set(this.selected());
  if(next.has(pagoId))next.delete(pagoId);else next.add(pagoId);
  this.selected.set(next);
  this.totalEntregado.set(this.totalEsperado());
 }
 protected async loadPending(){
  const branchId=this.branch.branchId();const repartidorId=this.repartidorId();
  if(!branchId||!repartidorId)return;
  this.pendingBusy.set(true);this.loadError.set(null);
  try{
   const page=await firstValueFrom(this.api.pending({sucursalId:branchId,repartidorId,page:1,limit:100}));
   this.payments.set(page.data);
   this.selected.set(new Set(page.data.map(p=>p.pagoId)));
   this.totalEntregado.set(this.totalEsperado());
  }catch(e){this.loadError.set(gcErrorMessage(e))}
  finally{this.pendingBusy.set(false)}
 }
 private async loadShifts(){
  this.shiftBusy.set(true);
  try{
   await this.cash.refresh(true);
   this.shiftChoices.set(this.cash.shifts().filter(s=>!s.cerradaEn).map(s=>({
    id:s.id,label:(s.caja?.nombre??'Caja')+' — abierta '+formatInstant(s.abiertaEn,
     this.branch.active()?.zonaHoraria??'America/Guatemala')
   })));
  }catch{this.shiftChoices.set([])}
  finally{this.shiftBusy.set(false)}
 }
 protected async confirmClose(){
  const branchId=this.branch.branchId();const repartidorId=this.repartidorId();
  const turnoCajaId=this.turnoCajaId();
  if(!branchId||!repartidorId||!turnoCajaId||this.actionBusy()||!this.canSubmit())return;
  if(!await this.dialogs.confirm({title:'Cerrar liquidación',
   message:'Se registrará el efectivo entregado y se posteará un movimiento de caja.',
   confirmText:'Cerrar liquidación'}))return;
  this.actionBusy.set(true);this.actionError.set('');
  try{
   const result=await firstValueFrom(this.api.closeDirect({
    sucursalId:branchId,repartidorId,pagoIds:[...this.selected()],turnoCajaId,
    totalEntregado:this.totalEntregado().trim(),claveOperacion:operationKey('courier-settlement')
   }));
   this.notice.show('Liquidación cerrada.','success');
   await this.router.navigate(['/delivery/settlements',result.id]);
  }catch(e){this.actionError.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
}
