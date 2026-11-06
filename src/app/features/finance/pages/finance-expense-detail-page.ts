
import {Component,computed,inject,OnInit,signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {formatCurrency,formatInstant} from '../../../shared/formatting';
import {GcFinanceNav} from '../finance-nav';
import {FinanceApi} from '../data-access/finance.api';
import type {FinanceExpenseDetail} from '../data-access/finance.models';

const ORIGEN_LABEL:Record<string,string>={CAJA:'Caja',CUENTA_FINANCIERA:'Cuenta financiera'};

@Component({
 selector:'gc-finance-expense-detail-page',
 imports:[GcPageHeader,GcErrorState,GcFinanceNav],
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
   }
  }
 </div>`,
 styleUrl:'../finance.scss'
})
export class GcFinanceExpenseDetailPage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 private readonly branch=inject(GcBranchContext);
 private readonly api=inject(FinanceApi);
 protected readonly expense=signal<FinanceExpenseDetail|null>(null);
 protected readonly loadError=signal<string|null>(null);
 protected readonly formatInstant=formatInstant;
 protected readonly zone=computed(()=>
  this.branch.branches().find(b=>b.id===this.expense()?.sucursalId)?.zonaHoraria??'America/Guatemala');
 protected readonly fecha=computed(()=>{const e=this.expense();return e?formatInstant(e.registradoEn,this.zone()):''});
 protected readonly monto=computed(()=>{const e=this.expense();return e?formatCurrency(e.monto):''});
 protected readonly origen=computed(()=>{const e=this.expense();
  return e?ORIGEN_LABEL[e.cuentaFinancieraId?'CUENTA_FINANCIERA':'CAJA']:''});
 private get id(){return this.route.snapshot.paramMap.get('id')??''}
 async ngOnInit(){await this.load()}
 protected async load(){
  this.loadError.set(null);
  try{this.expense.set(await firstValueFrom(this.api.expense(this.id)))}
  catch(e){this.loadError.set(gcErrorMessage(e))}
 }
}
