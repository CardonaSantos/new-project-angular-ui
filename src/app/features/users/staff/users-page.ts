
import {Component,computed,inject,OnInit,signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcDataTable,type GcTableColumn,type GcTableRow} from '../../../design-system/data/gc-data-table';
import {GcTableCellDirective} from '../../../design-system/data/gc-table-cell.directive';
import {GcTableToolbar} from '../../../design-system/data/gc-table-toolbar';
import {GcFilterBar} from '../../../design-system/data/gc-filter-bar';
import {GcPagination,type GcPageChange} from '../../../design-system/data/gc-pagination';
import {GcStatusBadge} from '../../../design-system/components/status-badge/gc-status-badge';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {UsersApi} from '../data-access/users.api';
import {UsersAccess} from '../data-access/users-access';
import type {Page,UserRecord} from '../data-access/users.models';
import {GcUsersNav} from '../users-nav';
import {GcUserAvatar} from '../../../design-system/profile/gc-user-avatar';
@Component({
 selector:'gc-users-page',
 imports:[RouterLink,GcPageHeader,GcButtonDirective,GcUsersNav,GcDataTable,GcTableCellDirective,
  GcTableToolbar,GcFilterBar,GcPagination,GcStatusBadge,GcErrorState,GcUserAvatar],
 template:`
 <div class="gc-u-page">
  <gc-page-header title="Usuarios">
   @if(access.canGlobal('users.create')){<a gcButton gcPageActions routerLink="/users/staff/new">Nuevo usuario</a>}
  </gc-page-header>
  <gc-users-nav/>
  <section class="gc-u-card gc-u-page">
   <form class="gc-u-toolbar" (submit)="searchNow($event)">
    <gc-table-toolbar [query]="query()" searchLabel="Buscar usuarios" (queryChange)="query.set($event)"/>
    <gc-filter-bar filterId="user-active" label="Estado" [options]="statuses" [value]="state()"
      (valueChange)="state.set($event);searchNow()"/>
    <div class="gc-u-field">
     <label for="user-branch">Sucursal</label>
     <select id="user-branch" [value]="branchId()" (change)="branchId.set($any($event.target).value);searchNow()">
      @if(access.canGlobal('users.read')){<option value="">Todas</option>}
      @for(item of branch.branches();track item.id){<option [value]="item.id">{{item.nombre}}</option>}
     </select>
    </div>
    <button gcButton variant="outline" type="submit">Buscar</button>
   </form>
   @if(!access.canRead()){<p role="alert">No tienes acceso a usuarios.</p>}
   @else if(page.status()==='error'){<gc-error-state [message]="readError()" (retry)="reload()"/>}
   @else{
    <gc-data-table [rows]="rows()" [columns]="columns" [loading]="page.busy()">
     <ng-template gcTableCell="nombre" let-row>
      <div class="gc-u-avatar-row gc-u-avatar-cell">
       <gc-user-avatar [url]="avatarUrl(row['avatarUrl'])" [name]="avatarName(row['nombre'])"/>
       <span>{{row['nombre']}}</span>
      </div>
     </ng-template>
     <ng-template gcTableCell="estado" let-row><gc-status-badge
       [label]="row['estado'] ? 'Activo':'Inactivo'" [tone]="row['estado'] ? 'success':'neutral'"/></ng-template>
     <ng-template gcTableCell="accion" let-row>
      <a class="gc-u-table-action" [routerLink]="['/users/staff',row['id']]"
         [attr.aria-label]="'Ver usuario '+row['nombre']">Ver detalle</a>
     </ng-template>
    </gc-data-table>
    <gc-pagination [index]="index()" [size]="size()" [total]="page.data()?.meta?.total??0"
      (pageChange)="changePage($event)"/>
   }
  </section>
 </div>`,
 styleUrl:'../users.scss'
})
export class GcUsersPage implements OnInit {
 protected readonly access=inject(UsersAccess);
 protected readonly branch=inject(GcBranchContext);
 private readonly api=inject(UsersApi);
 protected readonly page=new GcPageState<Page<UserRecord>>();
 protected readonly query=signal('');
 protected readonly state=signal('all');
 protected readonly branchId=signal('');
 protected readonly index=signal(0);
 protected readonly size=signal(10);
 protected readonly statuses=[{value:'all',label:'Todos'},{value:'true',label:'Activos'},{value:'false',label:'Inactivos'}];
 protected readonly columns:GcTableColumn[]=[
  {key:'nombre',label:'Nombre'},{key:'email',label:'Correo'},
  {key:'roles',label:'Roles'},{key:'estado',label:'Estado'},{key:'accion',label:'Acciones'}
 ];
 protected readonly rows=computed<GcTableRow[]>(()=>this.page.data()?.data.map(u=>({
  id:u.id,nombre:u.profile.nombreCompleto,email:u.profile.email,
  avatarUrl:u.profile.avatar.url,
  roles:u.access.assignments.map(a=>a.rolNombre).filter(Boolean).join(', ')||'—',
  estado:u.account.activo,accion:u.id,
 }))??[]);
 async ngOnInit(){
  try{if(!this.access.loaded())await this.access.load()}catch{/* handled by page */}
  if(!this.access.canGlobal('users.read'))this.branchId.set(this.branch.branchId()??'');
  await this.load();
 }
 protected avatarUrl(value:GcTableRow[string]):string|null {
  return typeof value==='string'?value:null;
 }
 protected avatarName(value:GcTableRow[string]):string {
  return typeof value==='string'?value:'';
 }
 protected readError(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load()}
 protected searchNow(event?:Event){event?.preventDefault();this.index.set(0);void this.load()}
 protected changePage(change:GcPageChange){this.index.set(change.index);this.size.set(change.size);void this.load()}
 private async load(){
  if(!this.access.canRead())return;
  const sucursalId=this.branchId() || (this.access.canGlobal('users.read')?undefined:this.branch.branchId()??undefined);
  await this.page.load(()=>firstValueFrom(this.api.list({
   page:this.index()+1,limit:this.size(),search:this.query().trim(),
   activo:this.state()==='all'?undefined:this.state()==='true',sucursalId,
  })));
 }
}
