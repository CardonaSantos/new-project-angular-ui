import {Component,computed,inject,OnInit,signal} from '@angular/core';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {firstValueFrom,Subject,debounceTime,distinctUntilChanged} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {CatalogApi} from '../../catalog/data-access/catalog.api';
import {InventoryApi} from '../../inventory/data-access/inventory.api';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import type {Dimension} from '../../inventory/data-access/inventory.models';
import type {CatalogVariant} from '../../catalog/data-access/catalog.models';
import type {GcDirtyAware} from '../../../core/ux/gc-unsaved-changes.guard';
import {GcRecipesNav} from '../recipes-nav';
import {RecipesApi} from '../data-access/recipes.api';
import {RecipesAccess} from '../data-access/recipes-access';
import {recipeDestination,readableQuantity,normalizeFormula,validateFormula} from '../data-access/recipes-presentation';
import type {RecipeKind,RecipeRecord,RecipeVersion,RecipeVersionInput} from '../data-access/recipes.models';

interface IngredientForm {
 key:number;articuloId:string;articuloNombre:string;
 unidadId:string;unidadNombre:string;dimension:Dimension|'';cantidad:string;mermaPorcentaje:string;
}
@Component({
 selector:'gc-recipes-detail-page',
 imports:[RouterLink,GcRecipesNav,GcInventoryPicker,GcSearchSelect],
 template:`<main class="rec-page">
  <gc-recipes-nav/><a class="rec-link" routerLink="/recipes/list">Volver a recetas</a>
  @if(page.busy()){<p role="status" class="rec-muted">Consultando receta…</p>}
  @if(page.status()==='error'){
   <section class="rec-card"><p class="rec-alert">{{pageError()}}</p>
    <button type="button" (click)="reload()">Reintentar</button></section>
  }
  @if(isNew||page.data()){
   <section class="rec-card">
    <div class="rec-top"><h2>{{isNew?'Nueva receta':'Datos de la receta'}}</h2>
     @if(page.data();as item){<span>{{item.activa?'Activa':'Inactiva'}}</span>}
    </div>
    <form class="rec-form" (submit)="saveRecipe($event)">
     <div class="rec-section"><h3>1. Identificación y destino</h3>
      <div class="rec-form">
     <label class="rec-field">Nombre
      <input [value]="name()" (input)="name.set($any($event.target).value)"
       [disabled]="!access.canManage()" required maxlength="160" minlength="3"/>
     </label>
     @if(isNew){
      <gc-search-select class="rec-wide" id="recipe-kind" label="¿Para qué se utiliza?"
       [value]="kind()" [items]="kindChoices" [searchable]="false" [clearable]="false"
       [disabled]="!access.canManage()" (valueChange)="changeKind($event)"/>
      @if(kind()==='VENTA'){

       <gc-search-select class="rec-wide" id="recipe-variant" label="Presentación"
        [items]="variantChoices()" [value]="targetId()" [remote]="true"
        placeholder="Buscar producto o presentación…"
        (searchChange)="queueVariantSearch($event)" (valueChange)="chooseVariant($event)"/>
       @if(moreVariants()){<p class="rec-muted rec-wide">Busca por el nombre para encontrar más presentaciones.</p>}
      } @else {
       <gc-inventory-picker class="rec-wide" id="recipe-result" kind="article"
        label="Preparación que obtendrás" [value]="targetId()" (valueChange)="chooseOutput($event)"/>
       <p class="rec-note rec-wide">Selecciona un artículo de preparación o producto terminado del Inventario.</p>
      }
     } @else if(page.data();as recipe){
      <div class="rec-field"><span>Tipo de receta</span><strong>{{recipe.tipo==='VENTA'?'Producto de la carta':'Preparación de inventario'}}</strong></div>
      <div class="rec-field"><span>Se utiliza en</span><strong>{{destination(recipe)}}</strong></div>
      @if(access.canManage()){
       <label class="rec-inline rec-wide"><input type="checkbox" [checked]="active()"
        (change)="active.set($any($event.target).checked)"/> Receta activa</label>
      }
     }
      </div>
     </div>
     @if(formError()){<p role="alert" class="rec-alert rec-wide">{{formError()}}</p>}
     @if(!isNew&&access.canManage()){
      <div class="rec-actions rec-wide">
       <button class="rec-primary" type="submit" [disabled]="busy()||!name().trim()">Guardar datos</button>
      </div>
     }
    </form>
   </section>

   @if(!isNew){
    <section class="rec-card">
     <div class="rec-top"><h2>Historial de fórmulas</h2>
      @if(access.canManage()&&page.data()?.activa){<button type="button" (click)="startNewVersion()" [disabled]="busy()">Nueva fórmula</button>}
     </div>
     <p class="rec-note">Las fórmulas publicadas se conservan como historial. Para cambiar sus ingredientes, crea una nueva fórmula.</p>
     <div class="rec-table-wrap"><table class="rec-table">
      <thead><tr><th>Fórmula</th><th>Rinde</th><th>Ingredientes</th><th>Estado</th><th></th></tr></thead>
      <tbody>
       @for(v of versions();track v.id){
        <tr><td>Versión {{v.numero}}</td>
         <td>{{quantity(v.rendimiento,v.unidadRendimiento?.codigo)}}</td>
         <td>{{v.recetaComponentesComoRecetaVersion?.length??0}}</td>
         <td>{{v.activa&&v.publicadaEn?'Publicada':v.publicadaEn?'Anterior':'Borrador'}}</td>
         <td><div class="rec-actions">
          <button type="button" (click)="selectVersion(v)" [disabled]="busy()">
           {{v.publicadaEn?'Ver ingredientes':access.canManage()?'Editar borrador':'Ver ingredientes'}}</button>
          @if(v.publicadaEn&&v.activa&&access.canPublish()){
           <button type="button" (click)="unpublishVersion(v)" [disabled]="busy()||hasUnsavedChanges()">Retirar del uso</button>
          }
          @if(!v.publicadaEn&&access.canManage()){
           <button type="button" (click)="discardVersion(v)" [disabled]="busy()||hasUnsavedChanges()">Descartar borrador</button>
          }
          @if(!v.publicadaEn&&access.canPublish()&&page.data()?.activa){
           <button type="button" (click)="publishVersion(v)" [disabled]="busy()||formulaDirty()">
            Publicar</button>
          }
         </div></td>
        </tr>
       } @empty {<tr><td colspan="5">Esta receta aún no tiene fórmulas.</td></tr>}
      </tbody>
     </table></div>
    </section>
   }

   @if(!isNew&&page.data();as recipe){
    @if(publishedVersion();as version){
     <section class="rec-card">
      <h2>Siguiente paso</h2>
      @if(recipe.tipo==='VENTA'){
       <p class="rec-note">Esta receta está publicada y lista para venderse. Puedes comprobar que haya ingredientes suficientes o revisar sus reglas de empaque.</p>
       <div class="rec-actions">
        <a class="rec-button rec-primary" routerLink="/recipes/check" [queryParams]="checkQueryParams(recipe,version)">
         Comprobar ingredientes</a>
        @if(recipe.varianteId){<a class="rec-button" routerLink="/recipes/packaging">Reglas de empaque</a>}
       </div>
      }@else{
       <p class="rec-note">Esta preparación está publicada. Puedes registrar una producción con esta fórmula.</p>
       <div class="rec-actions">
        <a class="rec-button rec-primary" routerLink="/recipes/production/new" [queryParams]="productionQueryParams(recipe,version)">
         Registrar producción</a>
       </div>
      }
     </section>
    }
   }

   @if(isNew||editingFormula()){
    <section class="rec-card">
     <div class="rec-top">
      <h2>{{isNew?'Ingredientes de la receta':formulaVersionId()?'Fórmula en borrador':'Nueva fórmula'}}</h2>
      @if(!isNew){<button type="button" (click)="discardFormula()" [disabled]="busy()">Cerrar</button>}
     </div>
     <div class="rec-section"><h3>Rendimiento de la fórmula</h3>
     <div class="rec-form rec-yield-grid">
      <gc-inventory-picker id="yield-unit" kind="unit" label="Unidad de rendimiento"
       [unitDimension]="kind()==='VENTA'?'UNIDAD':''"
       [value]="unitId()" [selectedLabel]="unitLabel()" (valueChange)="unitId.set($event)"
       [disabled]="!access.canManage()"/>
      <label class="rec-field">Cantidad que rinde
       <input inputmode="decimal" [value]="yieldAmount()" (input)="yieldAmount.set($any($event.target).value)"
        [disabled]="!access.canManage()" placeholder="1" required/>
      </label>
      @if(kind()==='PRODUCCION'){
       <label class="rec-field">Vida útil en días (opcional)
        <input type="number" min="0" max="3650" step="1" [value]="shelfLife()"
         (input)="shelfLife.set($any($event.target).value)" [disabled]="!access.canManage()"/>
       </label>
      }
     </div>
     </div>
     <div class="rec-top"><h3>Ingredientes</h3>
      @if(access.canManage()){<button type="button" (click)="addIngredient()" [disabled]="busy()||ingredients().length>=100">
       Agregar ingrediente</button>}
     </div>
     @for(line of ingredients();track line.key;let i=$index){
      <div class="rec-line">
       <div class="rec-line-grid">
        <gc-inventory-picker [id]="'ingredient-'+line.key" kind="article" label="Ingrediente"
         [value]="line.articuloId" [selectedLabel]="line.articuloNombre"
         [disabled]="!access.canManage()" (valueChange)="changeArticle(i,$event)"/>
        <gc-inventory-picker [id]="'ingredient-unit-'+line.key" kind="unit" label="Unidad"
         [value]="line.unidadId" [selectedLabel]="line.unidadNombre"
         [unitDimension]="line.dimension"
         [disabled]="!access.canManage()" (valueChange)="changeIngredient(i,{unidadId:$event,unidadNombre:''})"/>
        <label class="rec-field">Cantidad
         <input inputmode="decimal" [value]="line.cantidad" [disabled]="!access.canManage()"
          (input)="changeIngredient(i,{cantidad:$any($event.target).value})" placeholder="150"/>
        </label>
        <label class="rec-field">Pérdida estimada (%)
         <input inputmode="decimal" [value]="line.mermaPorcentaje" [disabled]="!access.canManage()"
          (input)="changeIngredient(i,{mermaPorcentaje:$any($event.target).value})" placeholder="0"/>
        </label>
       </div>
       @if(access.canManage()){<div class="rec-actions">
        <button type="button" (click)="removeIngredient(i)" [disabled]="busy()">Quitar ingrediente</button>
       </div>}
      </div>
     } @empty {<p class="rec-muted">Agrega el primer ingrediente para continuar.</p>}
     @for(message of validation();track message){<p class="rec-alert" role="alert">{{message}}</p>}
     @if(formulaError()){<p class="rec-alert" role="alert">{{formulaError()}}</p>}
     @if(access.canManage()){
      <div class="rec-actions">
       <label class="rec-inline">
        <input type="checkbox" [checked]="publishNow()" (change)="publishNow.set($any($event.target).checked)"
         [disabled]="!access.canPublish()"/> Publicar al guardar
       </label>
       <button type="button" class="rec-primary" [disabled]="busy()||validation().length>0||!name().trim()||!targetId()"
        (click)="saveFormula()">{{busy()?'Guardando…':isNew?'Crear receta':'Guardar fórmula'}}</button>
      </div>
     }
    </section>
   }
   @if(viewingVersion();as selected){
    <section class="rec-card">
     <div class="rec-top"><h2>Ingredientes · Versión {{selected.numero}}</h2>
      <button type="button" (click)="viewingVersion.set(null)">Cerrar</button></div>
     <div class="rec-table-wrap"><table class="rec-table">
      <thead><tr><th>Ingrediente</th><th>Cantidad</th><th>Pérdida estimada</th></tr></thead><tbody>
       @for(part of selected.recetaComponentesComoRecetaVersion??[];track part.id){
        <tr><td>{{part.articulo?.nombre??'Artículo no disponible'}}</td>
         <td>{{quantity(part.cantidad,part.unidad?.codigo)}}</td>
         <td>{{quantity(part.mermaPorcentaje,'%')}}</td></tr>
       }
      </tbody></table></div>
     @if(access.canPublish()&&!selected.publicadaEn&&page.data()?.activa){
      <button type="button" class="rec-primary" [disabled]="busy()" (click)="publishVersion(selected)">
       Publicar esta fórmula</button>
     }
    </section>
   }
  }
 </main>`,
 styleUrl:'../recipes.scss'
})
export class GcRecipesDetailPage implements OnInit,GcDirtyAware {
 protected readonly access=inject(RecipesAccess);
 private readonly api=inject(RecipesApi);
 private readonly catalog=inject(CatalogApi);
 private readonly inventory=inject(InventoryApi);
 private readonly router=inject(Router);
 private readonly route=inject(ActivatedRoute);
 private readonly confirm=inject(ConfirmDialogService);
 private readonly notify=inject(GcNotificationService);
 private readonly branch=inject(GcBranchContext);
 protected readonly isNew=this.route.snapshot.routeConfig?.path==='new';
 private readonly id=this.isNew?'':this.route.snapshot.paramMap.get('id')??'';
 protected readonly page=new GcPageState<RecipeRecord>();
 protected readonly name=signal('');
 protected readonly kind=signal<RecipeKind>('VENTA');
 protected readonly kindChoices=[
  {id:'VENTA',label:'Producto de la carta'},
  {id:'PRODUCCION',label:'Preparación de inventario'}
 ];
 protected readonly active=signal(true);
 protected readonly targetId=signal('');
 protected readonly variantSearch=signal('');
 protected readonly variants=signal<CatalogVariant[]>([]);
 protected readonly selectedVariant=signal<CatalogVariant|null>(null);
 protected readonly visibleVariants=computed(()=>{
  const all=[...this.variants()],saved=this.selectedVariant();
  if(saved&&!all.some(x=>x.id===saved.id))all.unshift(saved);
  return all;
 });
 protected readonly moreVariants=signal(false);
 protected readonly variantChoices=computed(()=>this.visibleVariants().map(v=>({
  id:v.id,label:v.label??(v.producto?.nombre+' · '+v.nombre)
 })));
 private readonly variantSearchTerms=new Subject<string>();
 private variantQueryGeneration=0;
 constructor(){
  this.variantSearchTerms.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed())
   .subscribe(term=>{this.variantSearch.set(term);void this.findVariants()});
 }
 protected queueVariantSearch(value:string){this.variantSearchTerms.next(value)}
 protected readonly editingFormula=signal(false);
 protected readonly formulaVersionId=signal<string|null>(null);
 protected readonly viewingVersion=signal<RecipeVersion|null>(null);
 protected readonly unitId=signal('');
 protected readonly unitLabel=signal('');
 protected readonly yieldAmount=signal('1');
 protected readonly shelfLife=signal('');
 protected readonly ingredients=signal<IngredientForm[]>([]);
 protected readonly publishNow=signal(false);
 protected readonly busy=signal(false);
 protected readonly formError=signal<string|null>(null);
 protected readonly formulaError=signal<string|null>(null);
 protected readonly destination=recipeDestination;
 protected readonly quantity=readableQuantity;
 protected readonly versions=computed(()=>this.page.data()?.recetaVersionesComoReceta??[]);
 /** The record's `versionPublicada` convenience field isn't reliably populated;
  *  every other published-version lookup in this file (e.g. startNewVersion)
  *  derives it from the versions list instead, so "Siguiente paso" does too. */
 protected readonly publishedVersion=computed(()=>
  this.versions().find(v=>v.activa&&v.publicadaEn)??null);
 protected readonly validation=computed(()=>validateFormula(this.versionDto(),this.kind()==='PRODUCCION'?this.targetId():undefined));
 private formulaInitial='';
 private saved=false;
 protected readonly formulaDirty=computed(()=>this.editingFormula()&&
  JSON.stringify(this.formulaSnapshot())!==this.formulaInitial);
 private nextKey=0;
 hasUnsavedChanges(){
  if(this.saved)return false;
  if(this.isNew)return !!this.name()||!!this.targetId()||this.ingredients().length>0;
  const saved=this.page.data();
  return !!saved&&(this.name()!==saved.nombre||this.active()!==saved.activa||this.formulaDirty());
 }
 private formulaSnapshot(){return {version:this.formulaVersionId(),unit:this.unitId(),
  amount:this.yieldAmount(),shelf:this.shelfLife(),ingredients:this.ingredients(),
  publish:this.publishNow()}}
 async ngOnInit(){
  if(this.isNew){
   await this.findVariants();
   const linked=this.route.snapshot.queryParamMap.get('varianteId');
   if(linked){
    try{
     const variant=await firstValueFrom(this.catalog.variant(linked));
     if(variant.activo&&variant.producto?.tipo==='PREPARADO'){
      this.selectedVariant.set(variant);this.targetId.set(variant.id);
     }
    }catch{/* The form remains usable if the linked product is no longer available. */}
   }
   return;
  }
  await this.reload();
 }
 /** Hands the published formula's identity to /recipes/check so it lands
  *  pre-selected instead of making the operator search for it again. */
 protected checkQueryParams(recipe:RecipeRecord,version:RecipeVersion){
  return {recetaId:recipe.id,recetaVersionId:version.id,
   varianteId:recipe.varianteId??'',nombre:recipe.nombre};
 }
 protected productionQueryParams(recipe:RecipeRecord,version:RecipeVersion){
  return {recetaId:recipe.id,recetaVersionId:version.id,nombre:recipe.nombre};
 }
 protected pageError(){return gcErrorMessage(this.page.error())}
 protected async reload(){
  await this.page.load(()=>firstValueFrom(this.api.detail(this.id)));
  const r=this.page.data();if(!r)return;
  this.name.set(r.nombre);this.kind.set(r.tipo);this.active.set(r.activa);
  this.targetId.set(r.tipo==='VENTA'?r.varianteId??'':r.articuloResultadoId??'');
  this.cancelFormula();this.viewingVersion.set(null);
  this.formulaInitial=JSON.stringify(this.formulaSnapshot());
 }
 protected changeKind(kind:string){
  this.kind.set(kind==='PRODUCCION'?'PRODUCCION':'VENTA');this.targetId.set('');
  this.selectedVariant.set(null);this.formError.set(null);
 }
 protected chooseVariant(id:string){
  this.targetId.set(id);
  this.selectedVariant.set(this.visibleVariants().find(x=>x.id===id)??null);
 }
 protected async chooseOutput(id:string){
  this.targetId.set(id);this.formError.set(null);
  if(!id)return;
  try{
   const article=await firstValueFrom(this.inventory.article(id));
   if(this.targetId()!==id)return;
   if(article.tipo!=='PREPARACION'&&article.tipo!=='PRODUCTO_TERMINADO'){
    this.targetId.set('');
    this.formError.set('Elige una preparación o un producto terminado del Inventario.');return;
   }
   this.unitId.set(article.unidadBase.id);
   this.unitLabel.set(article.unidadBase.nombre+' ('+article.unidadBase.codigo+')');
  }catch(e){this.formError.set(gcErrorMessage(e))}
 }
 protected async findVariants(){
  const g=++this.variantQueryGeneration;
  try{
   const result=await firstValueFrom(this.catalog.variantOptions({search:this.variantSearch().trim(),limit:50}));
   if(g!==this.variantQueryGeneration)return;
   const options=result.data.filter(x=>x.activo&&x.producto?.tipo==='PREPARADO');
   this.variants.set(options);this.moreVariants.set(result.meta.hasMore);
  }catch(e){if(g===this.variantQueryGeneration)this.formError.set(gcErrorMessage(e))}
 }
 protected async saveRecipe(event:Event){
  event.preventDefault();
  if(this.isNew||!this.access.canManage()||this.busy())return;
  if(this.formulaDirty()){
   this.formError.set('Guarda la fórmula o cierra su edición antes de cambiar los datos generales.');return;
  }
  const original=this.page.data();if(!original)return;
  const changes={
   ...(this.name().trim()!==original.nombre?{nombre:this.name().trim()}:{}),
   ...(this.active()!==original.activa?{activa:this.active()}:{})
  };
  if(!Object.keys(changes).length)return;
  this.busy.set(true);this.formError.set(null);
  try{await firstValueFrom(this.api.update(original.id,changes));await this.reload();
   this.notify.show('Receta actualizada.','success')}
  catch(e){this.formError.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
 protected addIngredient(){
  this.ingredients.update(a=>[...a,{key:++this.nextKey,articuloId:'',articuloNombre:'',
   unidadId:'',unidadNombre:'',dimension:'',cantidad:'',mermaPorcentaje:'0'}]);
 }
 protected changeIngredient(index:number,patch:Partial<IngredientForm>){
  this.ingredients.update(a=>a.map((x,i)=>i===index?{...x,...patch}:x));
 }
 protected removeIngredient(index:number){this.ingredients.update(a=>a.filter((_,i)=>i!==index))}
 protected async changeArticle(index:number,id:string){
  this.changeIngredient(index,{articuloId:id,articuloNombre:'',unidadId:'',unidadNombre:'',dimension:''});
  if(!id)return;
  try{
   const article=await firstValueFrom(this.inventory.article(id));
   if(this.ingredients()[index]?.articuloId===id){
    this.changeIngredient(index,{articuloNombre:article.nombre,
     unidadId:article.unidadBase.id,unidadNombre:article.unidadBase.nombre+' ('+article.unidadBase.codigo+')',
     dimension:article.unidadBase.dimension});
   }
  }catch{/* The picker still retains the selection and the server validates it on save. */}
 }
 private versionDto():RecipeVersionInput{
  return {unidadRendimientoId:this.unitId(),rendimiento:this.yieldAmount(),
   ...(this.shelfLife()!==''?{vidaUtilDias:Number(this.shelfLife())}:{}),
   componentes:this.ingredients().map(x=>({
    articuloId:x.articuloId,unidadId:x.unidadId,cantidad:x.cantidad,
    mermaPorcentaje:x.mermaPorcentaje
   })),publicar:this.publishNow()&&this.access.canPublish()};
 }
 protected async startNewVersion(){
  if(this.formulaDirty()){
   const ok=await this.confirm.confirm({title:'Descartar cambios de fórmula',
    message:'Se perderán los cambios que todavía no has guardado.',confirmText:'Continuar',danger:true});
   if(!ok)return;
  }
  const base=this.versions().find(x=>x.activa&&x.publicadaEn)??this.versions()[0];
  this.formulaVersionId.set(null);
  this.viewingVersion.set(null);
  this.loadVersion(base);
  this.editingFormula.set(true);this.publishNow.set(false);this.formulaError.set(null);
  this.formulaInitial=JSON.stringify(this.formulaSnapshot());
 }
 protected async selectVersion(v:RecipeVersion){
  if(this.formulaDirty()){
   const ok=await this.confirm.confirm({title:'Descartar cambios de fórmula',
    message:'Se perderán los cambios que todavía no has guardado.',confirmText:'Continuar',danger:true});
   if(!ok)return;
  }
  if(v.publicadaEn){this.viewingVersion.set(v);this.editingFormula.set(false);return}
  if(!this.access.canManage()){this.viewingVersion.set(v);return}
  this.viewingVersion.set(null);this.formulaVersionId.set(v.id);
  this.loadVersion(v);this.editingFormula.set(true);this.publishNow.set(false);
  this.formulaError.set(null);
  this.formulaInitial=JSON.stringify(this.formulaSnapshot());
 }
 private loadVersion(v?:RecipeVersion){
  this.unitId.set(v?.unidadRendimientoId??'');
  this.unitLabel.set(v?.unidadRendimiento?.nombre??'');
  this.yieldAmount.set(v?.rendimiento??'1');
  this.shelfLife.set(v?.vidaUtilDias===null||v?.vidaUtilDias===undefined?'':String(v.vidaUtilDias));
  this.ingredients.set((v?.recetaComponentesComoRecetaVersion??[]).map(x=>({
   key:++this.nextKey,articuloId:x.articuloId,articuloNombre:x.articulo?.nombre??'',
   unidadId:x.unidadId,unidadNombre:x.unidad?.nombre??'',
   dimension:x.articulo?.unidadBase?.dimension??'',
   cantidad:x.cantidad,mermaPorcentaje:x.mermaPorcentaje
  })));
 }
 protected async discardFormula(){
  if(this.formulaDirty()){
   const ok=await this.confirm.confirm({title:'Cerrar la fórmula',
    message:'Se perderán los cambios que todavía no has guardado.',confirmText:'Cerrar',danger:true});
   if(!ok)return;
  }
  this.cancelFormula();
 }
 protected cancelFormula(){
  this.editingFormula.set(false);this.formulaVersionId.set(null);
  this.publishNow.set(false);this.loadVersion();
 }
 protected async saveFormula(){
  if(!this.access.canManage()||this.busy()||!this.targetId()||!this.name().trim())return;
  if(this.validation().length)return;
  const original=this.page.data();
  if(!this.isNew&&original&&(this.name()!==original.nombre||this.active()!==original.activa)){
   this.formulaError.set('Guarda primero el nombre y el estado de la receta.');return;
  }
  this.busy.set(true);this.formulaError.set(null);
  try{
   const dto=normalizeFormula(this.versionDto());
   if(this.isNew){
    const recipe=await firstValueFrom(this.api.create({
     nombre:this.name().trim(),tipo:this.kind(),
     ...(this.kind()==='VENTA'?{varianteId:this.targetId()}:{articuloResultadoId:this.targetId()}),
     version:dto
    }));
    this.saved=true;
    await this.router.navigate(['/recipes/list',recipe.id]);
   }else{
    const id=this.formulaVersionId();
    if(id)await firstValueFrom(this.api.editVersion(id,dto));
    else await firstValueFrom(this.api.addVersion(this.id,dto));
    await this.reload();
    this.notify.show('Fórmula guardada.','success');
   }
  }catch(e){this.formulaError.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
 protected async unpublishVersion(v:RecipeVersion){
  if(!v.activa||!v.publicadaEn||!this.access.canPublish()||this.busy()||this.hasUnsavedChanges())return;
  const ok=await this.confirm.confirm({title:'Retirar fórmula de uso',
   message:'Esta fórmula dejará de utilizarse en nuevas preparaciones. Se conservará su historial.',
   confirmText:'Retirar fórmula',danger:true});
  if(!ok)return;
  this.busy.set(true);this.formulaError.set(null);
  try{await firstValueFrom(this.api.unpublish(v.id));await this.reload();
   this.notify.show('La fórmula ya no está disponible para nuevas preparaciones.','success')}
  catch(e){this.formulaError.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
 protected async discardVersion(v:RecipeVersion){
  if(v.publicadaEn||v.activa||!this.access.canManage()||this.busy()||this.hasUnsavedChanges())return;
  const ok=await this.confirm.confirm({title:'Descartar borrador',
   message:'Se eliminará definitivamente esta fórmula sin publicar. Esta acción no se puede deshacer.',
   confirmText:'Descartar borrador',danger:true});
  if(!ok)return;
  this.busy.set(true);this.formulaError.set(null);
  try{await firstValueFrom(this.api.discardVersion(v.id));await this.reload();
   this.notify.show('Borrador descartado.','success')}
  catch(e){this.formulaError.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
 protected async publishVersion(v:RecipeVersion){
  if(!this.access.canPublish()||v.publicadaEn||this.busy())return;
  if(this.formulaDirty()){
   this.formulaError.set('Guarda o descarta los cambios antes de publicar otra fórmula.');return;
  }
  const ok=await this.confirm.confirm({title:'Publicar fórmula',
   message:'La fórmula publicada se utilizará en nuevas preparaciones y ya no podrá editarse.',
   confirmText:'Publicar'});
  if(!ok)return;
  this.busy.set(true);this.formulaError.set(null);
  try{await firstValueFrom(this.api.publish(v.id));await this.reload();
   this.notify.show('Fórmula publicada.','success')}
  catch(e){this.formulaError.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
}
