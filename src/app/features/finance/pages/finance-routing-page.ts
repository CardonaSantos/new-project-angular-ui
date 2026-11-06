
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
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {GcFinanceNav} from '../finance-nav';
import {FinanceApi} from '../data-access/finance.api';
import {FinanceAccess} from '../data-access/finance-access';
import {FinanceIntentService} from '../data-access/finance-intent.service';
import type {FinanceAccount,FinanceRoute,FinanceRouteMethod} from '../data-access/finance.models';

const METODOS:{id:FinanceRouteMethod;label:string}[]=[
 {id:'TARJETA',label:'Tarjeta'},{id:'TRANSFERENCIA',label:'Transferencia'},{id:'OTRO',label:'Otro'}];

@Component({
 selector:'gc-finance-routing-page',
 imports:[GcButtonDirective,GcPageHeader,GcErrorState,GcFinanceNav,GcSearchSelect],
 template:`
 <div class="fin-page fin-narrow">
  <gc-page-header title="Enrutamiento de pagos"
   description="Define a qué cuenta financiera se imputa automáticamente cada medio de pago electrónico."/>
  <gc-finance-nav/>
  @if(loadError()){<gc-error-state [message]="loadError()!" (retry)="load()"/>}
  @else{
   @for(m of metodos;track m.id){
    <section class="fin-card">
     <div class="fin-row"><h2>{{m.label}}</h2>
      @if(editing()!==m.id){
       <button gcButton variant="outline" type="button" (click)="edit(m.id)">Editar</button>
      }
     </div>
     @if(editing()===m.id){
      <div class="fin-field"><label [for]="'route-account-'+m.id">Cuenta financiera</label>
       <gc-search-select [id]="'route-account-'+m.id" label="Cuenta financiera" [items]="accountChoices()"
        [value]="accountId()" [loading]="accountsBusy()" (valueChange)="accountId.set($event)"/>
      </div>
      <label><input type="checkbox" [checked]="activa()" (change)="activa.set($any($event.target).checked)"/> Regla activa</label>
      @if(saveError()){<p class="fin-alert" role="alert">{{saveError()}}</p>}
      <div class="fin-actions">
       <button type="button" gcButton [disabled]="!accountId()||action.busy()||!intentReady()"
        (click)="save(m.id)">{{action.busy()?'Guardando…':'Guardar'}}</button>
       <button type="button" gcButton variant="outline" (click)="cancel()">Cancelar</button>
      </div>
     }@else{
      <p class="fin-muted">{{routeFor(m.id)?.cuentaNombre??'Sin asignar'}}
       @if(routeFor(m.id)){ · {{routeFor(m.id)!.activa?'Activa':'Inactiva'}} }</p>
     }
    </section>
   }
  }
 </div>`,
 styleUrl:'../finance.scss'
})
export class GcFinanceRoutingPage {
 protected readonly branch=inject(GcBranchContext);
 private readonly api=inject(FinanceApi);
 private readonly access=inject(FinanceAccess);
 private readonly intents=inject(FinanceIntentService);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 protected readonly metodos=METODOS;
 protected readonly routes=signal<FinanceRoute[]>([]);
 protected readonly loadError=signal<string|null>(null);
 protected readonly editing=signal<FinanceRouteMethod|null>(null);
 protected readonly accounts=signal<FinanceAccount[]>([]);
 protected readonly accountsBusy=signal(false);
 protected readonly accountChoices=computed(()=>this.accounts().map(a=>({id:a.id,label:a.nombre})));
 protected readonly accountId=signal('');
 protected readonly activa=signal(true);
 protected readonly saveError=signal<string|null>(null);
 protected readonly intentReady=signal(false);
 protected readonly action=new GcConfirmedAction();
 private operationId='';
 protected readonly routeFor=(m:FinanceRouteMethod)=>this.routes().find(r=>r.metodo===m)??null;
 constructor(){
  effect(()=>{if(this.branch.branchId())void this.load()});
 }
 protected canManage(){return this.access.canRoutingManage()}
 protected async load(){
  const sucursalId=this.branch.branchId();if(!sucursalId)return;
  this.loadError.set(null);
  try{const r=await firstValueFrom(this.api.routing(sucursalId));this.routes.set(r.data)}
  catch(e){this.loadError.set(gcErrorMessage(e))}
 }
 protected async edit(metodo:FinanceRouteMethod){
  const sucursalId=this.branch.branchId();if(!sucursalId)return;
  const current=this.routeFor(metodo);
  this.editing.set(metodo);this.accountId.set(current?.cuentaFinancieraId??'');
  this.activa.set(current?.activa??true);this.saveError.set(null);this.intentReady.set(false);
  this.accountsBusy.set(true);
  try{
   const [intentId,accounts]=await Promise.all([
    this.intents.require(sucursalId,'FIN_ROUTING_UPSERT'),
    firstValueFrom(this.api.accounts({sucursalId,limit:100})),
   ]);
   this.operationId=intentId;this.intentReady.set(true);
   this.accounts.set(accounts.data.filter(a=>a.activa));
  }catch(e){this.saveError.set(gcErrorMessage(e))}
  finally{this.accountsBusy.set(false)}
 }
 protected cancel(){this.editing.set(null);this.saveError.set(null);this.intentReady.set(false)}
 protected async save(metodo:FinanceRouteMethod){
  const sucursalId=this.branch.branchId();
  if(!sucursalId||!this.accountId()||!this.intentReady())return;
  this.saveError.set(null);
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Guardar regla de enrutamiento',message:'¿Guardar esta regla de enrutamiento?',confirmText:'Guardar'},
   ()=>firstValueFrom(this.api.upsertRoute({
    operationId:this.operationId,sucursalId,metodo,cuentaFinancieraId:this.accountId(),activa:this.activa()})));
  if(!r)return;
  if(!r.ok){if(r.reason==='error'){this.saveError.set(gcErrorMessage(r.error));this.intents.release(sucursalId,'FIN_ROUTING_UPSERT')}return}
  this.cancel();this.notices.show('Regla de enrutamiento guardada.','success');await this.load();
 }
 hasUnsavedChanges(){return this.editing()!==null}
}
