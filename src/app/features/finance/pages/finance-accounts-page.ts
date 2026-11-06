
import {Component,computed,effect,inject} from '@angular/core';
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
import {formatCurrency} from '../../../shared/formatting';
import {GcFinanceNav} from '../finance-nav';
import {FinanceUrlState} from '../data-access/finance-url-state';
import {FinanceApi} from '../data-access/finance.api';
import {FinanceAccess} from '../data-access/finance-access';

@Component({
 selector:'gc-finance-accounts-page',
 providers:[FinanceUrlState],
 imports:[GcPageHeader,GcButtonDirective,GcDataTable,GcTableCellDirective,
  GcPagination,GcErrorState,GcFinanceNav,GcSearchSelect],
 template:`
 <div class="fin-page">
  <gc-page-header title="Cuentas financieras"
   description="Bancos, tarjetas de empresa y cuentas de efectivo externo. Cada movimiento se audita por separado."/>
  <gc-finance-nav/>
  <section class="fin-card">
   <div class="fin-toolbar">
    <gc-search-select id="account-branch" label="Sucursal" [items]="branchChoices()"
     [value]="url.filters().sucursalId" [clearable]="false" (valueChange)="changeBranch($event)"/>
    @if(canManage()){
     <button gcButton type="button" (click)="create()">Nueva cuenta</button>
    }
   </div>
   @if(page.status()==='error'){<gc-error-state [message]="errorMessage()" (retry)="reload()"/>}
   @else{
    <gc-data-table [columns]="columns" [rows]="page.data()?.rows??[]" [loading]="page.busy()">
     <ng-template gcTableCell="actions" let-row>
      <button type="button" gcButton variant="outline" (click)="open(row['id'])">Ver movimientos</button>
     </ng-template>
    </gc-data-table>
    <gc-pagination [index]="url.filters().page-1" [size]="url.filters().limit"
     [total]="page.data()?.total??0" (pageChange)="onPage($event)"/>
   }
  </section>
 </div>`,
 styleUrl:'../finance.scss'
})
export class GcFinanceAccountsPage {
 protected readonly url=inject(FinanceUrlState);
 protected readonly branch=inject(GcBranchContext);
 protected readonly branchChoices=computed(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 private readonly api=inject(FinanceApi);
 private readonly access=inject(FinanceAccess);
 private readonly router=inject(Router);
 protected readonly page=new GcPageState<{rows:GcTableRow[];total:number}>();
 protected readonly columns:GcTableColumn[]=[
  {key:'nombre',label:'Cuenta'},{key:'tipo',label:'Tipo'},
  {key:'saldo',label:'Saldo registrado',numeric:true},{key:'estado',label:'Estado'},
  {key:'actions',label:'Acciones'}];
 constructor(){
  effect(()=>{const f=this.url.filters();if(f.sucursalId)void this.load()});
 }
 protected canManage(){return this.access.canAccountsManage()}
 protected errorMessage(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load()}
 protected async changeBranch(id:string){await this.url.patch({sucursalId:id,page:1})}
 protected async onPage(e:GcPageChange){await this.url.patch({page:e.index+1,limit:e.size})}
 protected create(){void this.router.navigate(['/finance/accounts/new'],
  {queryParams:{sucursalId:this.url.filters().sucursalId}})}
 protected open(id:GcTableRow[string]){void this.router.navigate(['/finance/accounts',String(id)])}
 private async load(){
  const f=this.url.filters();
  await this.page.load(async()=>{
   const r=await firstValueFrom(this.api.accounts({sucursalId:f.sucursalId,page:f.page,limit:f.limit}));
   return {total:r.meta.total,rows:r.data.map(x=>({id:x.id,nombre:x.nombre,
    tipo:TIPO_LABEL[x.tipo]??x.tipo,saldo:formatCurrency(x.saldoRegistrado,x.moneda==='USD'?'USD':'GTQ'),
    estado:x.activa?'Activa':'Inactiva',actions:x.id}))};
  });
 }
}
const TIPO_LABEL:Record<string,string>={BANCO:'Banco',TARJETA_EMPRESA:'Tarjeta de empresa',EFECTIVO_EXTERNO:'Efectivo externo'};
