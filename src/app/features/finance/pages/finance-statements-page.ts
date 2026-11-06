
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
import {formatCalendarDate,formatCurrency,formatInstant} from '../../../shared/formatting';
import {GcFinanceNav} from '../finance-nav';
import {FinanceUrlState} from '../data-access/finance-url-state';
import {FinanceApi} from '../data-access/finance.api';
import {FinanceAccess} from '../data-access/finance-access';
import {FinanceIntentService} from '../data-access/finance-intent.service';
import type {FinanceAccount,FinanceBankLineState,FinanceUnmatchedMovement} from '../data-access/finance.models';

const ESTADO_CHOICES=[{id:'PENDIENTE',label:'Pendiente'},{id:'CONCILIADO',label:'Conciliado'}];
interface ImportRow{claveExterna:string;fecha:string;monto:string;referencia:string;descripcion:string}
const emptyRow=():ImportRow=>({claveExterna:'',fecha:'',monto:'',referencia:'',descripcion:''});
const bankDate=(value:string)=>formatCalendarDate(value.slice(0,10));

@Component({
 selector:'gc-finance-statements-page',
 providers:[FinanceUrlState],
 imports:[GcPageHeader,GcButtonDirective,GcDataTable,GcTableCellDirective,
  GcPagination,GcErrorState,GcFinanceNav,GcSearchSelect],
 template:`
 <div class="fin-page">
  <gc-page-header title="Extractos bancarios"
   description="Importa líneas de extracto y concíliarlas contra movimientos ya registrados en el libro financiero."/>
  <gc-finance-nav/>
  <section class="fin-card">
   <div class="fin-toolbar">
    <gc-search-select id="stmt-branch" label="Sucursal" [items]="branchChoices()"
     [value]="url.filters().sucursalId" [clearable]="false" (valueChange)="changeBranch($event)"/>
    <gc-search-select id="stmt-account" label="Cuenta financiera" [items]="accountChoices()"
     [value]="cuentaId()" [loading]="accountsBusy()" (valueChange)="changeAccount($event)"/>
    <gc-search-select id="stmt-estado" label="Estado" [items]="estadoChoices" [searchable]="false"
     [value]="estado()" placeholder="Todos" (valueChange)="changeEstado($event)"/>
    @if(canImport()&&cuentaId()){
     <button gcButton type="button" (click)="openImport()">Importar líneas</button>
    }
   </div>
   @if(!cuentaId()){<p class="fin-muted">Selecciona una cuenta financiera para ver sus líneas de extracto.</p>}
   @else{
    @if(page.status()==='error'){<gc-error-state [message]="errorMessage()" (retry)="reload()"/>}
    @else{
     <gc-data-table [columns]="columns" [rows]="page.data()?.rows??[]" [loading]="page.busy()">
      <ng-template gcTableCell="actions" let-row>
       @if(canMatch()){
        @if(row['estado']==='Pendiente'){
         <button type="button" gcButton variant="outline" (click)="openMatch(row)">Conciliar</button>
        }@else{
         <button type="button" gcButton variant="outline" (click)="openUnmatch(row)">Desconciliar</button>
        }
       }
      </ng-template>
     </gc-data-table>
     <gc-pagination [index]="url.filters().page-1" [size]="url.filters().limit"
      [total]="page.data()?.total??0" (pageChange)="onPage($event)"/>
    }
   }
  </section>

  @if(importing()){
   <section class="fin-card fin-narrow">
    <div class="fin-row"><h2>Importar líneas de extracto</h2>
     <button gcButton variant="outline" type="button" (click)="closeImport()">Cancelar</button></div>
    @for(row of importRows();track $index){
     <div class="fin-import-row">
      <div class="fin-field"><label>Clave externa</label>
       <input [value]="row.claveExterna" (input)="setRow($index,'claveExterna',$any($event.target).value)" maxlength="160"/>
      </div>
      <div class="fin-field"><label>Fecha</label>
       <input type="date" [value]="row.fecha" (input)="setRow($index,'fecha',$any($event.target).value)"/>
      </div>
      <div class="fin-field"><label>Monto</label>
       <input [value]="row.monto" (input)="setRow($index,'monto',$any($event.target).value)" placeholder="0.00"/>
      </div>
      <div class="fin-field"><label>Referencia</label>
       <input [value]="row.referencia" (input)="setRow($index,'referencia',$any($event.target).value)" maxlength="160"/>
      </div>
      <div class="fin-field"><label>Descripción</label>
       <input [value]="row.descripcion" (input)="setRow($index,'descripcion',$any($event.target).value)" maxlength="500"/>
      </div>
      <button type="button" gcButton variant="outline" [disabled]="importRows().length<=1" (click)="removeRow($index)">Quitar</button>
     </div>
    }
    <div class="fin-actions">
     <button type="button" gcButton variant="outline" (click)="addRow()">Agregar línea</button>
    </div>
    @if(importError()){<p class="fin-alert" role="alert">{{importError()}}</p>}
    <div class="fin-actions">
     <button type="button" gcButton [disabled]="!canSubmitImport()||action.busy()" (click)="submitImport()">
      {{action.busy()?'Importando…':'Importar'}}</button>
    </div>
   </section>
  }

  @if(matching();as m){
   <section class="fin-card fin-narrow">
    <div class="fin-row"><h2>Conciliar línea</h2>
     <button gcButton variant="outline" type="button" (click)="closeMatch()">Cancelar</button></div>
    <dl class="fin-kv">
     <div><dt>Fecha</dt><dd>{{m['fecha']}}</dd></div>
     <div><dt>Monto</dt><dd>{{m['monto']}}</dd></div>
     <div><dt>Referencia</dt><dd>{{m['referencia']}}</dd></div>
    </dl>
    <div class="fin-field"><label for="stmt-movimiento">Movimiento del libro financiero</label>
     <gc-search-select id="stmt-movimiento" label="Movimiento" [items]="movementChoices()"
      [value]="movimientoId()" [loading]="movementsBusy()" (valueChange)="movimientoId.set($event)"/>
    </div>
    @if(canOverride()){
     <label><input type="checkbox" [checked]="forzar()" (change)="forzar.set($any($event.target).checked)"/>
      Forzar conciliación (requiere justificación)</label>
     @if(forzar()){
      <div class="fin-field"><label for="stmt-justificacion">Justificación (mínimo 20 caracteres)</label>
       <textarea id="stmt-justificacion" rows="2" [value]="justificacion()"
        (input)="justificacion.set($any($event.target).value)" maxlength="500"></textarea>
      </div>
     }
    }
    @if(matchError()){<p class="fin-alert" role="alert">{{matchError()}}</p>}
    <div class="fin-actions">
     <button type="button" gcButton [disabled]="!canSubmitMatch()||action.busy()" (click)="submitMatch()">
      {{action.busy()?'Conciliando…':'Conciliar'}}</button>
    </div>
   </section>
  }

  @if(unmatching();as row){
   <section class="fin-card fin-narrow">
    <div class="fin-row"><h2>Desconciliar línea</h2>
     <button gcButton variant="outline" type="button" (click)="closeUnmatch()">Cancelar</button></div>
    <div class="fin-field"><label for="stmt-motivo">Motivo (mínimo 10 caracteres)</label>
     <textarea id="stmt-motivo" rows="2" [value]="motivo()" (input)="motivo.set($any($event.target).value)" maxlength="500"></textarea>
    </div>
    @if(unmatchError()){<p class="fin-alert" role="alert">{{unmatchError()}}</p>}
    <div class="fin-actions">
     <button type="button" gcButton [disabled]="motivo().trim().length<10||action.busy()" (click)="submitUnmatch(row)">
      {{action.busy()?'Desconciliando…':'Desconciliar'}}</button>
    </div>
   </section>
  }
 </div>`,
 styleUrl:'../finance.scss'
})
export class GcFinanceStatementsPage {
 protected readonly url=inject(FinanceUrlState);
 protected readonly branch=inject(GcBranchContext);
 protected readonly branchChoices=computed(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly estadoChoices=ESTADO_CHOICES;
 private readonly api=inject(FinanceApi);
 private readonly access=inject(FinanceAccess);
 private readonly intents=inject(FinanceIntentService);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 protected readonly page=new GcPageState<{rows:GcTableRow[];total:number}>();
 protected readonly accounts=signal<FinanceAccount[]>([]);
 protected readonly accountsBusy=signal(false);
 protected readonly accountChoices=computed(()=>this.accounts().map(a=>({id:a.id,label:a.nombre})));
 protected readonly cuentaId=computed(()=>this.url.params().get('cuentaFinancieraId')??'');
 protected readonly estado=computed(()=>this.url.params().get('estado')??'');
 protected readonly action=new GcConfirmedAction();
 protected readonly formatCurrency=formatCurrency;
 protected readonly bankDate=bankDate;
 protected readonly zone=computed(()=>
  this.branch.branches().find(b=>b.id===this.url.filters().sucursalId)?.zonaHoraria??'America/Guatemala');
 protected readonly columns:GcTableColumn[]=[
  {key:'fecha',label:'Fecha'},{key:'monto',label:'Monto',numeric:true},{key:'referencia',label:'Referencia'},
  {key:'descripcion',label:'Descripción'},{key:'estado',label:'Estado'},{key:'actions',label:'Acciones'}];
 // import
 protected readonly importing=signal(false);
 protected readonly importRows=signal<ImportRow[]>([emptyRow()]);
 protected readonly importError=signal<string|null>(null);
 private importOperationId='';
 // match
 protected readonly matching=signal<GcTableRow|null>(null);
 protected readonly movements=signal<FinanceUnmatchedMovement[]>([]);
 protected readonly movementsBusy=signal(false);
 protected readonly movementChoices=computed(()=>this.movements().map(m=>
  ({id:m.id,label:m.referenciaTipo+' · '+formatCurrency(m.monto)+' · '+formatInstant(m.creadoEn,this.zone())})));
 protected readonly movimientoId=signal('');
 protected readonly forzar=signal(false);
 protected readonly justificacion=signal('');
 protected readonly matchError=signal<string|null>(null);
 private matchOperationId='';
 // unmatch
 protected readonly unmatching=signal<GcTableRow|null>(null);
 protected readonly motivo=signal('');
 protected readonly unmatchError=signal<string|null>(null);
 private unmatchOperationId='';
 constructor(){
  effect(()=>{
   const f=this.url.filters();
   this.closeImport();this.closeMatch();this.closeUnmatch();
   if(f.sucursalId)void this.loadAccounts();
   if(f.sucursalId&&this.cuentaId())void this.load();
   else this.page.reset();
  });
 }
 protected canImport(){return this.access.canStatementsImport()}
 protected canMatch(){return this.access.canStatementsMatch()}
 protected canOverride(){return this.access.canStatementsOverride()}
 protected errorMessage(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load()}
 protected async changeBranch(id:string){await this.url.patch({sucursalId:id,cuentaFinancieraId:null,page:1})}
 protected async changeAccount(id:string){await this.url.patch({cuentaFinancieraId:id||null,page:1})}
 protected async changeEstado(id:string){await this.url.patch({estado:id||null,page:1})}
 protected async onPage(e:GcPageChange){await this.url.patch({page:e.index+1,limit:e.size})}
 private async loadAccounts(){
  const sucursalId=this.url.filters().sucursalId;
  this.accountsBusy.set(true);
  try{const r=await firstValueFrom(this.api.accounts({sucursalId,limit:100}));this.accounts.set(r.data.filter(a=>a.activa))}
  finally{this.accountsBusy.set(false)}
 }
 private async load(){
  const f=this.url.filters(),cuentaFinancieraId=this.cuentaId(),estado=(this.estado()||undefined) as FinanceBankLineState|undefined;
  const zone=this.zone();
  await this.page.load(async()=>{
   const r=await firstValueFrom(this.api.bankStatements({sucursalId:f.sucursalId,cuentaFinancieraId,estado,page:f.page,limit:f.limit}));
   return {total:r.meta.total,rows:r.data.map(x=>({id:x.id,fecha:bankDate(x.fecha),monto:formatCurrency(x.monto),
    referencia:x.referencia??'—',descripcion:x.descripcion??'—',
    estado:x.estado==='CONCILIADO'?'Conciliado':'Pendiente'}))};
  });
 }
 // import
 protected openImport(){
  this.importRows.set([emptyRow()]);this.importError.set(null);this.importing.set(true);
 }
 protected closeImport(){this.importing.set(false);this.importError.set(null)}
 protected addRow(){this.importRows.update(rows=>[...rows,emptyRow()])}
 protected removeRow(i:number){this.importRows.update(rows=>rows.filter((_,idx)=>idx!==i))}
 protected setRow(i:number,key:keyof ImportRow,value:string){
  this.importRows.update(rows=>rows.map((r,idx)=>idx===i?{...r,[key]:value}:r));
 }
 protected canSubmitImport(){
  return this.importRows().every(r=>r.claveExterna.trim().length>=3&&/^\d{4}-\d{2}-\d{2}$/.test(r.fecha)&&
   /^-?\d+(\.\d{1,2})?$/.test(r.monto.trim()));
 }
 protected async submitImport(){
  const sucursalId=this.url.filters().sucursalId,cuentaFinancieraId=this.cuentaId();
  if(!sucursalId||!cuentaFinancieraId||!this.canSubmitImport())return;
  this.importError.set(null);
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Importar líneas de extracto',message:'¿Importar estas '+this.importRows().length+' líneas?',confirmText:'Importar'},
   async()=>{
    this.importOperationId=await this.intents.require(sucursalId,'FIN_STATEMENT_IMPORT');
    return firstValueFrom(this.api.importBankLines({operationId:this.importOperationId,sucursalId,cuentaFinancieraId,
     lineas:this.importRows().map(x=>({claveExterna:x.claveExterna.trim(),fecha:x.fecha,monto:x.monto.trim(),
      referencia:x.referencia.trim()||undefined,descripcion:x.descripcion.trim()||undefined}))}));
   });
  if(!r)return;
  if(!r.ok){if(r.reason==='error'){this.importError.set(gcErrorMessage(r.error));this.intents.release(sucursalId,'FIN_STATEMENT_IMPORT')}return}
  this.closeImport();this.notices.show('Líneas de extracto importadas.','success');await this.load();
 }
 // match
 protected async openMatch(row:GcTableRow){
  const sucursalId=this.url.filters().sucursalId,cuentaFinancieraId=this.cuentaId();
  this.matching.set(row);this.movimientoId.set('');this.forzar.set(false);this.justificacion.set('');
  this.matchError.set(null);this.movementsBusy.set(true);
  try{
   const [opId,pending]=await Promise.all([
    this.intents.require(sucursalId,'FIN_STATEMENT_MATCH'),
    firstValueFrom(this.api.bankLedgerPending({sucursalId,cuentaFinancieraId,limit:100})),
   ]);
   this.matchOperationId=opId;this.movements.set(pending.data);
  }catch(e){this.matchError.set(gcErrorMessage(e))}
  finally{this.movementsBusy.set(false)}
 }
 protected closeMatch(){
  this.matching.set(null);this.movimientoId.set('');this.forzar.set(false);
  this.justificacion.set('');this.matchError.set(null);
 }
 protected canSubmitMatch(){
  return !!this.movimientoId()&&(!this.forzar()||this.justificacion().trim().length>=20);
 }
 protected async submitMatch(){
  const row=this.matching();const sucursalId=this.url.filters().sucursalId;
  if(!row||!this.canSubmitMatch())return;
  this.matchError.set(null);
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Conciliar línea',message:'¿Conciliar esta línea de extracto con el movimiento seleccionado?',confirmText:'Conciliar'},
   ()=>firstValueFrom(this.api.matchBankLine({operationId:this.matchOperationId,sucursalId,
    lineaId:String(row['id']),movimientoId:this.movimientoId(),
    forzarConciliacion:this.forzar()||undefined,
    justificacion:this.forzar()?this.justificacion().trim():undefined})));
  if(!r)return;
  if(!r.ok){if(r.reason==='error'){this.matchError.set(gcErrorMessage(r.error));this.intents.release(sucursalId,'FIN_STATEMENT_MATCH')}return}
  this.closeMatch();this.notices.show('Línea conciliada.','success');await this.load();
 }
 // unmatch
 protected async openUnmatch(row:GcTableRow){
  const sucursalId=this.url.filters().sucursalId;
  this.unmatching.set(row);this.motivo.set('');this.unmatchError.set(null);
  try{this.unmatchOperationId=await this.intents.require(sucursalId,'FIN_STATEMENT_UNMATCH')}
  catch(e){this.unmatchError.set(gcErrorMessage(e))}
 }
 protected closeUnmatch(){this.unmatching.set(null);this.motivo.set('');this.unmatchError.set(null)}
 protected async submitUnmatch(row:GcTableRow){
  const sucursalId=this.url.filters().sucursalId;
  if(this.motivo().trim().length<10)return;
  this.unmatchError.set(null);
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Desconciliar línea',message:'¿Desconciliar esta línea de extracto?',confirmText:'Desconciliar'},
   ()=>firstValueFrom(this.api.unmatchBankLine({operationId:this.unmatchOperationId,sucursalId,
    lineaId:String(row['id']),motivo:this.motivo().trim()})));
  if(!r)return;
  if(!r.ok){if(r.reason==='error'){this.unmatchError.set(gcErrorMessage(r.error));this.intents.release(sucursalId,'FIN_STATEMENT_UNMATCH')}return}
  this.closeUnmatch();this.notices.show('Línea desconciliada.','success');await this.load();
 }
}
