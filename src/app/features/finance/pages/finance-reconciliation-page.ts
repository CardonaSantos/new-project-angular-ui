
import {Component,computed,effect,inject,signal} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcDataTable,type GcTableRow,type GcTableColumn} from '../../../design-system/data/gc-data-table';
import {GcTableCellDirective} from '../../../design-system/data/gc-table-cell.directive';
import {GcPagination,type GcPageChange} from '../../../design-system/data/gc-pagination';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {formatCurrency,formatInstant} from '../../../shared/formatting';
import {GcFinanceNav} from '../finance-nav';
import {FinanceUrlState} from '../data-access/finance-url-state';
import {FinanceApi} from '../data-access/finance.api';
import {FinanceAccess} from '../data-access/finance-access';
import {FinanceIntentService} from '../data-access/finance-intent.service';
import type {FinanceAccount,FinanceExternalSourceType,FinancePendingExternal} from '../data-access/finance.models';

const METODO_LABEL:Record<string,string>={TARJETA:'Tarjeta',TRANSFERENCIA:'Transferencia',OTRO:'Otro'};
const SOURCE_CHOICES:{id:FinanceExternalSourceType;label:string}[]=[
 {id:'PAGO',label:'Cobros a clientes'},{id:'REEMBOLSO_PAGO',label:'Reembolsos'},
 {id:'PAGO_PROVEEDOR',label:'Pagos a proveedores'}];

