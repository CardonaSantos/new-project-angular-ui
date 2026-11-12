
import {Component,OnInit,inject,signal} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {money} from '../../orders/data-access/orders.helpers';
import {formatInstant} from '../../../shared/formatting';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {DeliverySettlementsApi} from '../data-access/delivery-settlements.api';
import type {CourierSettlementDetail} from '../data-access/delivery-settlements.models';
import {COURIER_SETTLEMENT_STATE_LABEL} from '../data-access/delivery-settlements.models';

@Component({
 selector:'gc-courier-settlement-detail-page',
 imports:[RouterLink,GcPageHeader,GcButtonDirective,GcErrorState],
 template:`
 <main class="del-page del-narrow">
  <gc-page-header title="Liquidación de repartidor">
   <a gcPageActions gcButton variant="outline" routerLink="/delivery/settlements">Nueva liquidación</a>
  </gc-page-header>
  @if(loadError()){<gc-error-state [message]="loadError()!" (retry)="load()"/>}
  @else if(row();as r){
   <section class="del-card">
    <div class="del-row"><h2>Resumen</h2>
     <span class="del-state-badge" [class.del-state-badge--done]="r.estado==='CERRADA'">
      {{stateLabel(r.estado)}}</span></div>
    <dl class="del-kv">
     <div><dt>Total esperado</dt><dd>{{money(r.totalEsperado)}}</dd></div>
     <div><dt>Total entregado</dt><dd>{{money(r.totalEntregado)}}</dd></div>
     @if(r.cerradaEn){<div><dt>Cerrada</dt><dd>{{formatDate(r.cerradaEn)}}</dd></div>}
     @if(r.movimientoCajaId){<div><dt>Movimiento de caja</dt><dd>{{r.movimientoCajaId}}</dd></div>}
    </dl>
   </section>
   <section class="del-card">
    <h2>Pagos liquidados ({{r.lineas.length}})</h2>
    <div class="del-blockers">
     @for(l of r.lineas;track l.pagoId){
      <div class="del-row" style="justify-content:space-between;border:1px solid var(--gc-outline-variant);border-radius:.5rem;padding:.5rem .65rem;">
       <span class="del-muted">Pago {{l.pagoId}}</span>
       <strong>{{money(l.monto)}}</strong>
      </div>
     }
    </div>
   </section>
  }
 </main>`,
 styleUrl:'../delivery.scss'
})
export class GcCourierSettlementDetailPage implements OnInit{
 private readonly route=inject(ActivatedRoute);
 private readonly branch=inject(GcBranchContext);
 private readonly api=inject(DeliverySettlementsApi);
 protected readonly money=money;
 protected readonly row=signal<CourierSettlementDetail|null>(null);
 protected readonly loadError=signal<string|null>(null);
 ngOnInit(){void this.load()}
 protected stateLabel(estado:string){
  return COURIER_SETTLEMENT_STATE_LABEL[estado as keyof typeof COURIER_SETTLEMENT_STATE_LABEL]??estado;
 }
 protected formatDate(value:string){return formatInstant(value,this.branch.active()?.zonaHoraria??'America/Guatemala')}
 protected async load(){
  const id=this.route.snapshot.paramMap.get('id');if(!id)return;
  this.loadError.set(null);
  try{this.row.set(await firstValueFrom(this.api.courierDetail(id)));}
  catch(e){this.loadError.set(gcErrorMessage(e))}
 }
}
