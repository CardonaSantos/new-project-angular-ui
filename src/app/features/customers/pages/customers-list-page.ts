
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
import {formatInstant} from '../../../shared/formatting';
import {CustomersUrlState} from '../data-access/customers-url-state';
import {CustomersApi} from '../data-access/customers.api';
import {CustomersAccess} from '../data-access/customers-access';

const ACTIVO_CHOICES=[{id:'true',label:'Activos'},{id:'false',label:'Inactivos'}];

@Component({
 selector:'gc-customers-list-page',
 providers:[CustomersUrlState],
 imports:[GcPageHeader,GcButtonDirective,GcDataTable,GcTableCellDirective,
  GcPagination,GcErrorState,GcSearchSelect],
 template:`
 <div class="cus-page">
  <gc-page-header title="Clientes"
   description="Clientes registrados en esta sucursal (o compartidos entre sucursales con permiso global)."/>
  <section class="cus-card">
   <div class="cus-toolbar gc-filter-grid">
    <gc-search-select id="cus-branch" label="Sucursal" [items]="branchChoices()"
     [value]="url.filters().sucursalId" [clearable]="false" (valueChange)="changeBranch($event)"/>
    <gc-search-select id="cus-activo" label="Estado" [items]="activoChoices" [searchable]="false"
     [value]="url.filters().activo" placeholder="Todos" (valueChange)="changeActivo($event)"/>
    <form class="cus-toolbar" (submit)="applySearch($event)">
     <div class="cus-field"><label for="cus-search">Buscar</label>
      <input id="cus-search" [value]="search()" (input)="search.set($any($event.target).value)"
       maxlength="100" placeholder="Nombre, teléfono o NIT"/>
     </div>
     <button gcButton variant="outline" type="submit">Buscar</button>
    </form>
    @if(canCreate()){<button gcButton type="button" (click)="create()">Nuevo cliente</button>}
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
 styleUrl:'../customers.scss'
})
export class GcCustomersListPage {
 protected readonly url=inject(CustomersUrlState);
 protected readonly branch=inject(GcBranchContext);
 protected readonly branchChoices=computed(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly activoChoices=ACTIVO_CHOICES;
 private readonly api=inject(CustomersApi);
 private readonly access=inject(CustomersAccess);
 private readonly router=inject(Router);
 protected readonly page=new GcPageState<{rows:GcTableRow[];total:number}>();
 protected readonly search=signal('');
 protected readonly columns:GcTableColumn[]=[
  {key:'nombre',label:'Nombre'},{key:'telefono',label:'Teléfono'},{key:'email',label:'Email'},
  {key:'nit',label:'NIT'},{key:'estado',label:'Estado'},{key:'creadoEn',label:'Registrado'},
  {key:'actions',label:'Acciones'}];
 constructor(){
  effect(()=>{
   const f=this.url.filters();this.search.set(f.search);
   if(f.sucursalId)void this.load();
  });
 }
 protected canCreate(){return this.access.canCreate()}
 protected errorMessage(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load()}
 protected async changeBranch(id:string){await this.url.patch({sucursalId:id,page:1})}
 protected async changeActivo(id:string){await this.url.patch({activo:id||null,page:1})}
 protected applySearch(e:Event){e.preventDefault();void this.url.patch({search:this.search().trim()||null,page:1})}
 protected async onPage(e:GcPageChange){await this.url.patch({page:e.index+1,limit:e.size})}
 protected create(){void this.router.navigate(['/customers/new'],{queryParams:{sucursalId:this.url.filters().sucursalId}})}
 protected open(id:GcTableRow[string]){void this.router.navigate(['/customers',String(id)])}
 private async load(){
  const f=this.url.filters();
  const activo=f.activo===''?undefined:f.activo==='true';
  const zone=this.branch.branches().find(b=>b.id===f.sucursalId)?.zonaHoraria??'America/Guatemala';
  await this.page.load(async()=>{
   const r=await firstValueFrom(this.api.list({sucursalId:f.sucursalId,page:f.page,limit:f.limit,
    search:f.search||undefined,activo}));
   return {total:r.meta.total,rows:r.data.map(x=>({id:x.id,nombre:x.nombre,
    telefono:x.telefono??'—',email:x.email??'—',nit:x.nit??'—',
    estado:x.activo?'Activo':'Inactivo',creadoEn:formatInstant(x.creadoEn,zone,'DD/MM/YYYY'),
    actions:x.id}))};
  });
 }
}