@Component({
 selector:'gc-finance-reconciliation-page',
 providers:[FinanceUrlState],
 imports:[GcPageHeader,GcButtonDirective,GcDataTable,GcTableCellDirective,
  GcPagination,GcErrorState,GcFinanceNav,GcSearchSelect],
 template:`
 <div class="fin-page">
  <gc-page-header title="Conciliación"
   description="Operaciones externas confirmadas (cobros, reembolsos y pagos a proveedores) que aún no se han imputado a una cuenta financiera."/>
  <gc-finance-nav/>
  <section class="fin-card">
   <div class="fin-toolbar">
    <gc-search-select id="rec-branch" label="Sucursal" [items]="branchChoices()"
     [value]="url.filters().sucursalId" [clearable]="false" (valueChange)="changeBranch($event)"/>
    <gc-search-select id="rec-source" label="Origen" [items]="sourceChoices" [searchable]="false"
     [value]="url.filters().sourceType" [clearable]="false" (valueChange)="changeSource($event)"/>
   </div>
   @if(page.status()==='error'){<gc-error-state [message]="errorMessage()" (retry)="reload()"/>}
   @else{
    <gc-data-table [columns]="columns" [rows]="page.data()?.rows??[]" [loading]="page.busy()" [rowClass]="rowClass">
     <ng-template gcTableCell="actions" let-row>
      <button type="button" gcButton variant="outline" (click)="select(row)">Imputar a cuenta</button>
     </ng-template>
    </gc-data-table>
    <gc-pagination [index]="url.filters().page-1" [size]="url.filters().limit"
     [total]="page.data()?.total??0" (pageChange)="onPage($event)"/>
   }
  </section>
  @if(selected();as sel){
   <section class="fin-card fin-narrow">
    <div class="fin-row"><h2 #panelHeading tabindex="-1">Imputar operación a cuenta</h2>
     <button gcButton variant="outline" type="button" (click)="clear()">Cancelar</button></div>
    <dl class="fin-kv">
     <div><dt>Método</dt><dd>{{methodLabel(sel.metodo)}}</dd></div>
     <div><dt>Monto</dt><dd>{{formatCurrency(sel.monto)}}</dd></div>
     <div><dt>Fecha</dt><dd>{{formatInstant(sel.fecha,zone())}}</dd></div>
     <div><dt>Referencia</dt><dd>{{sel.referencia??'—'}}</dd></div>
    </dl>
    <div class="fin-field"><label for="rec-account">Cuenta financiera destino</label>
     <gc-search-select id="rec-account" label="Cuenta financiera destino" [items]="accountChoices()"
      [value]="accountId()" [loading]="accountsBusy()" (valueChange)="accountId.set($event)"/>
    </div>
    @if(postError()){<p class="fin-alert" role="alert">{{postError()}}</p>}
    <div class="fin-actions">
     <button type="button" gcButton [disabled]="!accountId()||action.busy()||!intentReady()"
      (click)="post()">{{action.busy()?'Imputando…':'Confirmar imputación'}}</button>
    </div>
   </section>
  }
 </div>`,
 styleUrl:'../finance.scss'
})
export class GcFinanceReconciliationPage {
 protected readonly url=inject(FinanceUrlState);
 protected readonly branch=inject(GcBranchContext);
 protected readonly branchChoices=computed(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly sourceChoices=SOURCE_CHOICES;
 private readonly api=inject(FinanceApi);
 private readonly access=inject(FinanceAccess);
 private readonly intents=inject(FinanceIntentService);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 protected readonly page=new GcPageState<{rows:GcTableRow[];total:number}>();
 protected readonly selected=signal<FinancePendingExternal|null>(null);
 protected readonly accounts=signal<FinanceAccount[]>([]);
 protected readonly accountsBusy=signal(false);
 protected readonly accountChoices=computed(()=>this.accounts().map(a=>({id:a.id,label:a.nombre})));
 protected readonly accountId=signal('');
 protected readonly postError=signal<string|null>(null);
 protected readonly intentReady=signal(false);
 protected readonly action=new GcConfirmedAction();
 protected readonly formatCurrency=formatCurrency;
 protected readonly formatInstant=formatInstant;
 protected readonly zone=computed(()=>
  this.branch.branches().find(b=>b.id===this.url.filters().sucursalId)?.zonaHoraria??'America/Guatemala');
 protected readonly methodLabel=(m:string)=>METODO_LABEL[m]??m;
 private operationId='';
 protected readonly columns:GcTableColumn[]=[
  {key:'fecha',label:'Fecha'},{key:'metodo',label:'Método'},{key:'referencia',label:'Referencia'},
  {key:'monto',label:'Monto',numeric:true},{key:'actions',label:'Acciones'}];
 protected readonly rowClass=(row:GcTableRow)=>
  this.selected()&&row['id']===this.selected()?.sourceId?'fin-table-row--active':null;
 constructor(){
  effect(()=>{const f=this.url.filters();this.clear();if(f.sucursalId)void this.load()});
 }
 protected canRead(){return this.access.canReconciliationRead()}
 protected errorMessage(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load()}
 protected async changeBranch(id:string){await this.url.patch({sucursalId:id,page:1})}
 protected async changeSource(id:string){await this.url.patch({sourceType:id,page:1})}
 protected async onPage(e:GcPageChange){await this.url.patch({page:e.index+1,limit:e.size})}
 private async load(){
  const f=this.url.filters();
  const zone=this.zone();
  await this.page.load(async()=>{
   const r=await firstValueFrom(this.api.pendingExternal({
    sucursalId:f.sucursalId,sourceType:f.sourceType as FinanceExternalSourceType,page:f.page,limit:f.limit}));
   return {total:r.meta.total,rows:r.data.map(x=>({id:x.sourceId,sourceId:x.sourceId,fecha:formatInstant(x.fecha,zone),
    metodo:this.methodLabel(x.metodo),referencia:x.referencia??'—',monto:formatCurrency(x.monto),actions:x.sourceId}))};
  },v=>v.rows.length===0);
 }
 protected async select(row:GcTableRow){
  const f=this.url.filters();
  const pending=await firstValueFrom(this.api.pendingExternal({
   sucursalId:f.sucursalId,sourceType:f.sourceType as FinanceExternalSourceType,page:1,limit:100}));
  const item=pending.data.find(x=>x.sourceId===row['id']);
  if(!item)return;
  this.selected.set(item);this.accountId.set('');this.postError.set(null);this.intentReady.set(false);
  this.accountsBusy.set(true);
  try{
   const [intentId,accounts]=await Promise.all([
    this.intents.require(f.sucursalId,'FIN_EXTERNAL_POST'),
    firstValueFrom(this.api.accounts({sucursalId:f.sucursalId,limit:100})),
   ]);
   this.operationId=intentId;this.intentReady.set(true);
   this.accounts.set(accounts.data.filter(a=>a.activa));
  }catch(e){this.postError.set(gcErrorMessage(e))}
  finally{this.accountsBusy.set(false)}
 }
 protected clear(){
  this.selected.set(null);this.accountId.set('');this.postError.set(null);this.intentReady.set(false);
 }
 protected async post(){
  const sel=this.selected();if(!sel||!this.accountId()||!this.intentReady())return;
  const f=this.url.filters();
  this.postError.set(null);
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Imputar operación',message:'¿Imputar esta operación a la cuenta seleccionada?',confirmText:'Imputar'},
   ()=>firstValueFrom(this.api.postExternal({
    operationId:this.operationId,sucursalId:f.sucursalId,sourceType:sel.sourceType,
    sourceId:sel.sourceId,cuentaFinancieraId:this.accountId()})));
  if(!r)return;
  if(!r.ok){if(r.reason==='error'){this.postError.set(gcErrorMessage(r.error));this.intents.release(f.sucursalId,'FIN_EXTERNAL_POST')}return}
  this.clear();this.notices.show('Operación imputada a la cuenta.','success');await this.load();
 }
}
