
import {Component,inject,OnInit,computed,signal} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcPagination,type GcPageChange} from '../../../design-system/data/gc-pagination';
import {GcDataTable,type GcTableColumn,type GcTableRow} from '../../../design-system/data/gc-data-table';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {formatDecimal} from '../../../shared/formatting';
import {UsersApi} from '../data-access/users.api';
import type {Page,StaffReportRow} from '../data-access/users.models';
import {GcUsersNav} from '../users-nav';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
@Component({
 selector:'gc-staff-report-page',
 imports:[GcUsersNav,GcPageHeader,GcButtonDirective,GcPagination,GcDataTable,GcErrorState,GcSearchSelect],
 template:`
 <div class="gc-u-page">
  <gc-page-header title="Resumen de personal"/><gc-users-nav/>
  <section class="gc-u-card gc-u-page">
   <form class="gc-u-toolbar gc-filter-grid" (submit)="searchNow($event)">
    <div class="gc-u-field"><label for="report-from">Desde</label>
     <input id="report-from" type="date" [value]="from()" (change)="from.set($any($event.target).value)"/></div>
    <div class="gc-u-field"><label for="report-to">Hasta (sin incluir)</label>
     <input id="report-to" type="date" [value]="to()" (change)="to.set($any($event.target).value)"/></div>
    <gc-search-select id="report-branch" label="Sucursal" [items]="branchChoices()"
     [value]="branchId()" placeholder="Todas" (valueChange)="branchId.set($event)"/>
    <button type="submit" gcButton variant="outline">Aplicar</button>
   </form>
   @if(page.status()==='error'){<gc-error-state [message]="readError()" (retry)="reload()"/>}
   @else{
    <gc-data-table [rows]="rows()" [columns]="columns" [loading]="page.busy()"/>
    <gc-pagination [index]="index()" [size]="size()" [total]="page.data()?.meta?.total??0"
       (pageChange)="changePage($event)"/>
   }
  </section>
 </div>`,
 styleUrl:'../users.scss'
})
export class GcStaffReportPage implements OnInit {
 private readonly api=inject(UsersApi);
 protected readonly branch=inject(GcBranchContext);
 protected readonly branchChoices=computed(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly page=new GcPageState<Page<StaffReportRow>>();
 protected readonly from=signal('');protected readonly to=signal('');
 protected readonly branchId=signal('');protected readonly index=signal(0);protected readonly size=signal(10);
 protected readonly columns:GcTableColumn[]=[
  {key:'nombre',label:'Usuario'},{key:'ordenes',label:'Órdenes registradas'},
  {key:'cobros',label:'Cobros realizados'},{key:'importe',label:'Importe cobrado'}];
 protected readonly rows=computed<GcTableRow[]>(()=>this.page.data()?.data.map(r=>({
  nombre:r.nombre,ordenes:r.ordenes,cobros:r.cobros,importe:formatDecimal(r.importeCobrado,{minimumFractionDigits:2,maximumFractionDigits:2})
 }))??[]);
 ngOnInit(){void this.load()}
 protected readError(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load()}
 protected searchNow(e?:Event){e?.preventDefault();this.index.set(0);void this.load()}
 protected changePage(c:GcPageChange){this.index.set(c.index);this.size.set(c.size);void this.load()}
 private async load(){await this.page.load(()=>firstValueFrom(this.api.report({
  from:this.from()||undefined,to:this.to()||undefined,
  sucursalId:this.branchId()||undefined,page:this.index()+1,limit:this.size()
 })))}
}
