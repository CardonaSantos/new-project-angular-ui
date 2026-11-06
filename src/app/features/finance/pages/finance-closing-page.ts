
import {Component,computed,effect,inject,signal} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {formatCurrency,formatInstant} from '../../../shared/formatting';
import {GcFinanceNav} from '../finance-nav';
import {FinanceApi} from '../data-access/finance.api';
import {FinanceAccess} from '../data-access/finance-access';
import {FinanceIntentService} from '../data-access/finance-intent.service';
import type {FinanceClosePreview} from '../data-access/finance.models';

function yesterday():string{
 const d=new Date();d.setUTCDate(d.getUTCDate()-1);
 return d.toISOString().slice(0,10);
}

@Component({
 selector:'gc-finance-closing-page',
 imports:[GcPageHeader,GcButtonDirective,GcErrorState,GcFinanceNav],
 template:`
 <div class="fin-page fin-narrow">
  <gc-page-header title="Cierre diario"
   description="Resumen consolidado de ventas, cobros, gastos y caja para un día operativo; el cierre es definitivo."/>
  <gc-finance-nav/>
  <section class="fin-card">
   <div class="fin-toolbar">
    <div class="fin-field"><label for="closing-fecha">Fecha operativa</label>
     <input id="closing-fecha" type="date" [value]="fecha()" (input)="fecha.set($any($event.target).value)"/>
    </div>
    <button gcButton variant="outline" type="button" [disabled]="!fecha()||loading()" (click)="consult()">
     {{loading()?'Consultando…':'Consultar'}}</button>
   </div>
   @if(loadError()){<gc-error-state [message]="loadError()!" (retry)="consult()"/>}
  </section>
  @if(preview();as p){
   <section class="fin-card">
    <div class="fin-row"><h2>{{p.cerrado?'Día cerrado':'Vista previa del cierre'}}</h2>
     @if(p.cerrado){<span class="fin-state-badge">Cerrado {{p.cerradoEn?formatInstant(p.cerradoEn,zone()):''}}</span>}
    </div>
    <dl class="fin-kv">
     <div><dt>Ventas</dt><dd>{{p.resumen.ventas.cantidad}} · {{formatCurrency(p.resumen.ventas.total)}}</dd></div>
     <div><dt>Cobros</dt><dd>{{p.resumen.cobros.cantidad}} · {{formatCurrency(p.resumen.cobros.total)}}</dd></div>
     <div><dt>Reembolsos</dt><dd>{{p.resumen.reembolsos.cantidad}} · {{formatCurrency(p.resumen.reembolsos.total)}}</dd></div>
     <div><dt>Pagos a proveedor</dt><dd>{{p.resumen.pagosProveedor.cantidad}} · {{formatCurrency(p.resumen.pagosProveedor.total)}}</dd></div>
     <div><dt>Gastos operativos</dt><dd>{{p.resumen.gastosOperativos.cantidad}} · {{formatCurrency(p.resumen.gastosOperativos.total)}}</dd></div>
     <div><dt>Libro financiero</dt><dd>{{p.resumen.libroFinanciero.cantidadMovimientos}} mov. · {{formatCurrency(p.resumen.libroFinanciero.netoFirmado)}} neto</dd></div>
     <div><dt>Ajustes por reversa</dt><dd>{{p.resumen.ajustesPorReversa.cantidad}} · {{formatCurrency(p.resumen.ajustesPorReversa.totalFirmado)}}</dd></div>
     <div><dt>Turnos de caja</dt><dd>{{p.resumen.caja.turnos}} ({{p.resumen.caja.turnosAbiertos}} abiertos)</dd></div>
     <div><dt>Ingresos / egresos de caja</dt><dd>{{formatCurrency(p.resumen.caja.ingresos)}} / {{formatCurrency(p.resumen.caja.egresos)}}</dd></div>
     <div><dt>Diferencia de arqueo</dt><dd>{{formatCurrency(p.resumen.caja.diferenciaArqueo)}}</dd></div>
     <div><dt>Órdenes abiertas</dt><dd>{{p.resumen.ordenesAbiertas}}</dd></div>
    </dl>
    @if(p.resumen.advertencias.length){
     <ul class="fin-warning-list">
      @for(w of p.resumen.advertencias;track w){<li>{{w}}</li>}
     </ul>
    }
    @if(!p.cerrado){
     @if(closeError()){<p class="fin-alert" role="alert">{{closeError()}}</p>}
     @if(canExecute()){
      <div class="fin-actions">
       <button type="button" gcButton [disabled]="!p.resumen.puedeCerrar||action.busy()" (click)="close()">
        {{action.busy()?'Cerrando…':'Cerrar día'}}</button>
      </div>
      @if(!p.resumen.puedeCerrar){<p class="fin-muted">No se puede cerrar todavía: revise las advertencias.</p>}
     }
    }
   </section>
  }
 </div>`,
 styleUrl:'../finance.scss'
})
export class GcFinanceClosingPage {
 protected readonly branch=inject(GcBranchContext);
 private readonly api=inject(FinanceApi);
 private readonly access=inject(FinanceAccess);
 private readonly intents=inject(FinanceIntentService);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 protected readonly fecha=signal(yesterday());
 protected readonly preview=signal<FinanceClosePreview|null>(null);
 protected readonly loading=signal(false);
 protected readonly loadError=signal<string|null>(null);
 protected readonly closeError=signal<string|null>(null);
 protected readonly action=new GcConfirmedAction();
 protected readonly formatCurrency=formatCurrency;
 protected readonly formatInstant=formatInstant;
 protected readonly zone=computed(()=>
  this.branch.branches().find(b=>b.id===this.branch.branchId())?.zonaHoraria??'America/Guatemala');
 private operationId='';
 constructor(){
  effect(()=>{if(this.branch.branchId())this.preview.set(null)});
 }
 protected canExecute(){return this.access.canClosingExecute()}
 protected async consult(){
  const sucursalId=this.branch.branchId();if(!sucursalId||!this.fecha())return;
  this.loading.set(true);this.loadError.set(null);this.closeError.set(null);
  try{this.preview.set(await firstValueFrom(this.api.closingPreview({sucursalId,fechaOperativa:this.fecha()})))}
  catch(e){this.loadError.set(gcErrorMessage(e));this.preview.set(null)}
  finally{this.loading.set(false)}
 }
 protected async close(){
  const sucursalId=this.branch.branchId();const p=this.preview();
  if(!sucursalId||!p||p.cerrado||!p.resumen.puedeCerrar)return;
  this.closeError.set(null);
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Cerrar día operativo',
   message:'El cierre es definitivo y no puede deshacerse. ¿Cerrar el día '+this.fecha()+'?',
   confirmText:'Cerrar día'},
   async()=>{
    this.operationId=await this.intents.require(sucursalId,'FIN_DAY_CLOSE');
    return firstValueFrom(this.api.confirmClosing({operationId:this.operationId,sucursalId,fechaOperativa:this.fecha()}));
   });
  if(!r)return;
  if(!r.ok){
   if(r.reason==='error'){this.closeError.set(gcErrorMessage(r.error));this.intents.release(sucursalId,'FIN_DAY_CLOSE')}
   return;
  }
  this.notices.show('Día operativo cerrado.','success');await this.consult();
 }
}
