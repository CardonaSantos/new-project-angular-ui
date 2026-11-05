import {Component,computed,HostListener,inject,input,output,signal} from '@angular/core';
import {CdkTrapFocus} from '@angular/cdk/a11y';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {CashContext} from '../../payments/data-access/cash-context';
import {OrdersApi} from '../data-access/orders.api';
import {orderFriendlyError,money,operationKey} from '../data-access/orders.helpers';
import {parseApiDecimal} from '../../../shared/formatting';
import {asOrderLine,type PosCartEntry} from './pos-cart.models';
import type {OrderMode,PosQuickResult,PosQuote} from '../data-access/orders.models';

/** Embedded checkout: quoted by NestJS, same-operation retry and no navigation. */
@Component({
 selector:'gc-pos-express-checkout',
 imports:[CdkTrapFocus,RouterLink],
 template:`
 @if(open()){
  <button type="button" class="ord-overlay" aria-label="Cerrar cobro" (click)="close()"></button>
  <section class="ord-customizer ord-express-dialog" role="dialog" aria-modal="true"
   aria-labelledby="pos-express-title" cdkTrapFocus [cdkTrapFocusAutoCapture]="true">
   <div class="ord-heading">
    <div><h2 id="pos-express-title">Cobro rápido</h2>
     <p class="ord-note">Venta sin preparación · {{items().length}} líneas</p></div>
    <button type="button" [disabled]="busy()" aria-label="Cerrar cobro" (click)="close()">×</button>
   </div>
   @if(loading()){<p role="status">Validando precios en el servidor…</p>}
   @if(quote();as q){
    <div class="ord-express-total">
     <span>Total a cobrar</span><strong>{{money(q.total,q.moneda)}}</strong>
    </div>
    <div class="ord-express-methods" role="group" aria-label="Método de pago">
     <button type="button" [class.active]="method()==='EFECTIVO'"
      [attr.aria-pressed]="method()==='EFECTIVO'" [disabled]="busy()"
      (click)="chooseMethod('EFECTIVO')">Efectivo</button>
     <button type="button" [class.active]="method()==='TARJETA'"
      [attr.aria-pressed]="method()==='TARJETA'" [disabled]="busy()"
      (click)="chooseMethod('TARJETA')">Tarjeta</button>
     <button type="button" [class.active]="method()==='OTRO'"
      [attr.aria-pressed]="method()==='OTRO'" [disabled]="busy()"
      (click)="chooseMethod('OTRO')">Otro</button>
    </div>
    @if(method()==='EFECTIVO'){
     <label>Efectivo recibido
      <input type="text" inputmode="decimal" [value]="received()" [disabled]="busy()"
       (input)="updateReceived($any($event.target).value)" />
     </label>
     @if(validCash()){
      <p class="ord-express-change">Vuelto <strong>{{money(change(),q.moneda)}}</strong></p>
     }@else{<p class="ord-note">Ingresa un monto igual o superior al total.</p>}
    }@else if(method()==='TARJETA'){
     <label>Código de autorización verificado
      <input type="text" autocomplete="off" [value]="authorization()" [disabled]="busy()"
       (input)="updateAuthorization($any($event.target).value)"/>
     </label>
    }@else{
     <label>Referencia de pago verificada
      <input type="text" autocomplete="off" [value]="reference()" [disabled]="busy()"
       (input)="updateReference($any($event.target).value)"/>
     </label>
    }
   }
   @if(error()){<p role="alert" class="ord-alert">{{error()}}</p>}
   @if(!cash.ownShift()){<a routerLink="/payments/cash/open" (click)="close()">
    Abrir turno de caja</a>}
   <div class="ord-actions ord-express-dialog-actions">
    <button type="button" [disabled]="busy()" (click)="close()">Volver</button>
    <button type="button" class="ord-primary" [disabled]="!canConfirm()"
     (click)="confirm()">
     {{busy()?'Procesando…':'Confirmar cobro'+(quote()?' · '+money(quote()!.total,quote()!.moneda):'')}}
    </button>
   </div>
  </section>
 }
 `
})
export class GcPosExpressCheckout{
 private readonly api=inject(OrdersApi);
 private readonly branch=inject(GcBranchContext);
 private readonly cash=inject(CashContext);
 private readonly notices=inject(GcNotificationService);
 readonly items=input.required<PosCartEntry[]>();
 readonly modality=input.required<OrderMode>();
 readonly completed=output<PosQuickResult>();
 readonly open=signal(false);
 readonly loading=signal(false);
 readonly busy=signal(false);
 readonly quote=signal<PosQuote|null>(null);
 readonly method=signal<'EFECTIVO'|'TARJETA'|'OTRO'>('EFECTIVO');
 readonly received=signal('');
 readonly authorization=signal('');
 readonly reference=signal('');
 readonly error=signal('');
 private generation=0;
 private key='';
 private signature='';
 private quotedBranch='';
 private quotedCart='';
 protected readonly money=money;
 protected readonly validCash=computed(()=>{
  try{return !!this.quote()&&parseApiDecimal(this.received()||'0').gte(
   parseApiDecimal(this.quote()!.total))}
  catch{return false}
 });
 protected readonly change=computed(()=>this.validCash()?
  parseApiDecimal(this.received()).minus(parseApiDecimal(this.quote()!.total)).toFixed(2):'0.00');
 protected readonly canConfirm=computed(()=>!!this.quote()&&!this.loading()&&!this.busy()&&
  !!this.cash.ownShift()&&(this.method()==='EFECTIVO'?this.validCash():
   this.method()==='TARJETA'?!!this.authorization().trim():!!this.reference().trim()));
 async show(){
  const id=this.branch.branchId();if(!id||!this.items().length||this.busy())return;
  const generation=++this.generation;
  this.open.set(true);this.quote.set(null);this.error.set('');this.loading.set(true);
  this.quotedBranch='';this.quotedCart='';
  await this.cash.refresh(true);
  if(generation!==this.generation||id!==this.branch.branchId())return;
  if(!this.cash.ownShift()){
   this.error.set('Debes abrir un turno de Caja antes de cobrar.');this.loading.set(false);return;
  }
  try{
   const quote=await firstValueFrom(this.api.quote(id,this.items().map(asOrderLine)));
   if(generation!==this.generation||id!==this.branch.branchId())return;
   this.quote.set(quote);this.received.set(quote.total);this.key='';this.signature='';
   this.quotedBranch=id;this.quotedCart=JSON.stringify(this.items().map(asOrderLine));
  }catch(e){
   if(generation===this.generation)this.error.set(orderFriendlyError(e));
  }finally{if(generation===this.generation)this.loading.set(false)}
 }
 close(){if(!this.busy()){this.generation++;this.open.set(false);this.quote.set(null);this.error.set('')}}
 @HostListener('document:keydown.escape') onEscape(){if(this.open())this.close()}
 chooseMethod(method:'EFECTIVO'|'TARJETA'|'OTRO'){
  this.method.set(method);this.key='';this.signature='';
 }
 updateReceived(value:string){this.received.set(value);this.key='';this.signature=''}
 updateAuthorization(value:string){this.authorization.set(value);this.key='';this.signature=''}
 updateReference(value:string){this.reference.set(value);this.key='';this.signature=''}
 async confirm(){
  if(!this.canConfirm())return;
  const id=this.branch.branchId(),shift=this.cash.ownShift(),quote=this.quote();
  if(!id||!shift||!quote)return;
  if(this.quotedBranch!==id||this.quotedCart!==JSON.stringify(this.items().map(asOrderLine))){
   this.error.set('El pedido o la sucursal cambió. Vuelve a calcular el cobro.');return;
  }
  const part={metodo:this.method(),monto:quote.total,
   ...(this.method()==='EFECTIVO'?{efectivoRecibido:this.received().trim()}:{}),
   ...(this.method()==='TARJETA'?{codigoAutorizacion:this.authorization().trim()}:{}),
   ...(this.method()==='OTRO'?{referencia:this.reference().trim()}:{})};
  const source={sucursalId:id,modalidad:this.modality(),origen:'CAJA' as const,
   enviarCocina:true,lineas:this.items().map(asOrderLine),turnoId:shift.id,pagos:[part]};
  const signature=JSON.stringify(source);
  if(!this.key||signature!==this.signature){
   this.key=operationKey('posquick');this.signature=signature;
  }
  this.busy.set(true);this.error.set('');
  try{
   const result=await firstValueFrom(this.api.quickCheckout({...source,claveOperacion:this.key}));
   this.completed.emit(result);this.open.set(false);this.quote.set(null);
   this.key='';this.signature='';
   this.notices.show('Venta '+result.numero+' completada · '+money(result.total,quote.moneda),
    'success',8000);
   void this.cash.refresh(true);
  }catch(e){
   const message=orderFriendlyError(e);this.error.set(message);
   this.notices.show(message,'error',0);
  }finally{this.busy.set(false)}
 }
}
