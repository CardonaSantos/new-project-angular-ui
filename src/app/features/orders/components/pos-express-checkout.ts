import {Component,computed,effect,inject,input,output,signal,untracked} from '@angular/core';
import {RouterLink} from '@angular/router';
import {CdkTrapFocus} from '@angular/cdk/a11y';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {CashContext} from '../../payments/data-access/cash-context';
import {OrdersApi} from '../data-access/orders.api';
import type {CreateOrderInput,OrderQuote,QuickCheckoutResult} from '../data-access/orders.models';
import {money,operationKey,orderFriendlyError} from '../data-access/orders.helpers';
import {parseApiDecimal} from '../../../shared/formatting';

@Component({
 selector:'gc-pos-express-checkout',
 imports:[RouterLink,CdkTrapFocus],
 template:`
 <button type="button" class="ord-overlay" aria-label="Cerrar cobro" [disabled]="working()"
  (click)="cancel.emit()"></button>
 <section class="ord-customizer pos-express-dialog" role="dialog" aria-modal="true"
  aria-labelledby="pos-express-heading" cdkTrapFocus [cdkTrapFocusAutoCapture]="true">
  <div class="ord-heading">
   <div><h2 id="pos-express-heading">Cobro rápido</h2>
    <p class="ord-note">Venta directa, sin comanda de Cocina.</p></div>
   <button type="button" (click)="cancel.emit()" [disabled]="working()" aria-label="Cerrar cobro">×</button>
  </div>
  @if(loading()){<p role="status" class="ord-note">Verificando precios y turno de caja…</p>}
  @if(error()){<p role="alert" class="ord-alert">{{error()}}</p>}
  @if(quote();as q){
   <div class="pos-express-total" aria-live="polite">
    <span>Total confirmado por el servidor</span>
    <strong>{{money(q.total,q.moneda)}}</strong>
    <small>{{q.lineas.length}} líneas · {{q.moneda}}</small>
   </div>
   <div class="pos-express-items">
    @for(line of q.lineas;track $index){
     <div class="pos-express-item">
      <span>{{line.cantidad}} × {{line.nombre}}
       @if(line.modificadores.length){
        <small>{{modifiers(line.modificadores)}}</small>
       }
      </span><strong>{{money(line.total,q.moneda)}}</strong>
     </div>
    }
   </div>
   @if(!ownShift()){
    <div role="alert" class="ord-alert">
     No tienes un turno de caja abierto. Debes abrir uno para registrar el cobro.
     <a routerLink="/payments/cash/open" (click)="cancel.emit()">Abrir mi caja</a>
     <button type="button" (click)="refreshCash()" [disabled]="loading()">Actualizar turno</button>
    </div>
   }@else{
    <p class="ord-note">Caja: {{ownShift()?.caja?.nombre??'Mi turno abierto'}}</p>
   }
   <fieldset class="pos-express-methods" [disabled]="working()">
    <legend>Forma de pago</legend>
    <div class="pos-express-method-row">
     <button type="button" [class.active]="method()==='EFECTIVO'"
      [attr.aria-pressed]="method()==='EFECTIVO'" (click)="setMethod('EFECTIVO')">Efectivo</button>
     <button type="button" [class.active]="method()==='TARJETA'"
      [attr.aria-pressed]="method()==='TARJETA'" (click)="setMethod('TARJETA')">Tarjeta</button>
     <button type="button" [class.active]="method()==='OTRO'"
      [attr.aria-pressed]="method()==='OTRO'" (click)="setMethod('OTRO')">Otro</button>
    </div>
    @if(method()==='EFECTIVO'){
     <label>Dinero recibido ({{q.moneda}})
      <input type="text" inputmode="decimal" autocomplete="off"
       [value]="received()" (input)="received.set($any($event.target).value);changeKey()"/>
     </label>
     <div class="pos-express-change">
      <span>Vuelto</span>
      <strong>{{changeAmount()===null?'—':money(changeAmount()!,q.moneda)}}</strong>
     </div>
    }@else if(method()==='TARJETA'){
     <label>Código de autorización confirmado
      <input type="text" maxlength="100" autocomplete="off"
       placeholder="Código del terminal" [value]="authorization()"
       (input)="authorization.set($any($event.target).value);changeKey()"/>
     </label>
     <p class="ord-note">Confirma únicamente pagos aprobados por tu terminal.</p>
    }@else{
     <label>Referencia verificada
      <input type="text" maxlength="100" autocomplete="off"
       placeholder="Referencia de pago" [value]="reference()"
       (input)="reference.set($any($event.target).value);changeKey()"/>
     </label>
    }
   </fieldset>
   <p class="ord-note">Los productos y los precios se validan otra vez al confirmar. Si falla, no se registra una venta parcial.</p>
   <div class="ord-actions pos-express-actions">
    <button type="button" [disabled]="working()" (click)="cancel.emit()">Volver al carrito</button>
    <button type="button" class="ord-primary"
     [disabled]="!canPay()" (click)="pay()">
     {{working()?'Registrando…':'Confirmar y cobrar · '+money(q.total,q.moneda)}}
    </button>
   </div>
  }@else if(!loading()){
   <button type="button" (click)="load()" [disabled]="working()">Volver a consultar precios</button>
  }
 </section>`
})
export class GcPosExpressCheckout{
 readonly order=input.required<CreateOrderInput>();
 readonly cancel=output<void>();
 readonly completed=output<QuickCheckoutResult>();
 protected readonly api=inject(OrdersApi);
 private readonly branch=inject(GcBranchContext);
 private readonly notices=inject(GcNotificationService);
 protected readonly cash=inject(CashContext);
 protected readonly ownShift=this.cash.ownShift;
 protected readonly loading=signal(true);
 protected readonly working=signal(false);
 protected readonly error=signal('');
 protected readonly quote=signal<OrderQuote|null>(null);
 protected readonly method=signal<'EFECTIVO'|'TARJETA'|'OTRO'>('EFECTIVO');
 protected readonly received=signal('');
 protected readonly authorization=signal('');
 protected readonly reference=signal('');
 protected readonly money=money;
 private requestKey='';
 private generation=0;
 protected readonly changeAmount=computed(()=>{
  const total=this.quote()?.total;
  if(!total)return null;
  try{
   const received=parseApiDecimal(this.received());
   const change=received.minus(parseApiDecimal(total));
   return change.gte(0)?change.toFixed(2):null;
  }catch{return null}
 });
 protected readonly canPay=computed(()=>{
  const q=this.quote();
  if(!q||!this.ownShift()||this.loading()||this.working()||this.branch.branchId()!==this.order().sucursalId)return false;
  if(this.method()==='EFECTIVO')return this.changeAmount()!==null;
  if(this.method()==='TARJETA')return Boolean(this.authorization().trim());
  return Boolean(this.reference().trim());
 });
 constructor(){
  effect(()=>{
   const id=this.order().sucursalId;
   const active=this.branch.branchId();
   untracked(()=>{
    this.generation++;
    this.quote.set(null);
    if(id===active){void this.load()}else this.error.set('La sucursal cambió. Vuelve al POS.');
   });
  });
 }
 protected modifiers(items:OrderQuote['lineas'][number]['modificadores']){
  return items.map(x=>x.nombre).join(' · ');
 }
 protected changeKey(){this.requestKey=''}
 protected setMethod(value:'EFECTIVO'|'TARJETA'|'OTRO'){
  this.method.set(value);this.changeKey();
 }
 protected async refreshCash(){await this.cash.refresh(true)}
 protected async load(){
  const id=this.order().sucursalId,gen=++this.generation;
  this.loading.set(true);this.error.set('');this.quote.set(null);
  try{
   const [q]=await Promise.all([
    firstValueFrom(this.api.quote({sucursalId:id,lineas:this.order().lineas})),
    this.cash.refresh(true)
   ]);
   if(gen!==this.generation||this.branch.branchId()!==id)return;
   this.quote.set(q);this.received.set(q.total);this.changeKey();
  }catch(e){if(gen===this.generation)this.error.set(orderFriendlyError(e))}
  finally{if(gen===this.generation)this.loading.set(false)}
 }
 protected async pay(){
  const q=this.quote(),shift=this.ownShift(),data=this.order();
  if(!q||!shift||!this.canPay())return;
  // Keep the SAME key for network-error retries with unchanged payload.
  if(!this.requestKey)this.requestKey=operationKey('pos-express');
  const part={metodo:this.method(),monto:q.total,
   ...(this.method()==='EFECTIVO'?{efectivoRecibido:this.received().trim()}:{}),
   ...(this.method()==='TARJETA'?{codigoAutorizacion:this.authorization().trim()}:{}),
   ...(this.method()==='OTRO'?{referencia:this.reference().trim()}:{})};
  this.working.set(true);this.error.set('');
  try{
   const result=await firstValueFrom(this.api.quickCheckout({
    ...data,turnoId:shift.id,pagos:[part],claveOperacion:this.requestKey,enviarCocina:true
   }));
   if(this.branch.branchId()!==data.sucursalId)return;
   this.notices.show('Venta '+result.numero+' cobrada y cerrada correctamente.','success',7000);
   this.completed.emit(result);
  }catch(e){
   const message=orderFriendlyError(e);
   this.error.set(message);
   this.notices.show(message,'error',0);
  }finally{this.working.set(false)}
 }
}
