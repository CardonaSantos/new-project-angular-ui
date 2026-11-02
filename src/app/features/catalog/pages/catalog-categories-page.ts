import {Component,computed,effect,inject,signal} from '@angular/core';
import {ActivatedRoute,Router} from '@angular/router';
import {toSignal} from '@angular/core/rxjs-interop';
import {firstValueFrom} from 'rxjs';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {GcCatalogNav} from '../catalog-nav';
import {GcCatalogGallery} from '../components/catalog-gallery';
import {CatalogApi} from '../data-access/catalog.api';
import {CatalogAccess} from '../data-access/catalog-access';
import type {CatalogCategory,CatalogCategoryPatch,CatalogPage} from '../data-access/catalog.models';
import type {GcDirtyAware} from '../../../core/ux/gc-unsaved-changes.guard';

@Component({
 selector:'gc-catalog-categories-page',
 imports:[GcCatalogNav,GcErrorState,GcCatalogGallery],
 template:`
 <main class="cat-page">
  <gc-catalog-nav/>
  <section class="cat-card">
   <div class="cat-row"><h2>Categorías comerciales</h2>
    @if(access.canManage()){
     <button class="cat-primary" type="button" (click)="newCategory()">Nueva categoría</button>
    }
   </div>
   <div class="cat-toolbar">
    <label class="cat-field">Buscar categoría
     <input [value]="search()" maxlength="120" (input)="search.set($any($event.target).value)"
      (keyup.enter)="applySearch()"/>
    </label>
    <button type="button" (click)="applySearch()">Buscar</button>
    <label class="cat-field">Estado
     <select [value]="state()" (change)="changeState($any($event.target).value)">
      <option value="">Todas</option><option value="true">Activas</option><option value="false">Inactivas</option>
     </select>
    </label>
   </div>
   @if(page.busy()){<p role="status" class="cat-muted">Consultando categorías…</p>}
   @if(page.status()==='error'){<gc-error-state [message]="error()" (retry)="reload()"/>}
   @if(page.data();as result){
    <div class="cat-table-wrap"><table class="cat-table">
     <thead><tr><th>Nombre</th><th>Productos</th><th>Estado</th><th>Acción</th></tr></thead>
     <tbody>
      @for(item of result.data;track item.id){
       <tr><td>
        <strong>{{item.nombre}}</strong>
        @if(item.parent?.nombre){<span class="cat-muted"> · En {{item.parent?.nombre}}</span>}
       </td><td>{{item._count?.productosComoCategoria??0}}</td>
       <td>{{item.activa?'Activa':'Inactiva'}}</td>
       <td><button type="button" (click)="select(item)">Detalles</button></td></tr>
      } @empty {<tr><td colspan="4">No hay categorías con estos filtros.</td></tr>}
     </tbody>
    </table></div>
    <div class="cat-row cat-muted"><span>{{result.meta.total}} registros · Página {{result.meta.page}} de {{result.meta.totalPages||1}}</span>
     <div class="cat-actions">
      <button type="button" (click)="changePage(-1)" [disabled]="currentPage()<=1">Anterior</button>
      <button type="button" (click)="changePage(1)" [disabled]="currentPage()>=result.meta.totalPages">Siguiente</button>
     </div>
    </div>
   }
  </section>
  @if((editing()||creating())&&access.canManage()){
   <section class="cat-card">
    <h2>{{creating()?'Nueva categoría':'Editar categoría'}}</h2>
    <form class="cat-form" (submit)="save($event)">
     <label>Nombre
      <input [value]="name()" maxlength="130" required (input)="name.set($any($event.target).value)"/>
     </label>
     <label>Categoría superior
      <select [value]="parent()" (change)="parent.set($any($event.target).value)">
       <option value="">Sin categoría superior</option>
       @for(item of parents();track item.id){
        <option [value]="item.id">{{item.nombre}}</option>
       }
      </select>
     </label>
     <label>Orden de presentación
      <input type="number" min="0" step="1" [value]="order()" (input)="order.set(+$any($event.target).value)"/>
     </label>
     @if(saveError()){<p role="alert" class="cat-alert">{{saveError()}}</p>}
     <div class="cat-actions">
      <button class="cat-primary" type="submit" [disabled]="saving()||!name().trim()||order()<0">
       {{saving()?'Guardando…':'Guardar categoría'}}</button>
      <button type="button" (click)="cancel()">Cerrar</button>
     </div>
    </form>
   </section>
   @if(editing();as entry){
    <gc-catalog-gallery [entityId]="entry.id" kind="category" [photos]="entry.imagenes??[]"
     [editable]="access.canManage()" (updated)="refreshSelected()"/>
    <section class="cat-card">
     <h2>Estado de la categoría</h2>
     <p class="cat-muted">Desactivar puede impedir usarla en nuevos productos. Se verifican sus relaciones.</p>
     <label class="cat-field">Motivo del cambio
      <input [value]="reason()" maxlength="500" (input)="reason.set($any($event.target).value)"/>
     </label>
     <button type="button" (click)="toggleStatus()" [disabled]="saving()||reason().trim().length<3">
      {{entry.activa?'Desactivar':'Reactivar'}} categoría</button>
    </section>
   }
  }
 </main>`,
 styleUrl:'../catalog.scss'
})
export class GcCatalogCategoriesPage implements GcDirtyAware{
 protected readonly access=inject(CatalogAccess);
 private readonly api=inject(CatalogApi);
 private readonly router=inject(Router);
 private readonly route=inject(ActivatedRoute);
 private readonly confirm=inject(ConfirmDialogService);
 private readonly notice=inject(GcNotificationService);
 private readonly query=toSignal(this.route.queryParamMap,{initialValue:this.route.snapshot.queryParamMap});
 protected readonly page=new GcPageState<CatalogPage<CatalogCategory>>();
 protected readonly tree=signal<CatalogCategory[]>([]);
 protected readonly editing=signal<CatalogCategory|null>(null);
 protected readonly creating=signal(false);
 protected readonly name=signal('');
 protected readonly parent=signal('');
 protected readonly order=signal(0);
 protected readonly reason=signal('');
 protected readonly search=signal('');
 protected readonly saving=signal(false);
 protected readonly saveError=signal<string|null>(null);
 protected readonly currentPage=computed(()=>Math.max(1,Number(this.query().get('page')||1)||1));
 protected readonly state=computed(()=>this.query().get('activo')??'');
 protected readonly parents=computed(()=>this.tree().filter(x=>x.activa&&x.id!==this.editing()?.id));
 constructor(){effect(()=>{
  const page=this.currentPage(),state=this.state(),search=this.query().get('search')??'';
  this.search.set(search);void this.load(page,state,search);
 })}
 hasUnsavedChanges(){const old=this.editing();return this.creating()?!!this.name().trim():
  !!old&&(this.name()!==old.nombre||this.parent()!==(old.parentId??'')||this.order()!==old.orden)}
 protected error(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load(this.currentPage(),this.state(),this.query().get('search')??'')}
 private async load(page:number,active:string,search:string){
  if(!this.access.canRead())return;
  await this.page.load(()=>firstValueFrom(this.api.categories({
   page,limit:20,search,activo:active===''?undefined:active==='true'
  })));
  try{const t=await firstValueFrom(this.api.categoryTree());this.tree.set(this.flatten(t.data))}
  catch{this.tree.set([])}
 }
 private flatten(data:CatalogCategory[]):CatalogCategory[]{
  return data.flatMap(x=>[x,...this.flatten(x.children??[])])
 }
 protected applySearch(){void this.patch({page:null,search:this.search().trim()||null})}
 protected changeState(v:string){void this.patch({page:null,activo:v||null})}
 protected changePage(d:number){void this.patch({page:String(Math.max(1,this.currentPage()+d))})}
 private patch(values:Record<string,string|null>){return this.router.navigate([],{
  relativeTo:this.route,queryParams:values,queryParamsHandling:'merge'
 })}
 protected newCategory(){this.editing.set(null);this.creating.set(true);this.name.set('');this.parent.set('');this.order.set(0)}
 protected select(x:CatalogCategory){this.creating.set(false);this.editing.set(x);
  this.name.set(x.nombre);this.parent.set(x.parentId??'');this.order.set(x.orden);this.reason.set('')}
 protected cancel(){this.editing.set(null);this.creating.set(false)}
 protected async save(event:Event){
  event.preventDefault();
  if(!this.access.canManage()||this.saving()||!this.name().trim()||this.order()<0)return;
  const old=this.editing(),dto:CatalogCategoryPatch={
   nombre:this.name().trim(),parentId:this.parent()||null,orden:this.order()
  };
  if(old&&dto.nombre===old.nombre&&dto.parentId===old.parentId&&dto.orden===old.orden)return;
  this.saveError.set(null);this.saving.set(true);
  try{
   const result=old?await firstValueFrom(this.api.updateCategory(old.id,dto)):
    await firstValueFrom(this.api.createCategory({nombre:dto.nombre!,parentId:dto.parentId,orden:dto.orden}));
   this.creating.set(false);this.select(result);
   await this.load(this.currentPage(),this.state(),this.query().get('search')??'');
   this.notice.show('Categoría guardada.','success');
  }catch(e){this.saveError.set(gcErrorMessage(e))}finally{this.saving.set(false)}
 }
 protected async toggleStatus(){
  const d=this.editing();if(!d||!this.access.canManage()||this.reason().trim().length<3)return;
  const ok=await this.confirm.confirm({title:d.activa?'Desactivar categoría':'Reactivar categoría',
   message:'Se revisarán sus relaciones comerciales.',confirmText:'Confirmar',danger:d.activa});
  if(!ok)return;
  this.saving.set(true);this.saveError.set(null);
  try{this.select(await firstValueFrom(this.api.categoryStatus(d.id,!d.activa,this.reason().trim())));
   await this.load(this.currentPage(),this.state(),this.query().get('search')??'');
   this.notice.show('Estado de categoría actualizado.','success');
  }catch(e){this.saveError.set(gcErrorMessage(e))}finally{this.saving.set(false)}
 }
 protected async refreshSelected(){
  const item=this.editing();if(!item)return;
  try{this.select(await firstValueFrom(this.api.category(item.id)))}catch(e){this.saveError.set(gcErrorMessage(e))}
  await this.load(this.currentPage(),this.state(),this.query().get('search')??'');
 }
}
