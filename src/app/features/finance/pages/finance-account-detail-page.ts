
import {Component,computed,inject,OnInit,signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcDataTable,type GcTableRow,type GcTableColumn} from '../../../design-system/data/gc-data-table';
import {GcPagination,type GcPageChange} from '../../../design-system/data/gc-pagination';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {formatCurrency,formatInstant} from '../../../shared/formatting';
import {GcFinanceNav} from '../finance-nav';
import {FinanceApi} from '../data-access/finance.api';
import {FinanceAccess} from '../data-access/finance-access';
import {FinanceIntentService} from '../data-access/finance-intent.service';
import type {FinanceAccount} from '../data-access/finance.models';

const TIPO_LABEL:Record<string,string>={BANCO:'Banco',TARJETA_EMPRESA:'Tarjeta de empresa',EFECTIVO_EXTERNO:'Efectivo externo'};
const REFERENCIA_LABEL:Record<string,string>={
 GASTO_OPERATIVO:'Gasto operativo',PAGO:'Cobro de cliente',REEMBOLSO_PAGO:'Reembolso',PAGO_PROVEEDOR:'Pago a proveedor',
 EXTRACTO_BANCARIO:'Extracto bancario',AJUSTE:'Ajuste',REVERSA:'Reversa'};

@Component({
 selector:'gc-finance-account-detail-page',
 imports:[GcPageHeader,GcButtonDirective,GcDataTable,GcPagination,GcErrorState,GcFinanceNav],
 template:`
 <div class="fin-page">
  <gc-page-header [title]="account()?.nombre??'Cuenta financiera'"/>
  <gc-finance-nav/>
  @if(loadError()){<gc-error-state [message]="loadError()!" (retry)="loadAccount()"/>}
  @else{
   <section class="fin-card">
    <div class="fin-row">
     <dl class="fin-kv">
      <div><dt>Tipo</dt><dd>{{tipoLabel()}}</dd></div>
      <div><dt>Moneda</dt><dd>{{account()?.moneda}}</dd></div>
      <div><dt>Saldo registrado</dt><dd>{{saldo()}}</dd></div>
      <div><dt>Estado</dt><dd>{{account()?.activa?'Activa':'Inactiva'}}</dd></div>
     </dl>
     @if(canManage()&&!editing()){
      <button gcButton variant="outline" type="button" (click)="startEdit()">Editar</button>
     }
    </div>
    @if(editing()){
     <div class="fin-field"><label for="account-rename">Nombre</label>
      <input id="account-rename" [value]="nombre()" (input)="nombre.set($any($event.target).value)" maxlength="160"/>
     </div>
     @if(renameError()){<p class="fin-alert" role="alert">{{renameError()}}</p>}
     <div class="fin-actions">
      <button type="button" gcButton [disabled]="!nombre().trim()||action.busy()||!intentReady()"
       (click)="save()">{{action.busy()?'Guardando…':'Guardar'}}</button>
      <button type="button" gcButton variant="outline" (click)="cancelEdit()">Cancelar</button>
     </div>
    }
   </section>
   <section class="fin-card">
    <h2>Movimientos</h2>
    @if(page.status()==='error'){<gc-error-state [message]="movError()" (retry)="reload()"/>}
    @else{
     <gc-data-table [columns]="columns" [rows]="page.data()?.rows??[]" [loading]="page.busy()"/>
     <gc-pagination [index]="pageIndex()" [size]="limit()" [total]="page.data()?.total??0" (pageChange)="onPage($event)"/>
    }
   </section>
  }
 </div>`,
 styleUrl:'../finance.scss'
})
export class GcFinanceAccountDetailPage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 private readonly branch=inject(GcBranchContext);
 private readonly api=inject(FinanceApi);
 private readonly access=inject(FinanceAccess);
 private readonly intents=inject(FinanceIntentService);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 protected readonly account=signal<FinanceAccount|null>(null);
 protected readonly loadError=signal<string|null>(null);
 protected readonly page=new GcPageState<{rows:GcTableRow[];total:number}>();
 protected readonly pageIndex=signal(0);
 protected readonly limit=signal(20);
 protected readonly tipoLabel=computed(()=>{const t=this.account()?.tipo;return t?TIPO_LABEL[t]??t:''});
 protected readonly saldo=computed(()=>{const a=this.account();
  return a?formatCurrency(a.saldoRegistrado,a.moneda==='USD'?'USD':'GTQ'):''});
 protected readonly columns:GcTableColumn[]=[
  {key:'fecha',label:'Fecha'},{key:'origen',label:'Origen'},
  {key:'monto',label:'Monto',numeric:true},{key:'descripcion',label:'Descripción'}];
 protected readonly editing=signal(false);
 protected readonly nombre=signal('');
 protected readonly renameError=signal<string|null>(null);
 protected readonly intentReady=signal(false);
 protected readonly action=new GcConfirmedAction();
 private operationId='';
 private get id(){return this.route.snapshot.paramMap.get('id')??''}
 async ngOnInit(){await this.loadAccount();await this.loadMovements()}
 protected canManage(){return this.access.canAccountsManage()}
 protected async loadAccount(){
  this.loadError.set(null);
  try{this.account.set(await firstValueFrom(this.api.account(this.id)))}
  catch(e){this.loadError.set(gcErrorMessage(e))}
 }
 protected movError(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.loadMovements()}
 protected async onPage(e:GcPageChange){this.pageIndex.set(e.index);this.limit.set(e.size);await this.loadMovements()}
 private async loadMovements(){
  const zone=this.branch.branches().find(b=>b.id===this.account()?.sucursalId)?.zonaHoraria??'America/Guatemala';
  await this.page.load(async()=>{
   const r=await firstValueFrom(this.api.accountMovements(this.id,{page:this.pageIndex()+1,limit:this.limit()}));
   return {total:r.meta.total,rows:r.data.map(m=>({id:m.id,
    fecha:formatInstant(m.creadoEn,zone),
    origen:REFERENCIA_LABEL[m.referenciaTipo]??m.referenciaTipo,
    monto:formatCurrency(m.monto),descripcion:m.descripcion??'—'}))};
  });
 }
 protected async startEdit(){
  const sucursalId=this.account()?.sucursalId;if(!sucursalId)return;
  this.nombre.set(this.account()?.nombre??'');this.renameError.set(null);
  this.editing.set(true);this.intentReady.set(false);
  try{
   this.operationId=await this.intents.require(sucursalId,'FIN_ACCOUNT_RENAME');
   this.intentReady.set(true);
  }catch(e){this.renameError.set(gcErrorMessage(e))}
 }
 protected cancelEdit(){this.editing.set(false);this.renameError.set(null);this.intentReady.set(false)}
 protected async save(){
  const sucursalId=this.account()?.sucursalId;
  if(!sucursalId||!this.nombre().trim()||!this.intentReady())return;
  this.renameError.set(null);
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Renombrar cuenta',message:'¿Guardar el nuevo nombre de la cuenta?',confirmText:'Guardar'},
   ()=>firstValueFrom(this.api.updateAccount(this.id,{operationId:this.operationId,nombre:this.nombre().trim()})));
  if(!r)return;
  if(!r.ok){
   if(r.reason==='error'){this.renameError.set(gcErrorMessage(r.error));this.intents.release(sucursalId,'FIN_ACCOUNT_RENAME')}
   return;
  }
  this.account.set(r.value);this.editing.set(false);this.notices.show('Cuenta actualizada.','success');
 }
}
