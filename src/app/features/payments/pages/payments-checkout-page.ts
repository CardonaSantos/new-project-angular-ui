import {Component,computed,inject,OnInit,signal} from '@angular/core';
import {RouterLink,ActivatedRoute} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {OrdersApi} from '../../orders/data-access/orders.api';
import type {OrderDetail} from '../../orders/data-access/orders.models';
import {GcPaymentsNav} from '../payments-nav';
import {CashContext} from '../data-access/cash-context';
import {PaymentsAccess} from '../data-access/payments-access';
import {PaymentsApi} from '../data-access/payments.api';
import {checkParts,amount,money,operationKey,paymentError,positive,remainder,pendingTotal} from '../data-access/payments.helpers';
import type {AccountDetail,AccountSummary,PaymentMethod,PaymentPart,PaymentRecord} from '../data-access/payments.models';
import {METHODS,methodLabel} from '../data-access/payments.models';
import {parseApiDecimal} from '../../../shared/formatting';

@Component({
 selector:'gc-payments-checkout-page',imports:[RouterLink,GcSearchSelect,GcPaymentsNav],
 template:`
 <main class="ord-page pay-page">
 <gc-payments-nav/>
 <div class="ord-heading pay-heading">
  <div><a routerLink="/orders/list">← Pedidos</a><h1>Cobrar pedido {{order()?.numero??''}}</h1></div>
  <button type="button" (click)="load()" [disabled]="loading()||working()">Actualizar</button>
 </div>
 @if(error()){<p class="ord-alert" role="alert">{{error()}}</p>}
 @if(notice()){<p class="pay-success" role="status">{{notice()}}</p>}
 @if(loading()){<p role="status">Consultando cuenta…</p>}
 @if(order();as o){
  <div class="pay-checkout-layout">
   <section class="ord-card pay-checkout-main">
    <div class="ord-heading"><h2>Cuenta de {{o.modalidad==='MESA'?'mesa '+(o.ocupacionMesa?.mesa?.numero??''):'pedido'}}</h2>
     <span class="ord-status">{{o.estado==='ABIERTA'?'Abierta':o.estado==='CERRADA'?'Finalizada':'Cancelada'}}</span>
    </div>
    <div class="pay-summary">
     <div><small>Total del pedido</small><strong>{{money(o.total)}}</strong></div>
     <div><small>Por cobrar</small><strong>{{money(totalPending())}}</strong></div>
     <div><small>Cuentas</small><strong>{{accounts().length}}</strong></div>
    </div>
    @if(accounts().length>1){
     <div class="pay-account-tabs" role="group" aria-label="Seleccionar cuenta">
      @for(a of accounts();track a.id){
       <button type="button" [class.active]="selectedId()===a.id"
        [attr.aria-pressed]="selectedId()===a.id" (click)="chooseAccount(a.id)">
        {{a.nombre||'Cuenta '+($index+1)}} · {{money(a.total)}}
       </button>
      }
     </div>
    }
    @if(detail();as account){
     <div class="ord-heading pay-account-title">
      <h3>{{selectedName()}}</h3>
      <span class="ord-status">{{account.estado==='ABIERTA'?'Abierta':'Finalizada'}}</span>
     </div>
     <div class="pay-balance">
      <span>Saldo pendiente</span><strong>{{money(account.saldo)}}</strong>
     </div>
     @if(hasPendingAttempt()){
      <p class="pay-warn">Hay pagos por confirmar. Se reservó {{money(pendingAmount())}} del saldo.</p>
     }
     @if(account.lineas.length){
      <details class="pay-details">
       <summary>Ver productos de esta cuenta</summary>
       @for(line of account.lineas;track line.id){
        <div class="pay-detail-row"><span>{{line.ordenLinea?.nombreSnapshot??'Producto'}} · {{line.cantidadAsignada}}</span>
         <strong>{{money(line.importeAsignado)}}</strong></div>
       }
      </details>
     }
     @if(o.estado==='ABIERTA'&&access.canCollect()&&parsePositive(available())&&cash.ownShift();as shift){
      <fieldset class="ord-section pay-payment-form">
       <legend>1. Registrar cobro</legend>
       @for(part of parts();track $index;let i=$index){
        <div class="pay-payment-row">
         <div class="pay-methods" role="group" [attr.aria-label]="'Método de pago '+(i+1)">
          @for(m of methods;track m.id){
           <button type="button" [class.active]="part.metodo===m.id"
            [attr.aria-pressed]="part.metodo===m.id" [disabled]="working()"
            (click)="changeMethod(i,m.id)">{{m.label}}</button>
          }
         </div>
         <div class="pay-amount-grid">
          <label>Importe
           <input inputmode="decimal" [value]="part.monto" placeholder="Ej. 24.00"
            [disabled]="working()" (input)="editPart(i,'monto',$any($event.target).value)"/>
          </label>
          @if(part.metodo==='EFECTIVO'){
           <label>Efectivo recibido
            <input inputmode="decimal" [value]="part.efectivoRecibido??part.monto"
             [disabled]="working()" (input)="editPart(i,'efectivoRecibido',$any($event.target).value)"/>
           </label>
          } @else if(part.metodo==='TRANSFERENCIA'||part.metodo==='OTRO'){
           <label>Referencia
            <input [value]="part.referencia??''" maxlength="160"
             placeholder="Número de comprobante" [disabled]="working()"
             (input)="editPart(i,'referencia',$any($event.target).value)"/>
           </label>
          } @else if(part.metodo==='TARJETA'){
           <label>Código de autorización
            <input [value]="part.codigoAutorizacion??''" maxlength="160"
             placeholder="Autorización de terminal" [disabled]="working()"
             (input)="editPart(i,'codigoAutorizacion',$any($event.target).value)"/>
           </label>
          }
         </div>
         @if(part.metodo==='TARJETA'){
          <label>Referencia de terminal (opcional)
           <input [value]="part.terminalReferencia??''" maxlength="160"
            (input)="editPart(i,'terminalReferencia',$any($event.target).value)"/>
          </label>
         }
         @if(part.metodo==='EFECTIVO'&&cashReturn(part);as change){
          <div class="pay-change">Vuelto <strong>{{money(change)}}</strong></div>
         }
         @if(parts().length>1){
          <button type="button" class="pay-remove" [disabled]="working()"
           (click)="removePart(i)">Quitar método</button>
         }
        </div>
       }
       <div class="ord-actions">
        <button type="button" (click)="addPart()" [disabled]="working()||parts().length>=10">
         + Agregar otro método</button>
        <button type="button" (click)="fillRemaining()" [disabled]="working()">Usar saldo pendiente</button>
       </div>
       <div class="pay-total-row"><span>Total a registrar</span><strong>{{money(partsTotal())}}</strong></div>
       @if(paymentIssue()){<p class="ord-alert" role="alert">{{paymentIssue()}}</p>}
       <p class="ord-note">Tarjetas: registra solo autorizaciones ya aprobadas. Las transferencias necesitan confirmación antes de acreditarse.</p>
       @if(o.modalidad==='MESA'&&orderReady()){
        <p class="pay-warn">Al cobrar por completo, este pedido puede finalizarse y liberar automáticamente la mesa.</p>
       }
       <button class="ord-primary pay-submit" type="button" (click)="collect()"
        [disabled]="working()||!!paymentIssue()">Confirmar cobro</button>
      </fieldset>
     } @else if(o.estado==='ABIERTA'&&access.canCollect()&&parsePositive(available())){
      <div class="pay-empty-shift">
       <h3>Necesitas un turno de caja</h3>
       <p>Abre tu caja para empezar a cobrar este pedido.</p>
       <a class="ord-primary" [routerLink]="['/payments/cash']"
        [queryParams]="{volver:'/payments/order/'+o.id}">Ir a mi caja</a>
       @if(cash.error()){<p class="ord-alert">{{cash.error()}}</p>}
      </div>
     } @else if(o.estado==='ABIERTA'&&parsePositive(available())&&!access.canCollect()){
      <p class="pay-warn">No tienes autorización para cobrar en esta sucursal.</p>
     } @else if(account.estado==='ABIERTA'&&hasPendingAttempt()){
      <p class="pay-warn">No queda saldo disponible hasta confirmar o cancelar las transferencias pendientes.</p>
     } @else if(account.estado!=='ABIERTA'||o.estado!=='ABIERTA'){
      <p class="pay-success">Esta cuenta no admite nuevos cobros.</p>
     }
     @if(account.intentos.length){
      <section class="pay-history">
       <h3>Pagos pendientes de comprobación</h3>
       @for(attempt of account.intentos;track attempt.id){
        <div class="pay-history-row">
         <div><strong>{{methodLabel(attempt.metodo)}} · {{money(attempt.monto)}}</strong>
          <small>{{attempt.estado==='PENDIENTE'?'Pendiente':attempt.estado==='CONFIRMADO'?'Confirmado':'Cancelado'}}</small>
          @if(attempt.referenciaExterna){<small>Referencia: {{attempt.referenciaExterna}}</small>}
         </div>
         @if(attempt.estado==='PENDIENTE'&&access.canVerify()){
          <div class="ord-actions">
           <button type="button" [disabled]="working()||!cash.ownShift()" (click)="startAttempt(attempt.id,'confirm')">Confirmar recibido</button>
           <button type="button" class="ord-danger" [disabled]="working()" (click)="startAttempt(attempt.id,'cancel')">Cancelar</button>
          </div>
         }
        </div>
       }
       @if(attemptAction()){
        <fieldset class="ord-section">
         <legend>{{attemptAction()==='confirm'?'Verificar transferencia':'Cancelar intento'}}</legend>
         <label>Motivo
          <textarea rows="2" maxlength="500" [value]="attemptReason()"
           (input)="attemptReason.set($any($event.target).value)" placeholder="Ej. Transferencia comprobada"></textarea>
         </label>
         <div class="ord-actions"><button type="button" [disabled]="working()||attemptReason().trim().length<5"
          class="ord-primary" (click)="resolveAttempt()">Confirmar</button>
          <button type="button" (click)="attemptAction.set('')">Volver</button></div>
        </fieldset>
       }
      </section>
     }
     @if(account.pagos.length){
      <section class="pay-history"><h3>Pagos registrados</h3>
       @for(payment of account.pagos;track payment.id){
        <div class="pay-history-row">
         <div><strong>{{methodLabel(payment.metodo)}} · {{money(payment.monto)}}</strong>
          @if(payment.vuelto){<small>Vuelto: {{money(payment.vuelto)}}</small>}
         </div>
         @if(access.canRefund()){
          <button type="button" [disabled]="working()" (click)="startRefund(payment)">Devolver</button>
         }
        </div>
       }
       @if(refundPayment();as payment){
        <fieldset class="ord-section"><legend>Devolución · {{methodLabel(payment.metodo)}}</legend>
         <div class="pay-amount-grid">
          <label>Importe a devolver
           <input inputmode="decimal" [value]="refundAmount()" (input)="refundAmount.set($any($event.target).value)"/>
          </label>
          <label>Motivo de devolución
           <input maxlength="500" [value]="refundReason()" (input)="refundReason.set($any($event.target).value)"/>
          </label>
         </div>
         @if(payment.metodo!=='EFECTIVO'){
          <label>Referencia externa verificada
           <input maxlength="160" [value]="refundReference()" (input)="refundReference.set($any($event.target).value)"/>
          </label>
         }
         <div class="ord-actions">
          <button type="button" class="ord-danger" [disabled]="working()||refundReason().trim().length<5"
           (click)="refund()">Confirmar devolución</button>
          <button type="button" (click)="refundPayment.set(null)">Volver</button>
         </div>
        </fieldset>
       }
      </section>
     }
    }
    @if(o.estado==='ABIERTA'&&allSettled()&&access.canCollect()){
     <div class="ord-actions">
      <button type="button" (click)="finalize()" [disabled]="working()">Finalizar pedido</button>
     </div>
    }
   </section>
   <aside class="ord-card pay-checkout-aside">
    <h2>Resumen del pedido</h2>
    @for(item of o.ordenLineasComoOrden;track item.id){
     @if(!item.canceladaEn){
      <div class="pay-detail-row"><div><strong>{{item.nombreSnapshot}}</strong>
       <small>{{item.cantidad}} × {{money(item.precioUnitario)}}</small></div>
       <strong>{{money(item.subtotal)}}</strong></div>
     }
    }
    <div class="pay-total-row"><span>Total</span><strong>{{money(o.total)}}</strong></div>
    <a [routerLink]="['/orders/list',o.id]">Volver al pedido</a>
    @if(access.canSplit()&&accounts().length===1&&allUnpaid()&&o.estado==='ABIERTA'){
     <details class="pay-details">
      <summary>Dividir la cuenta</summary>
      <fieldset class="ord-section"><legend>Por número de personas</legend>
       <label>Número de personas (2 a 20)
        <input type="number" min="2" max="20" [value]="people()"
         (input)="people.set($any($event.target).valueAsNumber||2)"/>
       </label>
       <button type="button" [disabled]="working()||people()<2||people()>20" (click)="splitEqual()">
        Dividir en partes iguales</button>
      </fieldset>
      <fieldset class="ord-section"><legend>Asignar productos por persona</legend>
       <label>Personas
        <input type="number" min="2" max="20" [value]="people()"
         (input)="people.set($any($event.target).valueAsNumber||2)"/>
       </label>
       @for(line of o.ordenLineasComoOrden;track line.id){
        @if(!line.canceladaEn){
         <gc-search-select [id]="'split-'+line.id" [label]="line.nombreSnapshot"
          [items]="personOptions()" [value]="personFor(line.id)"
          [clearable]="false" [searchable]="false"
          (valueChange)="assignPerson(line.id,$event)"/>
        }
       }
       <button type="button" [disabled]="working()||people()<2||people()>20"
        (click)="splitByProducts()">Crear cuentas separadas</button>
      </fieldset>
     </details>
    }
   </aside>
  </div>
 } @else if(!loading()&&!error()){<p class="ord-empty">No se encontró el pedido.</p>}
 </main>`
})
export class GcPaymentsCheckoutPage implements OnInit{
 private readonly route=inject(ActivatedRoute);
 private readonly api=inject(PaymentsApi);
 private readonly ordersApi=inject(OrdersApi);
 private readonly confirm=inject(ConfirmDialogService);
 protected readonly access=inject(PaymentsAccess);
 protected readonly cash=inject(CashContext);
 protected readonly money=money;protected readonly methodLabel=methodLabel;
 protected readonly methods=METHODS;
 protected readonly order=signal<OrderDetail|null>(null);
 protected readonly accounts=signal<AccountSummary[]>([]);
 protected readonly detail=signal<AccountDetail|null>(null);
 protected readonly selectedId=signal('');
 protected readonly loading=signal(false);protected readonly working=signal(false);
 protected readonly error=signal('');protected readonly notice=signal('');
 protected readonly parts=signal<PaymentPart[]>([{metodo:'EFECTIVO',monto:'0.00',efectivoRecibido:'0.00'}]);
 protected readonly people=signal(2);protected readonly allocations=signal<Record<string,string>>({});
 protected readonly attemptId=signal('');protected readonly attemptAction=signal<'confirm'|'cancel'|''>('');
 protected readonly attemptReason=signal('');
 protected readonly refundPayment=signal<PaymentRecord|null>(null);
 protected readonly refundAmount=signal('');protected readonly refundReason=signal('');
 protected readonly refundReference=signal('');
 private key:{signature:string;value:string}|null=null;
 protected readonly selectedName=computed(()=>this.accounts().find(x=>x.id===this.selectedId())?.nombre||'Cuenta principal');
 protected readonly totalPending=computed(()=>this.accounts().reduce((v,a)=>v.plus(
  parseApiDecimal(a.total).minus(parseApiDecimal(a.pagado))),parseApiDecimal('0')).toFixed(2));
 protected readonly available=computed(()=>this.detail()?remainder(this.detail()!):'0.00');
 protected readonly pendingAmount=computed(()=>pendingTotal(this.detail()?.intentos??[]));
 protected readonly hasPendingAttempt=computed(()=>this.detail()?.intentos.some(x=>x.estado==='PENDIENTE')??false);
 protected readonly partsTotal=computed(()=>this.parts().reduce((v,a)=>v.plus(
  parseApiDecimal(amount(a.monto)??'0')),parseApiDecimal('0')).toFixed(2));
 protected readonly paymentIssue=computed(()=>checkParts(this.parts(),this.available()));
 protected readonly allUnpaid=computed(()=>this.accounts().every(x=>parseApiDecimal(x.pagado).eq(0))
  &&!(this.detail()?.intentos.length));
 protected readonly allSettled=computed(()=>this.accounts().length>0&&this.accounts().every(a=>
  parseApiDecimal(a.pagado).eq(parseApiDecimal(a.total))));
 protected readonly personOptions=computed(()=>Array.from({length:Math.max(2,Math.min(20,this.people()))},
  (_,i)=>({id:String(i+1),label:'Persona '+(i+1)})));
 ngOnInit(){void this.load()}
 private get id(){return this.route.snapshot.paramMap.get('id')??''}
 protected parsePositive=positive;
 private idem(kind:string,payload:unknown){
  const sig=kind+':'+JSON.stringify(payload);
  if(this.key?.signature!==sig)this.key={signature:sig,value:operationKey(kind)};
  return this.key.value;
 }
 private invalidate(){this.key=null}
 protected async load(){
  if(!this.id||!this.access.canRead())return;
  this.loading.set(true);this.error.set('');
  try{
   const [order,accounts]=await Promise.all([
    firstValueFrom(this.ordersApi.detail(this.id)),
    firstValueFrom(this.api.accounts(this.id))
   ]);
   this.order.set(order);this.accounts.set(accounts);
   const id=accounts.some(x=>x.id===this.selectedId())?this.selectedId():accounts[0]?.id??'';
   this.selectedId.set(id);
   await this.loadAccount(id,false);
   await this.cash.refresh(true);
  }catch(e){this.error.set(paymentError(e))}
  finally{this.loading.set(false)}
 }
 private async loadAccount(id:string,reset=true){
  if(!id){this.detail.set(null);return}
  const account=await firstValueFrom(this.api.account(id));this.detail.set(account);
  if(reset){this.invalidate();this.notice.set('')}
  this.parts.set([{metodo:'EFECTIVO',monto:remainder(account),efectivoRecibido:remainder(account)}]);
 }
 protected async chooseAccount(id:string){
  this.selectedId.set(id);this.error.set('');
  try{await this.loadAccount(id)}catch(e){this.error.set(paymentError(e))}
 }
 protected changeMethod(index:number,method:PaymentMethod){
  this.parts.update(p=>p.map((v,i)=>i===index?{metodo:method,monto:v.monto,
   ...(method==='EFECTIVO'?{efectivoRecibido:v.monto}:{})}:v));this.invalidate();
 }
 protected editPart(index:number,key:keyof PaymentPart,value:string){
  this.parts.update(p=>p.map((v,i)=>i===index?{...v,[key]:value}:v));this.invalidate();
 }
 protected addPart(){
  if(this.parts().length>=10)return;
  const amountLeft=parseApiDecimal(this.available()).minus(parseApiDecimal(this.partsTotal()));
  this.parts.update(p=>[...p,{metodo:'EFECTIVO',monto:amountLeft.gt(0)?amountLeft.toFixed(2):'0.00'}]);
  this.invalidate();
 }
 protected removePart(index:number){this.parts.update(p=>p.filter((_,i)=>i!==index));this.invalidate()}
 protected fillRemaining(){
  const other=this.parts().slice(0,-1).reduce((v,p)=>v.plus(parseApiDecimal(amount(p.monto)??'0')),
   parseApiDecimal('0'));
  const remaining=parseApiDecimal(this.available()).minus(other);
  if(remaining.lt(0))return;
  const i=this.parts().length-1;
  this.parts.update(ps=>ps.map((p,n)=>n===i?{...p,monto:remaining.toFixed(2),
   ...(p.metodo==='EFECTIVO'?{efectivoRecibido:remaining.toFixed(2)}:{})}:p));this.invalidate();
 }
 protected cashReturn(p:PaymentPart){
  const a=amount(p.monto),b=amount(p.efectivoRecibido??p.monto);
  if(!a||!b)return '';
  const value=parseApiDecimal(b).minus(parseApiDecimal(a));
  return value.gt(0)?value.toFixed(2):'';
 }
 private async operate(fn:()=>Promise<unknown>,success:string){
  if(this.working())return false;
  this.working.set(true);this.error.set('');this.notice.set('');
  try{await fn();this.key=null;await this.load();this.notice.set(success);return true}
  catch(e){this.error.set(paymentError(e));return false}
  finally{this.working.set(false)}
 }
 protected async collect(){
  const account=this.detail(),shift=this.cash.ownShift();
  if(!account||!shift||this.paymentIssue()||this.working())return;
  const payments=this.parts().map(p=>({
   metodo:p.metodo,monto:positive(p.monto)!,
   ...(p.metodo==='EFECTIVO'?{efectivoRecibido:amount(p.efectivoRecibido??p.monto)!}:{}),
   ...(p.referencia?.trim()?{referencia:p.referencia.trim()}:{}),
   ...(p.codigoAutorizacion?.trim()?{codigoAutorizacion:p.codigoAutorizacion.trim()}:{}),
   ...(p.terminalReferencia?.trim()?{terminalReferencia:p.terminalReferencia.trim()}:{}),
  }));
  const pending=payments.some(x=>x.metodo==='TRANSFERENCIA');
  const message=pending
   ?'Las transferencias quedarán pendientes hasta comprobarse. ¿Registrar los pagos?'
   :this.order()?.modalidad==='MESA'&&this.orderReady()
    ?'Al completar el cobro, el pedido puede finalizarse y la mesa quedar disponible. ¿Continuar?'
    :'¿Registrar el cobro de '+money(this.partsTotal())+'?';
  if(!await this.confirm.confirm({title:pending?'Registrar pago pendiente':'Confirmar cobro',
   message,confirmText:pending?'Registrar':'Cobrar'}))return;
  const payload={turnoId:shift.id,pagos:payments};
  const key=this.idem('collect',{accountId:account.id,...payload});
  await this.operate(()=>firstValueFrom(this.api.collect(account.id,{...payload,claveOperacion:key})),
   pending?'Pago registrado; verifica las transferencias antes de darlo por pagado.':'Cobro registrado correctamente.');
 }
 protected orderReady(){
  const o=this.order();return !!o&&!o.comandasComoOrden?.some(c=>c.estado==='PENDIENTE'||c.estado==='PREPARANDO');
 }
 protected personFor(lineId:string){return this.allocations()[lineId]??'1'}
 protected assignPerson(lineId:string,v:string){this.allocations.update(p=>({...p,[lineId]:v}));this.invalidate()}
 protected async splitEqual(){
  const count=this.people();if(count<2||count>20||!this.allUnpaid())return;
  if(!await this.confirm.confirm({title:'Dividir cuenta',message:'¿Dividir la cuenta entre '+count+' personas?',confirmText:'Dividir'}))return;
  const key=this.idem('split-equal',{orderId:this.id,count});
  await this.operate(()=>firstValueFrom(this.api.splitEqual(this.id,{personas:count,claveOperacion:key})),
   'Cuenta dividida. Ahora puedes cobrar cada parte por separado.');
 }
 protected async splitByProducts(){
  const o=this.order(),people=this.people();if(!o||people<2||people>20||!this.allUnpaid())return;
  const lines=o.ordenLineasComoOrden.filter(l=>!l.canceladaEn);
  const accounts=Array.from({length:people},(_,i)=>({nombre:'Persona '+(i+1),
   lineas:[] as {ordenLineaId:string;cantidadAsignada:string;importeAsignado:string}[]}));
  for(const line of lines){
   const target=Number(this.personFor(line.id))-1;
   if(target<0||target>=accounts.length)return;
   const net=parseApiDecimal(line.subtotal).minus(parseApiDecimal(line.descuento));
   accounts[target].lineas.push({ordenLineaId:line.id,cantidadAsignada:line.cantidad,
    importeAsignado:net.toFixed(2)});
  }
  if(accounts.some(a=>!a.lineas.length)){
   this.error.set('Asigna al menos un producto a cada persona. Para dividir un solo producto usa partes iguales.');
   return;
  }
  if(!await this.confirm.confirm({title:'Separar cuentas',message:'¿Crear una cuenta por persona con los productos asignados?',
   confirmText:'Separar'}))return;
  const key=this.idem('split-products',{orderId:this.id,accounts});
  await this.operate(()=>firstValueFrom(this.api.split(this.id,{cuentas:accounts,claveOperacion:key})),
   'Cuentas separadas. Selecciona la que deseas cobrar.');
 }
 protected startAttempt(id:string,action:'confirm'|'cancel'){
  this.attemptId.set(id);this.attemptAction.set(action);this.attemptReason.set('');
 }
 protected async resolveAttempt(){
  const id=this.attemptId(),action=this.attemptAction(),reason=this.attemptReason().trim();
  if(!id||reason.length<5||!action)return;
  const shift=this.cash.ownShift();
  if(action==='confirm'&&!shift){this.error.set('Abre tu turno de caja para confirmar.');return}
  if(!await this.confirm.confirm({title:action==='confirm'?'Verificar transferencia':'Cancelar transferencia',
   message:action==='confirm'?'Confirma solo si el dinero ya llegó a la cuenta del negocio.':
    '¿Cancelar este intento de pago?',confirmText:'Confirmar'}))return;
  const body={motivo:reason,...(action==='confirm'?{turnoId:shift!.id}:{})};
  const key=this.idem('attempt-'+action,{id,...body});
  const ok=await this.operate(()=>firstValueFrom(action==='confirm'
   ?this.api.confirmAttempt(id,{turnoId:shift!.id,motivo:reason,claveOperacion:key})
   :this.api.cancelAttempt(id,{motivo:reason,claveOperacion:key})),
   action==='confirm'?'Transferencia verificada.':'Intento cancelado.');
  if(ok)this.attemptAction.set('');
 }
 protected startRefund(payment:PaymentRecord){
  this.refundPayment.set(payment);this.refundAmount.set(payment.monto);
  this.refundReason.set('');this.refundReference.set('');
 }
 protected async refund(){
  const p=this.refundPayment(),a=positive(this.refundAmount()),why=this.refundReason().trim();
  if(!p||!a||why.length<5)return;
  if(parseApiDecimal(a).gt(parseApiDecimal(p.monto))){this.error.set('El importe supera el pago.');return}
  if(p.metodo!=='EFECTIVO'&&!this.refundReference().trim()){
   this.error.set('Ingresa la referencia verificada de la devolución.');return;
  }
  if(p.metodo==='EFECTIVO'&&!this.cash.ownShift()){
   this.error.set('Abre un turno para devolver efectivo.');return;
  }
  if(!await this.confirm.confirm({title:'Confirmar devolución',
   message:'¿Devolver '+money(a)+'? Esta operación quedará registrada.',danger:true,confirmText:'Devolver'}))return;
  const body={monto:a,motivo:why,...(p.metodo==='EFECTIVO'?{turnoId:this.cash.ownShift()!.id}:
   {referenciaExterna:this.refundReference().trim()})};
  const key=this.idem('refund',{paymentId:p.id,...body});
  const ok=await this.operate(()=>firstValueFrom(this.api.refund(p.id,{...body,claveOperacion:key})),
   'Devolución registrada.');
  if(ok)this.refundPayment.set(null);
 }
 protected async finalize(){
  const o=this.order();if(!o||!this.allSettled())return;
  if(!await this.confirm.confirm({title:'Finalizar pedido',
   message:o.modalidad==='MESA'?'Este pedido puede cerrarse y liberar su mesa. ¿Finalizar?':
    '¿Finalizar este pedido?',confirmText:'Finalizar'}))return;
  await this.operate(()=>firstValueFrom(this.api.finalize(o.id)),'Pedido finalizado.');
 }
}
