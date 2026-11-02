import {Component,computed,effect,inject,signal} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {GcCatalogNav} from '../catalog-nav';
import {CatalogApi} from '../data-access/catalog.api';
import {CatalogAccess} from '../data-access/catalog-access';
import type {CatalogGroup,CatalogModifier,CatalogPage} from '../data-access/catalog.models';
import {toApiDecimal,formatCurrency} from '../../../shared/formatting';
import type {GcDirtyAware} from '../../../core/ux/gc-unsaved-changes.guard';

@Component({
 selector:'gc-catalog-extras-page',imports:[GcCatalogNav,GcErrorState],
 template:`
 <main class="cat-page">
  <gc-catalog-nav/>
  <section class="cat-card">
   <div class="cat-row"><h2>Grupos de extras</h2>
    @if(access.canManage()){<button class="cat-primary" type="button" (click)="newGroup()">Nuevo grupo</button>}
   </div>
   <p class="cat-muted">Define elecciones como «Tipo de leche» o «Adicionales». Mínimo y máximo indican cuántas opciones puede elegir el cliente.</p>
   <div class="cat-table-wrap"><table class="cat-table">
    <thead><tr><th>Grupo</th><th>Elección mínima</th><th>Elección máxima</th><th>Opciones</th><th>Estado</th><th>Acción</th></tr></thead>
    <tbody>
     @for(g of groups();track g.id){
      <tr>
       <td><strong>{{g.nombre}}</strong></td><td>{{g.minimo}}</td><td>{{g.maximo??'Sin límite'}}</td>
       <td>{{g.modificadoresComoGrupo?.length??0}}</td><td>{{g.activo?'Activo':'Inactivo'}}</td>
       <td><button type="button" (click)="chooseGroup(g)">Configurar</button></td>
      </tr>
     } @empty {<tr><td colspan="6">No hay grupos registrados.</td></tr>}
    </tbody>
   </table></div>
   <div class="cat-row cat-muted"><span>{{groupTotal()}} grupos registrados · Página {{groupPage()}}</span>
    <div class="cat-actions">
     <button type="button" [disabled]="groupPage()<=1" (click)="changeGroupPage(-1)">Anterior</button>
     <button type="button" [disabled]="groupPage()*20>=groupTotal()" (click)="changeGroupPage(1)">Siguiente</button>
    </div>
   </div>
   @if(groupError()){<p role="alert" class="cat-alert">{{groupError()}}</p>}
   @if(groupBusy()){<p role="status" class="cat-muted">Consultando grupos…</p>}
  </section>
  @if((selectedGroup()||newGroupMode())&&access.canManage()){
   <section class="cat-card">
    <h2>{{newGroupMode()?'Nuevo grupo':'Configurar grupo'}}</h2>
    <form class="cat-form" (submit)="saveGroup($event)">
     <label>Nombre
      <input [value]="groupName()" (input)="groupName.set($any($event.target).value)" required maxlength="130"/>
     </label>
     <label>Mínimo de opciones
      <input type="number" min="0" step="1" [value]="minimum()" (input)="minimum.set(+$any($event.target).value)" required/>
     </label>
     <label>Máximo de opciones (vacío = sin límite)
      <input type="number" min="0" step="1" [value]="maximum()" (input)="maximum.set($any($event.target).value)"/>
     </label>
     @if(selectedGroup()){
      <label class="cat-check"><input type="checkbox" [checked]="groupActive()" (change)="groupActive.set($any($event.target).checked)"/>
       Grupo activo</label>
     }
     <div class="cat-actions">
      <button class="cat-primary" type="submit" [disabled]="busy()||!validGroup()">Guardar grupo</button>
      <button type="button" (click)="closeGroup()">Cerrar</button>
     </div>
    </form>
   </section>
  }
  <section class="cat-card">
   <div class="cat-row"><h2>Opciones de extras</h2>
    @if(access.canManage()){<button type="button" class="cat-primary" (click)="newModifier()" [disabled]="!groups().length">
     Nuevo extra</button>}
   </div>
   <div class="cat-toolbar">
    <label class="cat-field">Filtrar por grupo
     <select [value]="filterGroup()" (change)="setFilter($any($event.target).value)">
      <option value="">Todos los grupos</option>
      @for(g of groups();track g.id){<option [value]="g.id">{{g.nombre}}</option>}
     </select>
    </label>
    <label class="cat-field">Buscar extra
     <input [value]="search()" (input)="search.set($any($event.target).value)" (keyup.enter)="loadModifiers()"/>
    </label>
    <button type="button" (click)="loadModifiers()">Buscar</button>
   </div>
   @if(modifiers.busy()){<p role="status" class="cat-muted">Cargando extras…</p>}
   @if(modifiers.status()==='error'){<gc-error-state [message]="error()" (retry)="loadModifiers()"/>}
   @if(modifiers.data();as result){
    <div class="cat-table-wrap"><table class="cat-table"><thead><tr>
     <th>Nombre</th><th>Grupo</th><th>Recargo base</th><th>Composición</th><th>Estado</th><th>Acción</th>
    </tr></thead><tbody>
     @for(x of result.data;track x.id){
      <tr><td><strong>{{x.nombre}}</strong></td><td>{{x.grupo?.nombre??groupLabel(x.grupoId)}}</td>
       <td>{{money(x.incrementoPrecio)}}</td>
       <td>{{x.requiereComposicion?'Requiere receta o composición':'No requerida'}}</td>
       <td>{{x.activo?'Activo':'Inactivo'}}</td>
       <td><button type="button" (click)="chooseModifier(x)">Editar</button></td>
      </tr>
     } @empty {<tr><td colspan="6">No hay opciones con estos filtros.</td></tr>}
    </tbody></table></div>
    <div class="cat-row cat-muted"><span>{{result.meta.total}} extras · Página {{modifierPage()}}</span>
     <div class="cat-actions">
      <button type="button" [disabled]="modifierPage()<=1" (click)="changeModifierPage(-1)">Anterior</button>
      <button type="button" [disabled]="modifierPage()*20>=result.meta.total" (click)="changeModifierPage(1)">Siguiente</button>
     </div>
    </div>
   }
  </section>
  @if((selectedModifier()||newModifierMode())&&access.canManage()){
   <section class="cat-card">
    <h2>{{newModifierMode()?'Nuevo extra':'Editar extra'}}</h2>
    <form class="cat-form" (submit)="saveModifier($event)">
     <label>Grupo de extras
      <select [value]="modifierGroup()" (change)="modifierGroup.set($any($event.target).value)"
       [disabled]="!!selectedModifier()">
       <option value="">Seleccionar grupo</option>
       @for(g of groups();track g.id){@if(g.activo){<option [value]="g.id">{{g.nombre}}</option>}}
      </select>
     </label>
     <label>Nombre de la opción
      <input [value]="modifierName()" maxlength="130" (input)="modifierName.set($any($event.target).value)" required/>
     </label>
     <label>Recargo base de referencia (Q)
      <input [value]="modifierPrice()" inputmode="decimal" (input)="modifierPrice.set($any($event.target).value)"
       placeholder="0.00" required/>
     </label>
     <label class="cat-check"><input type="checkbox" [checked]="requiresRecipe()"
      (change)="requiresRecipe.set($any($event.target).checked)"/> Necesita composición o receta para producción</label>
     @if(selectedModifier()){
      <label class="cat-check"><input type="checkbox" [checked]="modifierActive()"
       (change)="modifierActive.set($any($event.target).checked)"/> Opción activa</label>
     }
     <p class="cat-muted">Los recargos específicos por sucursal se configuran en «Precios». Aquí no se modifica el inventario.</p>
     @if(modifierError()){<p role="alert" class="cat-alert">{{modifierError()}}</p>}
     <div class="cat-actions">
      <button class="cat-primary" type="submit" [disabled]="busy()||!modifierGroup()||!modifierName().trim()">
       {{busy()?'Guardando…':'Guardar extra'}}</button>
      <button type="button" (click)="closeModifier()">Cerrar</button>
     </div>
    </form>
   </section>
  }
 </main>`,
 styleUrl:'../catalog.scss'
})
export class GcCatalogExtrasPage implements GcDirtyAware{
 protected readonly access=inject(CatalogAccess);
 private readonly api=inject(CatalogApi);
 private readonly notice=inject(GcNotificationService);
 private readonly confirm=inject(ConfirmDialogService);
 protected readonly groups=signal<CatalogGroup[]>([]);
 protected readonly groupTotal=signal(0);
 protected readonly groupPage=signal(1);
 protected readonly groupBusy=signal(false);
 protected readonly groupError=signal<string|null>(null);
 protected readonly selectedGroup=signal<CatalogGroup|null>(null);
 protected readonly newGroupMode=signal(false);
 protected readonly groupName=signal('');
 protected readonly minimum=signal(0);
 protected readonly maximum=signal('');
 protected readonly groupActive=signal(true);
 protected readonly selectedModifier=signal<CatalogModifier|null>(null);
 protected readonly newModifierMode=signal(false);
 protected readonly modifiers=new GcPageState<CatalogPage<CatalogModifier>>();
 protected readonly filterGroup=signal('');
 protected readonly search=signal('');
 protected readonly modifierPage=signal(1);
 protected readonly modifierGroup=signal('');
 protected readonly modifierName=signal('');
 protected readonly modifierPrice=signal('0.00');
 protected readonly requiresRecipe=signal(false);
 protected readonly modifierActive=signal(true);
 protected readonly modifierError=signal<string|null>(null);
 protected readonly saving=signal(false);
 protected readonly busy=computed(()=>this.saving());
 protected readonly validGroup=computed(()=>this.groupName().trim().length>0&&Number.isInteger(this.minimum())&&this.minimum()>=0&&
  (this.maximum()===''||(Number.isInteger(Number(this.maximum()))&&Number(this.maximum())>=this.minimum())));
 constructor(){effect(()=>{if(this.access.canRead()){void this.loadGroups();void this.loadModifiers()}})}
 hasUnsavedChanges(){
  const group=this.selectedGroup();
  const mod=this.selectedModifier();
  return this.newGroupMode()&&!!this.groupName()||this.newModifierMode()&&!!this.modifierName()||
   !!group&&(group.nombre!==this.groupName()||group.minimo!==this.minimum()||String(group.maximo??'')!==this.maximum()||
    group.activo!==this.groupActive())||
   !!mod&&(mod.nombre!==this.modifierName()||mod.incrementoPrecio!==this.modifierPrice()||
    mod.requiereComposicion!==this.requiresRecipe()||mod.activo!==this.modifierActive());
 }
 protected money(s:string){try{return formatCurrency(s,'GTQ')}catch{return '—'}}
 protected error(){return gcErrorMessage(this.modifiers.error())}
 protected groupLabel(id:string){return this.groups().find(x=>x.id===id)?.nombre??'Grupo sin nombre'}
 protected async loadGroups(){
  if(!this.access.canRead())return;
  this.groupBusy.set(true);this.groupError.set(null);
  try{const res=await firstValueFrom(this.api.modifierGroups({page:this.groupPage(),limit:20}));
   this.groups.set(res.data);this.groupTotal.set(res.meta.total)
  }catch(e){this.groupError.set(gcErrorMessage(e))}
  finally{this.groupBusy.set(false)}
 }
 protected changeGroupPage(offset:number){this.groupPage.update(x=>Math.max(1,x+offset));void this.loadGroups()}
 protected changeModifierPage(offset:number){this.modifierPage.update(x=>Math.max(1,x+offset));void this.loadModifiers()}
 protected setFilter(v:string){this.filterGroup.set(v);this.modifierPage.set(1);void this.loadModifiers()}
 protected async loadModifiers(){
  if(!this.access.canRead())return;
  await this.modifiers.load(()=>firstValueFrom(this.api.modifiers({page:this.modifierPage(),limit:20,
   grupoId:this.filterGroup()||undefined,search:this.search().trim()})))
 }
 protected chooseGroup(x:CatalogGroup){this.selectedGroup.set(x);this.newGroupMode.set(false);
  this.groupName.set(x.nombre);this.minimum.set(x.minimo);this.maximum.set(x.maximo===null?'':String(x.maximo));
  this.groupActive.set(x.activo)}
 protected newGroup(){this.selectedGroup.set(null);this.newGroupMode.set(true);
  this.groupName.set('');this.minimum.set(0);this.maximum.set('');this.groupActive.set(true)}
 protected closeGroup(){this.selectedGroup.set(null);this.newGroupMode.set(false)}
 protected async saveGroup(event:Event){
  event.preventDefault();if(!this.access.canManage()||!this.validGroup()||this.busy())return;
  const original=this.selectedGroup(),dto={nombre:this.groupName().trim(),minimo:this.minimum(),
   maximo:this.maximum()===''?null:Number(this.maximum())};
  const ok=await this.confirm.confirm({title:original?'Actualizar grupo':'Crear grupo',
   message:'Se aplicarán los límites de selección comercial.',confirmText:'Guardar'});
  if(!ok)return;
  this.saving.set(true);this.groupError.set(null);
  try{
   if(original)await firstValueFrom(this.api.updateModifierGroup(original.id,{...dto,activo:this.groupActive()}));
   else await firstValueFrom(this.api.createModifierGroup(dto));
   this.closeGroup();await this.loadGroups();this.notice.show('Grupo guardado.','success')
  }catch(e){this.groupError.set(gcErrorMessage(e))}finally{this.saving.set(false)}
 }
 protected chooseModifier(x:CatalogModifier){
  this.newModifierMode.set(false);this.selectedModifier.set(x);this.modifierGroup.set(x.grupoId);
  this.modifierName.set(x.nombre);this.modifierPrice.set(x.incrementoPrecio);
  this.requiresRecipe.set(x.requiereComposicion);this.modifierActive.set(x.activo);
 }
 protected newModifier(){this.selectedModifier.set(null);this.newModifierMode.set(true);
  this.modifierGroup.set(this.filterGroup());this.modifierName.set('');
  this.modifierPrice.set('0.00');this.requiresRecipe.set(false);this.modifierActive.set(true)}
 protected closeModifier(){this.selectedModifier.set(null);this.newModifierMode.set(false)}
 protected async saveModifier(event:Event){
  event.preventDefault();
  if(!this.access.canManage()||this.busy()||!this.modifierGroup()||!this.modifierName().trim())return;
  this.modifierError.set(null);
  let value:string;try{value=toApiDecimal(this.modifierPrice())}catch{
   this.modifierError.set('Introduce un importe válido.');return}
  if(!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(value)){
   this.modifierError.set('El recargo admite hasta dos decimales y no puede ser negativo.');return}
  this.saving.set(true);
  try{
   const base={nombre:this.modifierName().trim(),incrementoPrecio:value,requiereComposicion:this.requiresRecipe()};
   const old=this.selectedModifier();
   if(old)await firstValueFrom(this.api.updateModifier(old.id,{...base,activo:this.modifierActive()}));
   else await firstValueFrom(this.api.createModifier({grupoId:this.modifierGroup(),...base}));
   this.closeModifier();await this.loadModifiers();await this.loadGroups();
   this.notice.show('Extra guardado.','success')
  }catch(e){this.modifierError.set(gcErrorMessage(e))}finally{this.saving.set(false)}
 }
}
