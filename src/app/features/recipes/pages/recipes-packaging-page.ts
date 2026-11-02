import {Component,computed,inject,OnInit,signal} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {InventoryApi} from '../../inventory/data-access/inventory.api';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {CatalogApi} from '../../catalog/data-access/catalog.api';
import type {CatalogVariant} from '../../catalog/data-access/catalog.models';
import type {GcDirtyAware} from '../../../core/ux/gc-unsaved-changes.guard';
import {parseApiDecimal,toApiDecimal} from '../../../shared/formatting';
import {GcRecipesNav} from '../recipes-nav';
import {RecipesApi} from '../data-access/recipes.api';
import {RecipesAccess} from '../data-access/recipes-access';
import {PACKAGING_MODES,type PackagingMode,type PackagingScope,type PackagingRule,type PackagingRuleInput} from '../data-access/recipes.models';

interface Material {key:number;articuloId:string;nombre:string;cantidad:string;unidad:string}
@Component({
 selector:'gc-recipes-packaging-page',
 imports:[GcRecipesNav,GcInventoryPicker],
 template:`<main class="rec-page">
  <gc-recipes-nav/>
  <section class="rec-card">
   <div class="rec-top"><h2>Reglas de empaque</h2>
    @if(access.canManage()){<button class="rec-primary" type="button" (click)="createNew()">Nueva regla</button>}
   </div>
   <p class="rec-note">Define los materiales que se utilizan al servir o entregar productos: vasos, tapas, bolsas y servilletas.</p>
   <div class="rec-filters">
    <label class="rec-field">Sucursal
     <select [value]="filterBranch()" (change)="chooseFilter($any($event.target).value)">
      <option value="">Todas las sucursales</option>
      @for(branch of context.branches();track branch.id){
       <option [value]="branch.id" [selected]="filterBranch()===branch.id">{{branch.nombre}}</option>
      }
     </select>
    </label>
    <label class="rec-field">Buscar regla
     <input [value]="search()" maxlength="120" (input)="search.set($any($event.target).value)"/>
    </label>
   </div>
   @if(loading()){<p class="rec-muted" role="status">Cargando empaques…</p>}
   @if(listError()){<p role="alert" class="rec-alert">{{listError()}} <button type="button" (click)="load()">Reintentar</button></p>}
   <div class="rec-table-wrap"><table class="rec-table">
    <thead><tr><th>Regla</th><th>Entrega</th><th>Se aplica a</th><th>Sucursal</th><th>Estado</th><th></th></tr></thead>
    <tbody>
     @for(item of shown();track item.id){
      <tr><td><strong>{{item.nombre}}</strong></td>
       <td>{{modeName(item.modalidad)}}</td>
       <td>{{item.alcance==='ORDEN'?'Al pedido completo':item.variante?.producto?.nombre+' · '+item.variante?.nombre}}</td>
       <td>{{item.sucursal?.nombre??'Todas las sucursales'}}</td>
       <td>{{item.activa?'Activa':'Inactiva'}}</td>
       <td><button type="button" (click)="open(item)">Detalles</button></td>
      </tr>
     } @empty {<tr><td colspan="6">No hay reglas con estos filtros.</td></tr>}
    </tbody>
   </table></div>
  </section>
  @if(editing()){
   <section class="rec-card">
    <div class="rec-top"><h2>{{selected()?'Editar regla':'Nueva regla'}}</h2>
     <button type="button" (click)="close()" [disabled]="busy()">Cerrar</button>
    </div>
    <div class="rec-form">
     <label class="rec-field">Nombre
      <input [value]="name()" maxlength="120" required [disabled]="!access.canManage()"
       (input)="name.set($any($event.target).value)" placeholder="Empaque para café caliente"/>
     </label>
     <label class="rec-field">Tipo de entrega
      <select [value]="mode()" [disabled]="!access.canManage()" (change)="mode.set($any($event.target).value)">
       @for(item of modes;track item.value){<option [value]="item.value" [selected]="mode()===item.value">{{item.label}}</option>}
      </select>
     </label>
     <label class="rec-field">Se aplica a
      <select [value]="scope()" [disabled]="!access.canManage()" (change)="setScope($any($event.target).value)">
       <option value="ORDEN" [selected]="scope()==='ORDEN'">Todo el pedido</option>
       <option value="ARTICULO" [selected]="scope()==='ARTICULO'">Una presentación específica</option>
      </select>
     </label>
     <label class="rec-field">Sucursal
      <select [value]="branchId()" [disabled]="!access.canManage()" (change)="branchId.set($any($event.target).value)">
       <option value="" [selected]="!branchId()">Todas las sucursales</option>
       @for(b of context.branches();track b.id){<option [value]="b.id" [selected]="branchId()===b.id">{{b.nombre}}</option>}
      </select>
     </label>
     @if(scope()==='ARTICULO'){
      <div class="rec-wide rec-form">
       <label class="rec-field">Buscar presentación
        <input [value]="variantSearch()" maxlength="100"
         (input)="variantSearch.set($any($event.target).value)"
         (keydown.enter)="$event.preventDefault();findVariants()"/>
       </label>
       <button type="button" (click)="findVariants()">Buscar</button>
       <label class="rec-field">Presentación
        <select [value]="variantId()" (change)="variantId.set($any($event.target).value)"
         [disabled]="!access.canManage()">
         <option value="" [selected]="!variantId()">Seleccionar presentación</option>
         @for(v of availableVariants();track v.id){<option [value]="v.id" [selected]="v.id===variantId()">
          {{v.label??(v.producto?.nombre+' · '+v.nombre)}}</option>}
        </select>
       </label>
      </div>
     }
    </div>
    <div class="rec-top"><h3>Materiales</h3>
     @if(access.canManage()){<button type="button" (click)="addMaterial()" [disabled]="materials().length>=100">
      Agregar material</button>}
    </div>
    <p class="rec-note">Las cantidades se registran en la unidad base de cada material del Inventario.</p>
    @for(line of materials();track line.key;let i=$index){
     <div class="rec-line">
      <div class="rec-line-grid">
       <gc-inventory-picker [id]="'packaging-material-'+line.key" kind="article" label="Material de empaque"
        [value]="line.articuloId" [selectedLabel]="line.nombre" articleKind="EMPAQUE" (valueChange)="changeArticle(i,$event)"
        [disabled]="!access.canManage()"/>
       <label class="rec-field">Cantidad {{line.unidad?'('+line.unidad+')':''}}
        <input inputmode="decimal" [value]="line.cantidad" (input)="changeMaterial(i,{cantidad:$any($event.target).value})"
         [disabled]="!access.canManage()" placeholder="1"/>
       </label>
      </div>
      @if(access.canManage()){<button type="button" (click)="removeMaterial(i)">Quitar material</button>}
     </div>
    } @empty {<p class="rec-muted">Agrega al menos un material a la regla.</p>}
    @for(text of validation();track text){<p class="rec-alert" role="alert">{{text}}</p>}
    @if(saveError()){<p class="rec-alert" role="alert">{{saveError()}}</p>}
    @if(access.canManage()){
     <div class="rec-actions">
      <button class="rec-primary" type="button" [disabled]="busy()||validation().length>0||!dirty()" (click)="save()">
       {{busy()?'Guardando…':'Guardar regla'}}</button>
      @if(selected();as current){
       <button type="button" [disabled]="busy()||dirty()" (click)="status(current)">
        {{current.activa?'Desactivar':'Activar'}} regla</button>
      }
     </div>
    }
   </section>
  }
 </main>`,
 styleUrl:'../recipes.scss'
})
export class GcRecipesPackagingPage implements OnInit,GcDirtyAware {
 protected readonly access=inject(RecipesAccess);
 protected readonly context=inject(GcBranchContext);
 private readonly api=inject(RecipesApi);
 private readonly inventory=inject(InventoryApi);
 private readonly catalog=inject(CatalogApi);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notify=inject(GcNotificationService);
 protected readonly loading=signal(false);
 protected readonly listError=signal<string|null>(null);
 protected readonly filterBranch=signal('');
 protected readonly search=signal('');
 protected readonly all=signal<PackagingRule[]>([]);
 protected readonly shown=computed(()=>this.all().filter(x=>x.nombre.toLocaleLowerCase().includes(this.search().trim().toLocaleLowerCase())));
 protected readonly selected=signal<PackagingRule|null>(null);
 protected readonly editing=signal(false);
 protected readonly name=signal('');
 protected readonly scope=signal<PackagingScope>('ORDEN');
 protected readonly mode=signal<PackagingMode>('PARA_LLEVAR');
 protected readonly modes=PACKAGING_MODES;
 protected readonly branchId=signal('');
 protected readonly variantSearch=signal('');
 protected readonly variantId=signal('');
 protected readonly variants=signal<CatalogVariant[]>([]);
 protected readonly materials=signal<Material[]>([]);
 protected readonly busy=signal(false);
 protected readonly saveError=signal<string|null>(null);
 private nextKey=0;
 private baseline='';
 protected readonly availableVariants=computed(()=>{
  const result=[...this.variants()];
  const current=this.selected()?.variante;
  if(current&&!result.some(v=>v.id===current.id))result.unshift(current);
  return result;
 });
 protected readonly dirty=computed(()=>this.editing()&&JSON.stringify(this.snapshot())!==this.baseline);
 protected readonly validation=computed(()=>{
  const errors:string[]=[];
  if(this.name().trim().length<3)errors.push('El nombre debe tener al menos 3 caracteres.');
  if(this.scope()==='ARTICULO'&&!this.variantId())errors.push('Selecciona la presentación a la que se aplica.');
  if(!this.materials().length)errors.push('Agrega al menos un material de empaque.');
  const ids=new Set<string>();
  for(const material of this.materials()){
   if(!material.articuloId)errors.push('Selecciona el material de cada línea.');
   if(ids.has(material.articuloId)&&material.articuloId)errors.push('Un material no puede repetirse.');
   ids.add(material.articuloId);
   try{if(parseApiDecimal(material.cantidad).lte(0))errors.push('Las cantidades deben ser mayores que cero.')}
   catch{errors.push('Introduce cantidades válidas.')}
  }
  return [...new Set(errors)];
 });
 hasUnsavedChanges(){return this.dirty()}
 ngOnInit(){void this.load()}
 protected modeName(value:PackagingMode){return PACKAGING_MODES.find(x=>x.value===value)?.label??'Entrega'}
 protected chooseFilter(v:string){this.filterBranch.set(v);void this.load()}
 protected async load(){
  this.loading.set(true);this.listError.set(null);
  try{this.all.set(await firstValueFrom(this.api.packaging({sucursalId:this.filterBranch()||undefined})))}
  catch(e){this.listError.set(gcErrorMessage(e))}
  finally{this.loading.set(false)}
 }
 private snapshot(){return {name:this.name(),scope:this.scope(),mode:this.mode(),
  branch:this.branchId(),variant:this.variantId(),materials:this.materials()}}
 protected async createNew(){
  if(this.dirty()){
   const ok=await this.dialog.confirm({title:'Descartar cambios',
    message:'Se perderán los cambios que todavía no has guardado.',confirmText:'Continuar',danger:true});
   if(!ok)return;
  }
  this.selected.set(null);this.editing.set(true);
  this.name.set('');this.scope.set('ORDEN');this.mode.set('PARA_LLEVAR');
  this.branchId.set('');this.variantId.set('');this.materials.set([]);this.baseline=JSON.stringify(this.snapshot());
 }
 protected async open(rule:PackagingRule){
  if(this.dirty()){
   const ok=await this.dialog.confirm({title:'Descartar cambios',
    message:'Los cambios de esta regla todavía no se guardaron.',confirmText:'Continuar',danger:true});
   if(!ok)return;
  }
  this.busy.set(true);this.saveError.set(null);
  try{const result=await firstValueFrom(this.api.packagingOne(rule.id));
   this.selected.set(result);this.editing.set(true);
   this.name.set(result.nombre);this.scope.set(result.alcance);this.mode.set(result.modalidad);
   this.branchId.set(result.sucursalId??'');this.variantId.set(result.varianteId??'');
   this.materials.set(result.reglaEmpaqueLineasComoRegla.map(line=>({
    key:++this.nextKey,articuloId:line.articuloId,nombre:line.articulo?.nombre??'',
    cantidad:line.cantidad,unidad:line.articulo?.unidadBase?.codigo??''
   })));
   this.baseline=JSON.stringify(this.snapshot());
  }catch(e){this.saveError.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
 protected close(){
  if(this.dirty()){void this.dialog.confirm({title:'Cerrar sin guardar',
   message:'Se perderán los cambios de esta regla.',confirmText:'Cerrar',danger:true
  }).then(ok=>{if(ok)this.editing.set(false)});return}
  this.editing.set(false);
 }
 protected setScope(value:string){this.scope.set(value==='ARTICULO'?'ARTICULO':'ORDEN');
  if(this.scope()==='ORDEN')this.variantId.set('')}
 protected async findVariants(){
  try{
   const data=await firstValueFrom(this.catalog.variantOptions({search:this.variantSearch().trim(),limit:50}));
   this.variants.set(data.data);
  }catch(e){this.saveError.set(gcErrorMessage(e))}
 }
 protected addMaterial(){this.materials.update(v=>[...v,{
  key:++this.nextKey,articuloId:'',nombre:'',cantidad:'1',unidad:''
 }])}
 protected removeMaterial(index:number){this.materials.update(a=>a.filter((_,i)=>i!==index))}
 protected changeMaterial(index:number,patch:Partial<Material>){
  this.materials.update(a=>a.map((x,i)=>i===index?{...x,...patch}:x))
 }
 protected async changeArticle(index:number,id:string){
  this.changeMaterial(index,{articuloId:id,nombre:'',unidad:''});
  if(!id)return;
  try{
   const article=await firstValueFrom(this.inventory.article(id));
   if(this.materials()[index]?.articuloId===id)this.changeMaterial(index,{
    nombre:article.nombre,unidad:article.unidadBase.codigo
   });
  }catch{/* The server validates material type; no ID leaks to the operator. */}
 }
 protected async save(){
  if(!this.access.canManage()||this.validation().length||this.busy())return;
  const dto:PackagingRuleInput={
   nombre:this.name().trim(),alcance:this.scope(),modalidad:this.mode(),
   ...(this.scope()==='ARTICULO'?{varianteId:this.variantId()}:{}),
   ...(this.branchId()?{sucursalId:this.branchId()}:{}),
   lineas:this.materials().map(x=>({articuloId:x.articuloId,cantidad:toApiDecimal(x.cantidad)}))
  };
  this.busy.set(true);this.saveError.set(null);
  try{
   const id=this.selected()?.id;
   const result=id?await firstValueFrom(this.api.updatePackaging(id,dto)):
    await firstValueFrom(this.api.createPackaging(dto));
   this.editing.set(false);await this.load();
   if(result?.id){const complete=await firstValueFrom(this.api.packagingOne(result.id));await this.open(complete)}
   this.notify.show('Regla de empaque guardada.','success');
  }catch(e){this.saveError.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
 protected async status(row:PackagingRule){
  if(!this.access.canManage()||this.busy()||this.dirty())return;
  const confirm=await this.dialog.confirm({title:row.activa?'Desactivar regla':'Activar regla',
   message:'Este cambio afectará la preparación de pedidos futuros.',confirmText:'Confirmar',danger:row.activa});
  if(!confirm)return;
  this.busy.set(true);this.saveError.set(null);
  try{await firstValueFrom(this.api.packagingStatus(row.id,!row.activa));
   const fresh=await firstValueFrom(this.api.packagingOne(row.id));
   this.selected.set(fresh);await this.load();this.notify.show('Estado de empaque actualizado.','success');
  }catch(e){this.saveError.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
}
