
import {Component,computed,effect,inject,signal} from '@angular/core';
import {Router} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcDataTable,type GcTableRow,type GcTableColumn} from '../../../design-system/data/gc-data-table';
import {GcTableCellDirective} from '../../../design-system/data/gc-table-cell.directive';
import {GcPagination,type GcPageChange} from '../../../design-system/data/gc-pagination';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {formatCurrency,formatInstant} from '../../../shared/formatting';
import {GcFinanceNav} from '../finance-nav';
import {FinanceUrlState} from '../data-access/finance-url-state';
import {FinanceApi} from '../data-access/finance.api';
import {FinanceAccess} from '../data-access/finance-access';
import type {FinanceExpenseOrigin,FinanceExpenseState} from '../data-access/finance.models';

const ORIGEN_CHOICES=[{id:'CAJA',label:'Desde caja'},{id:'CUENTA_FINANCIERA',label:'Desde cuenta financiera'}];
const ESTADO_CHOICES=[{id:'REGISTRADO',label:'Registrado'},{id:'REVERSADO',label:'Reversado'}];

@Component({
 selector:'gc-finance-expenses-page',
 providers:[FinanceUrlState],
 imports:[GcPageHeader,GcButtonDirective,GcDataTable,GcTableCellDirective,
  GcPagination,GcErrorState,GcFinanceNav,GcSearchSelect],
 template:`
 <div class="fin-page">
  <gc-page-header title="Gastos operativos"
   description="Gastos pagados desde una caja abierta o cargados directamente a una cuenta financiera."/>
  <gc-finance-nav/>
  <section class="fin-card">
   <div class="fin-toolbar gc-filter-grid">
    <gc-search-select id="expense-branch" label="Sucursal" [items]="branchChoices()"
     [value]="url.filters().sucursalId" [clearable]="false" (valueChange)="changeBranch($event)"/>
    <gc-search-select id="expense-origen" label="Origen" [items]="origenChoices" [searchable]="false"
     [value]="origen()" placeholder="Todos" (valueChange)="setFilter('origen',$event)"/>
    <gc-search-select id="expense-estado" label="Estado" [items]="estadoChoices" [searchable]="false"
     [value]="estado()" placeholder="Todos" (valueChange)="setFilter('estado',$event)"/>
    <form class="fin-toolbar" (submit)="applySearch($event)">
     <div class="fin-field"><label for="expense-category">Categoría</label>
      <input id="expense-category" [value]="categoria()" (input)="categoria.set($any($event.target).value)"
       maxlength="100" placeholder="Ej. Limpieza"/>
     </div>
     <div class="fin-field"><label for="expense-desde">Desde</label>
      <input id="expense-desde" type="date" [value]="desde()" (input)="desde.set($any($event.target).value)"/>
     </div>
     <div class="fin-field"><label for="expense-hasta">Hasta</label>
      <input id="expense-hasta" type="date" [value]="hasta()" (input)="hasta.set($any($event.target).value)"/>
     </div>
     <button gcButton variant="outline" type="submit">Buscar</button>
    </form>
    @if(canCreate()){
     <button gcButton type="button" (click)="create()">Nuevo gasto</button>
    }
   </div>
   @if(page.status()==='error'){<gc-error-state [message]="errorMessage()" (retry)="reload()"/>}
   @else{
    <gc-data-table [columns]="columns" [rows]="page.data()?.rows??[]" [loading]="page.busy()">
     <ng-template gcTableCell="actions" let-row>
      <button type="button" gcButton variant="outline" (click)="open(row['id'])">Ver detalle</button>
     </ng-template>
    </gc-data-table>
    <gc-pagination [index]="url.filters().page-1" [size]="url.filters().limit"
     [total]="page.data()?.total??0" (pageChange)="onPage($event)"/>
   }
  </section>
 </div>`,
 styleUrl:'../finance.scss'
})
export class GcFinanceExpensesPage {
 protected readonly url=inject(FinanceUrlState);
 protected readonly branch=inject(GcBranchContext);
 protected readonly branchChoices=computed(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly origenChoices=ORIGEN_CHOICES;
 protected readonly estadoChoices=ESTADO_CHOICES;
 private readonly api=inject(FinanceApi);
 private readonly access=inject(FinanceAccess);
 private readonly router=inject(Router);
 protected readonly page=new GcPageState<{rows:GcTableRow[];total:number}>();
 protected readonly origen=computed(()=>this.url.params().get('origen')??'');
 protected readonly estado=computed(()=>this.url.params().get('estado')??'');
 protected readonly categoria=signal('');
 protected readonly desde=signal('');
 protected readonly hasta=signal('');
 protected readonly columns:GcTableColumn[]=[
  {key:'fecha',label:'Fecha'},{key:'origen',label:'Origen'},{key:'categoria',label:'Categoría'},
  {key:'descripcion',label:'Descripción'},{key:'monto',label:'Monto',numeric:true},
  {key:'estado',label:'Estado'},{key:'actions',label:'Acciones'}];
 constructor(){
  effect(()=>{
   const f=this.url.filters(),p=this.url.params();
   this.categoria.set(p.get('categoria')??'');this.desde.set(p.get('desde')??'');this.hasta.set(p.get('hasta')??'');
   if(f.sucursalId)void this.load();
  });
 }
 protected canCreate(){return this.access.canExpensesCreate()}
 protected errorMessage(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load()}
 protected async changeBranch(id:string){await this.url.patch({sucursalId:id,page:1})}
 protected async setFilter(key:string,value:string){await this.url.patch({[key]:value||null,page:1})}
 protected applySearch(e:Event){
  e.preventDefault();
  void this.url.patch({categoria:this.categoria().trim()||null,desde:this.desde()||null,hasta:this.hasta()||null,page:1});
 }
 protected async onPage(e:GcPageChange){await this.url.patch({page:e.index+1,limit:e.size})}
 protected create(){void this.router.navigate(['/finance/expenses/new'],
  {queryParams:{sucursalId:this.url.filters().sucursalId}})}
 protected open(id:GcTableRow[string]){void this.router.navigate(['/finance/expenses',String(id)])}
 private async load(){
  const f=this.url.filters(),p=this.url.params();
  const origen=(p.get('origen')||undefined) as FinanceExpenseOrigin|undefined;
  const estado=(p.get('estado')||undefined) as FinanceExpenseState|undefined;
  const categoria=p.get('categoria')||undefined,desde=p.get('desde')||undefined,hasta=p.get('hasta')||undefined;
  const zone=this.branch.branches().find(b=>b.id===f.sucursalId)?.zonaHoraria??'America/Guatemala';
  await this.page.load(async()=>{
   const r=await firstValueFrom(this.api.expenses({sucursalId:f.sucursalId,page:f.page,limit:f.limit,
    origen,estado,categoria,desde,hasta}));
   return {total:r.meta.total,rows:r.data.map(x=>({id:x.id,fecha:formatInstant(x.registradoEn,zone),
    origen:x.cuentaFinancieraId?'Cuenta financiera':'Caja',
    categoria:x.categoria??'—',descripcion:x.descripcion,monto:formatCurrency(x.monto),
    estado:x.estadoFinanciero==='REVERSADO'?'Reversado':'Registrado',actions:x.id}))};
  });
 }
}
