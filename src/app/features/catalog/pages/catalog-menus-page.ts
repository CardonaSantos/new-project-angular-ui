import {Component,computed,effect,inject,signal} from '@angular/core';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {toSignal} from '@angular/core/rxjs-interop';
import {firstValueFrom} from 'rxjs';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcCatalogNav} from '../catalog-nav';
import {CatalogApi} from '../data-access/catalog.api';
import {CatalogAccess} from '../data-access/catalog-access';
import {menuStatus} from '../data-access/catalog-menu-editor';
import type {CatalogMenu,CatalogPage} from '../data-access/catalog.models';

@Component({
 selector:'gc-catalog-menus-page',
 imports:[RouterLink,GcCatalogNav,GcErrorState],
 template:`
 <main class="cat-page">
  <gc-catalog-nav/>
  <section class="cat-card">
   <div class="cat-row">
    <h2>Menús comerciales</h2>
    @if(access.canMenus()){<a class="cat-primary" routerLink="/catalog/menus/new">Nuevo menú</a>}
   </div>
   <p class="cat-muted">Organiza las cartas de tus sucursales, con sus productos, secciones y horarios.</p>
   <div class="cat-toolbar">
    <label class="cat-field">Buscar menú
     <input [value]="search()" maxlength="120" placeholder="Nombre o código"
      (input)="search.set($any($event.target).value)" (keyup.enter)="apply()"/>
    </label>
    <button type="button" (click)="apply()">Buscar</button>
    <label class="cat-field">Sucursal
     <select [value]="branchId()" (change)="patch({sucursalId:$any($event.target).value||null,page:null})">
      <option value="">Todas las autorizadas</option>
      @for(branch of context.branches();track branch.id){
       <option [value]="branch.id">{{branch.nombre}}</option>
      }
     </select>
    </label>
    <label class="cat-field">Estado
     <select [value]="state()" (change)="patch({activo:$any($event.target).value||null,page:null})">
      <option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option>
     </select>
    </label>
   </div>
   @if(page.busy()){<p role="status" class="cat-muted">Consultando menús…</p>}
   @if(page.status()==='error'){<gc-error-state [message]="error()" (retry)="reload()"/>}
   @if(page.data();as result){
    <div class="cat-table-wrap"><table class="cat-table">
     <thead><tr><th>Menú</th><th>Sucursales</th><th>Secciones</th><th>Estado</th><th>Acción</th></tr></thead>
     <tbody>
      @for(menu of result.data;track menu.id){
       <tr><td><strong>{{menu.nombre}}</strong><div class="cat-muted">{{menu.codigo}}</div></td>
        <td>{{menu.sucursales.length}}</td><td>{{menu.secciones.length}}</td>
        <td>{{status(menu)}}</td>
        <td><a [routerLink]="['/catalog/menus',menu.id]">Configurar</a></td>
       </tr>
      } @empty {<tr><td colspan="5">No hay menús con los filtros seleccionados.</td></tr>}
     </tbody>
    </table></div>
    <div class="cat-row cat-muted">
     <span>{{result.meta.total}} menús · Página {{result.meta.page}} de {{result.meta.totalPages||1}}</span>
     <div class="cat-actions">
      <button type="button" [disabled]="numberPage()<=1" (click)="move(-1)">Anterior</button>
      <button type="button" [disabled]="numberPage()>=result.meta.totalPages" (click)="move(1)">Siguiente</button>
     </div>
    </div>
   }
  </section>
 </main>`,
 styleUrl:'../catalog.scss'
})
export class GcCatalogMenusPage {
 protected readonly access=inject(CatalogAccess);
 protected readonly context=inject(GcBranchContext);
 private readonly api=inject(CatalogApi);
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly query=toSignal(this.route.queryParamMap,{initialValue:this.route.snapshot.queryParamMap});
 protected readonly page=new GcPageState<CatalogPage<CatalogMenu>>();
 protected readonly search=signal('');
 protected readonly numberPage=computed(()=>Math.max(1,Number(this.query().get('page')??'1')||1));
 protected readonly branchId=computed(()=>this.query().get('sucursalId')??'');
 protected readonly state=computed(()=>this.query().get('activo')??'');
 protected readonly status=menuStatus;
 constructor(){effect(()=>{
  const q=this.query(),page=this.numberPage(),sucursalId=this.branchId(),activo=this.state();
  const search=q.get('search')??'';this.search.set(search);
  if(this.access.canRead())void this.page.load(()=>firstValueFrom(this.api.menus({
   page,limit:20,search,sucursalId:sucursalId||undefined,
   activo:activo===''?undefined:activo==='true'
  })));
 })}
 protected error(){return gcErrorMessage(this.page.error())}
 protected reload(){const q=this.query();void this.page.load(()=>firstValueFrom(this.api.menus({
  page:this.numberPage(),limit:20,search:q.get('search')??'',sucursalId:this.branchId()||undefined,
  activo:this.state()===''?undefined:this.state()==='true'
 })))}
 protected apply(){this.patch({search:this.search().trim()||null,page:null})}
 protected move(step:number){this.patch({page:String(Math.max(1,this.numberPage()+step))})}
 protected patch(values:Record<string,string|null>){void this.router.navigate([],{
  relativeTo:this.route,queryParams:values,queryParamsHandling:'merge'
 })}
}
