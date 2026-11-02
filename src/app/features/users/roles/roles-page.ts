
import {Component,OnInit,inject,computed,signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcDataTable,type GcTableColumn,type GcTableRow} from '../../../design-system/data/gc-data-table';
import {GcTableCellDirective} from '../../../design-system/data/gc-table-cell.directive';
import {GcStatusBadge} from '../../../design-system/components/status-badge/gc-status-badge';
import {GcPagination,type GcPageChange} from '../../../design-system/data/gc-pagination';
import {GcTableToolbar} from '../../../design-system/data/gc-table-toolbar';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {RolesApi} from '../data-access/users.api';
import {UsersAccess} from '../data-access/users-access';
import {GcUsersNav} from '../users-nav';
import type {Role,Page} from '../data-access/users.models';
@Component({
 selector:'gc-roles-page',
 imports:[RouterLink,GcPageHeader,GcButtonDirective,GcUsersNav,GcDataTable,
  GcTableCellDirective,GcStatusBadge,GcPagination,GcTableToolbar,GcErrorState],
 template:`
 <div class="gc-u-page">
  <gc-page-header title="Roles y permisos">
   @if(access.canGlobal('roles.manage')){<a gcButton gcPageActions routerLink="/users/roles/new">Nuevo rol</a>}
  </gc-page-header>
  <gc-users-nav/>
  <section class="gc-u-card gc-u-page">
   <form class="gc-u-toolbar" (submit)="searchNow($event)">
    <gc-table-toolbar searchLabel="Buscar roles" [query]="search()" (queryChange)="search.set($event)"/>
    <button type="submit" gcButton variant="outline">Buscar</button>
   </form>
   @if(page.status()==='error'){<gc-error-state [message]="gcError()" (retry)="reload()"/>}
   @else{
    <gc-data-table [columns]="columns" [rows]="rows()" [loading]="page.busy()">
     <ng-template gcTableCell="estado" let-row><gc-status-badge
       [label]="row['estado']?'Activo':'Inactivo'" [tone]="row['estado']?'success':'neutral'"/></ng-template>
     <ng-template gcTableCell="acciones" let-row>
      <a [routerLink]="['/users/roles',row['id']]" class="gc-u-table-action">Ver detalle</a>
     </ng-template>
    </gc-data-table>
    <gc-pagination [index]="index()" [size]="size()" [total]="page.data()?.meta?.total??0"
      (pageChange)="changePage($event)"/>
   }
  </section>
 </div>`,
 styleUrl:'../users.scss'
})
export class GcRolesPage implements OnInit{
 protected readonly access=inject(UsersAccess);
 private readonly api=inject(RolesApi);
 protected readonly page=new GcPageState<Page<Role>>();
 protected readonly search=signal('');protected readonly index=signal(0);protected readonly size=signal(10);
 protected readonly columns:GcTableColumn[]=[
  {key:'codigo',label:'Código'},{key:'nombre',label:'Rol'},
  {key:'alcance',label:'Alcance'},{key:'usuarios',label:'Asignados'},
  {key:'estado',label:'Estado'},{key:'acciones',label:'Acciones'}];
 protected readonly rows=computed<GcTableRow[]>(()=>this.page.data()?.data.map(r=>({
  id:r.id,codigo:r.codigo,nombre:r.nombre,
  alcance:r.alcance==='GLOBAL'?'Global':'Por sucursal',
  usuarios:r.usuariosAsignados,estado:r.activo,acciones:r.id
 }))??[]);
 async ngOnInit(){try{if(!this.access.loaded())await this.access.load()}catch{/* access restricted */}
  if(this.access.canGlobal('roles.read'))await this.load()}
 protected gcError(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load()}
 protected searchNow(e?:Event){e?.preventDefault();this.index.set(0);void this.load()}
 protected changePage(c:GcPageChange){this.index.set(c.index);this.size.set(c.size);void this.load()}
 private async load(){await this.page.load(()=>firstValueFrom(this.api.list({
  page:this.index()+1,limit:this.size(),search:this.search().trim()})))}
}
