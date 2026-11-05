import {Component,inject,OnInit,signal} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {PurchasesApi} from '../data-access/purchases.api';
import {PurchasesAccess} from '../data-access/purchases-access';
import type {SupplyTransfer} from '../data-access/purchases.models';
import {decimal,newKey} from '../data-access/purchases.helpers';
import {parseApiDecimal} from '../../../shared/formatting';
import {GcPurchasesNav} from '../purchases-nav';
interface ReceiptInput {key:string;cantidad:string}
@Component({
 selector:'gc-purchases-transfer-detail-page',
 imports:[RouterLink,GcPurchasesNav],
 template:`<main class="pur-page"><gc-purchases-nav/>
  <header class="pur-heading">
   <div><a class="pur-link" routerLink="/purchases/requisitions">← Requisiciones</a>
    <h1>Traslado {{transfer()?.numero??''}}</h1></div>
   <button type="button" (click)="load()" [disabled]="busy()">Actualizar</button>
  </header>
  @if(error()){<p role="alert" class="pur-alert">{{error()}}</p>}
  @if(busy()){<p role="status" class="pur-muted">Consultando traslado…</p>}
  @if(transfer();as t){
   <section class="pur-card">
    <div class="pur-heading"><h2>Mercancía trasladada</h2><span class="pur-badge">{{t.estado}}</span></div>
    <p class="pur-muted">Los insumos se suman al almacén de destino al confirmar la recepción.</p>
    <div class="pur-lines">
     @for(l of t.lineas;track l.id){
      <div class="pur-line">
       <div class="pur-heading">
        <strong>{{articleNames()[l.articuloId]??'Artículo del traslado'}}</strong>
        <span class="pur-muted">Enviado: {{l.enviada}} · Recibido: {{l.recibida}} · Pendiente: {{l.pendiente}}</span>
       </div>
       @if(t.estado==='EN_TRANSITO'&&access.canSupplyReceive()&&positive(l.pendiente)){
        <div class="pur-field"><label [for]="'pur-trans-qty-'+l.id">Cantidad a recibir</label>
         <input [id]="'pur-trans-qty-'+l.id" inputmode="decimal"
          [value]="getQuantity(l.id)" (input)="setQuantity(l.id,$any($event.target).value)"/>
        </div>
       }
      </div>
     }
    </div>
    @if(t.estado==='EN_TRANSITO'&&access.canSupplyReceive()){
     <div class="pur-field"><label for="pur-trans-note">Observaciones (opcional)</label>
      <textarea id="pur-trans-note" maxlength="500" rows="2" [value]="observations()"
       (input)="observations.set($any($event.target).value)"></textarea>
     </div>
     <div class="pur-actions">
      <button type="button" class="pur-primary" [disabled]="actionBusy()||!ready()"
       (click)="receive()">Confirmar recepción</button>
     </div>
    }
    <a class="pur-link" [routerLink]="['/purchases/requisitions',t.requisicionId]">Ver requisición</a>
   </section>
  }
 </main>`,
 styleUrl:'../purchases.scss'
})
export class GcPurchasesTransferDetailPage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 private readonly api=inject(PurchasesApi);
 protected readonly access=inject(PurchasesAccess);
 private readonly confirm=inject(ConfirmDialogService);
 private readonly notice=inject(GcNotificationService);
 protected readonly transfer=signal<SupplyTransfer|null>(null);
 protected readonly articleNames=signal<Record<string,string>>({});
 protected readonly quantities=signal<ReceiptInput[]>([]);
 protected readonly observations=signal('');
 protected readonly busy=signal(false);protected readonly actionBusy=signal(false);
 protected readonly error=signal('');
 private key=newKey();
 protected readonly positive=(value:string)=>decimal(value)!==null;
 protected readonly ready=()=>{
  const t=this.transfer();if(!t||t.estado!=='EN_TRANSITO')return false;
  const selected=this.quantities().filter(l=>decimal(l.cantidad));
  return selected.length>0&&selected.every(l=>{
   const original=t.lineas.find(x=>x.id===l.key);
   return Boolean(original&&parseApiDecimal(decimal(l.cantidad)!).lte(parseApiDecimal(original.pendiente)));
  });
 };
 ngOnInit(){void this.load()}
 protected getQuantity(id:string){return this.quantities().find(x=>x.key===id)?.cantidad??''}
 protected setQuantity(id:string,value:string){
  this.quantities.update(ls=>ls.map(l=>l.key===id?{...l,cantidad:value}:l));
  this.key=newKey();
 }
 protected async load(){
  const id=this.route.snapshot.paramMap.get('id');if(!id)return;
  this.busy.set(true);this.error.set('');
  try{
   const t=await firstValueFrom(this.api.transfer(id));this.transfer.set(t);
   this.quantities.set(t.lineas.map(l=>({key:l.id,cantidad:l.pendiente})));
   try{
    const r=await firstValueFrom(this.api.requisition(t.requisicionId));
    this.articleNames.set(Object.fromEntries(r.lineas.map(x=>[x.articuloId,x.articulo.nombre])));
   }catch{this.articleNames.set({})}
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
 protected async receive(){
  const t=this.transfer();if(!t||!this.ready()||this.actionBusy()||!this.access.canSupplyReceive())return;
  if(!await this.confirm.confirm({title:'Confirmar recepción del traslado',
   message:'Se registrarán las cantidades recibidas en el inventario de destino.',
   confirmText:'Recibir mercancía'}))return;
  this.actionBusy.set(true);this.error.set('');
  try{
   await firstValueFrom(this.api.receiveTransfer(t.id,{
    claveOperacion:this.key,observaciones:this.observations().trim(),
    lineas:this.quantities().filter(l=>decimal(l.cantidad)).map(l=>({
     transferenciaLineaId:l.key,cantidadRecibida:decimal(l.cantidad)!
    }))
   }));
   this.key=newKey();this.notice.show('Recepción del traslado registrada.','success');
   await this.load();
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
}
