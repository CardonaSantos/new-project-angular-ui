
import {Component,computed,inject,OnInit,signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
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
import type {FinanceExpenseDetail} from '../data-access/finance.models';

const ORIGEN_LABEL:Record<string,string>={CAJA:'Caja',CUENTA_FINANCIERA:'Cuenta financiera'};

@Component({
 selector:'gc-finance-expense-detail-page',
 imports:[GcPageHeader,GcButtonDirective,GcErrorState,GcFinanceNav],
 template:`
 <div class="fin-page fin-narrow">
  <gc-page-header title="Gasto operativo"/>
  <gc-finance-nav/>
  @if(loadError()){<gc-error-state [message]="loadError()!" (retry)="load()"/>}
  @else if(expense();as e){
   <section class="fin-card">
    <dl class="fin-kv">
     <div><dt>Fecha</dt><dd>{{fecha()}}</dd></div>
     <div><dt>Monto</dt><dd>{{monto()}}</dd></div>
     <div><dt>Origen</dt><dd>{{origen()}}</dd></div>
     <div><dt>Categoría</dt><dd>{{e.categoria??'—'}}</dd></div>
     <div><dt>Documento de referencia</dt><dd>{{e.documentoReferencia??'—'}}</dd></div>
     <div><dt>Estado</dt>
      <dd><span class="fin-state-badge" [class.fin-state-badge--reversed]="e.estadoFinanciero==='REVERSADO'">
       {{e.estadoFinanciero==='REVERSADO'?'Reversado':'Registrado'}}</span></dd></div>
    </dl>
    <p class="fin-muted">{{e.descripcion}}</p>
   </section>
   @if(e.reversa){
    <section class="fin-card">
     <h2>Reversa</h2>
     <dl class="fin-kv">
      <div><dt>Motivo</dt><dd>{{e.reversa.motivo}}</dd></div>
      <div><dt>Fecha</dt><dd>{{formatInstant(e.reversa.creadaEn,zone())}}</dd></div>
     </dl>
    </section>
   }@else if(e.movimientoFinanciero&&canReverse()){
    <section class="fin-card fin-narrow">
     @if(!reversing()){
      <button type="button" gcButton variant="outline" (click)="openReverse()">Reversar gasto</button>
     }@else{
      <h2>Reversar gasto</h2>
      <p class="fin-muted">Crea un asiento de corrección por el mismo importe en sentido contrario. No puede deshacerse.</p>
      <div class="fin-field"><label for="reverse-motivo">Motivo (mínimo 10 caracteres)</label>
       <textarea id="reverse-motivo" rows="2" [value]="motivo()"
        (input)="motivo.set($any($event.target).value)" maxlength="500"></textarea>
      </div>
      @if(reverseError()){<p class="fin-alert" role="alert">{{reverseError()}}</p>}
      <div class="fin-actions">
       <button type="button" gcButton [disabled]="motivo().trim().length<10||action.busy()" (click)="submitReverse()">
        {{action.busy()?'Reversando…':'Confirmar reversa'}}</button>
       <button type="button" gcButton variant="outline" (click)="closeReverse()">Cancelar</button>
      </div>
     }
    </section>
   }
  }
 </div>`,
 styleUrl:'../finance.scss'
})
export class GcFinanceExpenseDetailPage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 private readonly branch=inject(GcBranchContext);
 private readonly api=inject(FinanceApi);
 private readonly access=inject(FinanceAccess);
 private readonly intents=inject(FinanceIntentService);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 protected readonly expense=signal<FinanceExpenseDetail|null>(null);
 protected readonly loadError=signal<string|null>(null);
 protected readonly formatInstant=formatInstant;
 protected readonly zone=computed(()=>
  this.branch.branches().find(b=>b.id===this.expense()?.sucursalId)?.zonaHoraria??'America/Guatemala');
 protected readonly fecha=computed(()=>{const e=this.expense();return e?formatInstant(e.registradoEn,this.zone()):''});
 protected readonly monto=computed(()=>{const e=this.expense();return e?formatCurrency(e.monto):''});
 protected readonly origen=computed(()=>{const e=this.expense();
  return e?ORIGEN_LABEL[e.cuentaFinancieraId?'CUENTA_FINANCIERA':'CAJA']:''});
 protected readonly reversing=signal(false);
 protected readonly motivo=signal('');
 protected readonly reverseError=signal<string|null>(null);
 protected readonly action=new GcConfirmedAction();
 private reverseOperationId='';
 private get id(){return this.route.snapshot.paramMap.get('id')??''}
 async ngOnInit(){await this.load()}
 protected async load(){
  this.loadError.set(null);
  try{this.expense.set(await firstValueFrom(this.api.expense(this.id)))}
  catch(e){this.loadError.set(gcErrorMessage(e))}
 }
 protected canReverse(){return this.access.canReversalsCreate()}
 protected async openReverse(){
  const e=this.expense();if(!e)return;
  this.motivo.set('');this.reverseError.set(null);this.reversing.set(true);
  try{this.reverseOperationId=await this.intents.require(e.sucursalId,'FIN_LEDGER_REVERSE')}
  catch(err){this.reverseError.set(gcErrorMessage(err))}
 }
 protected closeReverse(){this.reversing.set(false);this.motivo.set('');this.reverseError.set(null)}
 protected async submitReverse(){
  const e=this.expense();if(!e||!e.movimientoFinanciero||this.motivo().trim().length<10)return;
  this.reverseError.set(null);
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Reversar gasto',message:'Esta acción crea un asiento de corrección y no puede deshacerse. ¿Continuar?',
   confirmText:'Reversar',danger:true},
   ()=>firstValueFrom(this.api.reverseMovement({operationId:this.reverseOperationId,sucursalId:e.sucursalId,
    movimientoId:e.movimientoFinanciero!.id,motivo:this.motivo().trim()})));
  if(!r)return;
  if(!r.ok){
   if(r.reason==='error'){this.reverseError.set(gcErrorMessage(r.error));this.intents.release(e.sucursalId,'FIN_LEDGER_REVERSE')}
   return;
  }
  this.closeReverse();this.notices.show('Gasto reversado.','success');await this.load();
 }
}
