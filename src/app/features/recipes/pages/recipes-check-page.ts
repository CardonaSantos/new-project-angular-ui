import {Component,computed,inject,signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Subject,debounceTime,distinctUntilChanged} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {InventoryApi} from '../../inventory/data-access/inventory.api';
import {CatalogApi} from '../../catalog/data-access/catalog.api';
import type {CatalogGroup} from '../../catalog/data-access/catalog.models';
import type {Warehouse} from '../../inventory/data-access/inventory.models';
import {parseApiDecimal,toApiDecimal} from '../../../shared/formatting';
import {RecipesApi} from '../data-access/recipes.api';
import {RecipesAccess} from '../data-access/recipes-access';
import type {RecipeOption,PackagingMode,RecipeStockPreview} from '../data-access/recipes.models';
import {PACKAGING_MODES} from '../data-access/recipes.models';
import {GcRecipesNav} from '../recipes-nav';
import {GcRecipeStockPreview} from '../components/recipe-stock-preview';
@Component({
 selector:'gc-recipes-check-page',imports:[GcRecipesNav,GcInventoryPicker,GcSearchSelect,GcRecipeStockPreview],
 template:`<main class="rec-page"><gc-recipes-nav/>
 <section class="rec-card">
  <div class="rec-top"><h2>Comprobar ingredientes de la carta</h2></div>
  <p class="rec-note">Comprueba cuántos ingredientes se necesitarían para preparar un producto, incluidos los extras y los materiales de entrega. No registra un pedido ni descuenta existencias.</p>
  @if(arrivedFromRecipe()){<p class="rec-note"><strong>Receta preseleccionada</strong> desde su ficha. Elige una sucursal para continuar.</p>}

  <div class="rec-section">
   <h3>1. Producto y sucursal</h3>
   <div class="rec-form">
    <gc-search-select id="check-branch" label="Sucursal" [items]="branchChoices()"
     [value]="branchId()" [clearable]="false" (valueChange)="chooseBranch($event)"/>
    <gc-search-select id="check-recipe" label="Producto y presentación"
     [items]="recipeChoices()" [value]="recipeId()" [remote]="true"
     [loading]="searchBusy()" placeholder="Buscar receta publicada…"
     (searchChange)="queueRecipeSearch($event)" (valueChange)="chooseRecipe($event)"/>
   </div>
  </div>
  <div class="rec-section">
   <h3>2. Cantidad y origen de los ingredientes</h3>
   <div class="rec-form">
    <label class="rec-field">Unidades a preparar
     <input inputmode="decimal" [value]="amount()" (input)="amount.set($any($event.target).value);clear()"/>
    </label>
    <gc-search-select id="check-mode" label="Forma de entrega" [items]="modeChoices"
     [value]="mode()" [searchable]="false" [clearable]="false"
     (valueChange)="setMode($event)"/>
    <gc-search-select id="check-warehouse" label="Almacén" [items]="warehouseChoices()"
     [value]="warehouseId()" [disabled]="!branchId()"
     (valueChange)="warehouseId.set($event);locationId.set('');clear()"/>
    <gc-inventory-picker id="quote-location" kind="location" label="Ubicación de ingredientes"
     [warehouseId]="warehouseId()" [branchId]="branchId()" [value]="locationId()"
     [disabled]="!warehouseId()" (valueChange)="locationId.set($event);clear()"/>
   </div>
  </div>
  @if(groups().length){
   <h3>3. Extras disponibles</h3>
   @for(group of groups();track group.id){
    <div class="rec-line">
     <strong>{{group.nombre}}</strong>
     @for(extra of group.modificadoresComoGrupo??[];track extra.id){
      @if(extra.activo){
       <label class="rec-inline">
        <input type="checkbox" [checked]="selectedExtras().includes(extra.id)"
         (change)="toggleExtra(extra.id,$any($event.target).checked)"/>
        {{extra.nombre}}
       </label>
      }
     }
    </div>
   }
  }
  @if(error()){<p class="rec-alert" role="alert">{{error()}}</p>}
  <div class="rec-actions">
   <button type="button" class="rec-primary" [disabled]="!valid()||busy()" (click)="calculate()">
    {{busy()?'Comprobando…':'Comprobar ingredientes'}}</button>
  </div>
 </section>
 @if(result();as r){
  <section class="rec-card">
   <gc-recipe-stock-preview [result]="r" [canSeeCosts]="access.canSeeCosts()"
    note="Esta comprobación no reserva ingredientes ni crea ventas."/>
  </section>
 }
 </main>`,styleUrl:'../recipes.scss'
})
export class GcRecipesCheckPage {
 protected readonly branches=inject(GcBranchContext);
 protected readonly access=inject(RecipesAccess);
 private readonly api=inject(RecipesApi);
 private readonly inventory=inject(InventoryApi);
 private readonly catalog=inject(CatalogApi);
 protected readonly recipes=signal<RecipeOption[]>([]);
 protected readonly recipeChoices=computed(()=>this.recipes().map(r=>({id:r.id,
  label:r.label+(r.destino?.presentacion?' · '+r.destino.presentacion:'')})));
 protected readonly branchChoices=computed(()=>this.branches.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly warehouseChoices=computed(()=>this.warehouses().map(w=>({id:w.id,label:w.nombre})));
 protected readonly modeChoices=PACKAGING_MODES.map(m=>({id:m.value,label:m.label}));
 protected readonly searchBusy=signal(false);
 protected readonly arrivedFromRecipe=signal(false);
 private readonly route=inject(ActivatedRoute);
 private readonly recipeSearchTerms=new Subject<string>();
 private recipeQueryGeneration=0;
 constructor(){
  this.recipeSearchTerms.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed())
   .subscribe(term=>{this.search.set(term);void this.loadRecipes()});
  void this.loadRecipes();
  // Arriving from a recipe's "Siguiente paso" link: preselect it instead of
  // making the operator search for the same recipe they just came from.
  const qp=this.route.snapshot.queryParamMap;
  const recetaId=qp.get('recetaId'),recetaVersionId=qp.get('recetaVersionId');
  if(recetaId&&recetaVersionId){
   this.recipes.update(list=>[{id:recetaId,label:qp.get('nombre')||'Receta seleccionada',
    tipo:'VENTA',activa:true,versionActiva:null,versionActivaId:recetaVersionId,
    destino:{id:qp.get('varianteId')||null,nombre:''},rendimiento:null},...list]);
   this.arrivedFromRecipe.set(true);
   void this.chooseRecipe(recetaId);
  }
 }
 protected queueRecipeSearch(value:string){this.recipeSearchTerms.next(value)}
 protected setMode(value:string){this.mode.set(value as PackagingMode);this.clear()}
 protected readonly recipeId=signal('');
 protected readonly search=signal('');
 protected readonly branchId=signal('');
 protected readonly warehouses=signal<Warehouse[]>([]);
 protected readonly warehouseId=signal('');
 protected readonly locationId=signal('');
 protected readonly amount=signal('1');
 protected readonly mode=signal<PackagingMode>('MESA');
 protected readonly modes=PACKAGING_MODES;
 protected readonly groups=signal<CatalogGroup[]>([]);
 protected readonly selectedExtras=signal<string[]>([]);
 protected readonly result=signal<RecipeStockPreview|null>(null);
 protected readonly busy=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly valid=computed(()=>{
  if(!this.branchId()||!this.locationId()||!this.recipes().find(x=>x.id===this.recipeId())?.versionActivaId)return false;
  try{return parseApiDecimal(this.amount()).gt(0)}catch{return false}
 });
 private generation=0;
 protected clear(){this.result.set(null)}
 protected async chooseBranch(id:string){
  const gen=++this.generation;
  this.branchId.set(id);this.warehouses.set([]);this.warehouseId.set('');this.locationId.set('');this.clear();
  if(!id)return;
  try{
   const r=await firstValueFrom(this.inventory.warehouses({sucursalId:id,page:1,limit:100,activo:true}));
   if(gen===this.generation)this.warehouses.set(r.data);
  }catch(e){if(gen===this.generation)this.error.set(gcErrorMessage(e))}
 }
 protected async loadRecipes(){
  const g=++this.recipeQueryGeneration;
  this.searchBusy.set(true);this.error.set(null);
  try{
   const r=await firstValueFrom(this.api.options({tipo:'VENTA',search:this.search().trim(),limit:50}));
   if(g!==this.recipeQueryGeneration)return;
   const previous=this.recipes().find(x=>x.id===this.recipeId());
   this.recipes.set(previous&&!r.data.some(x=>x.id===previous.id)?[previous,...r.data]:r.data);
  }catch(e){if(g===this.recipeQueryGeneration)this.error.set(gcErrorMessage(e))}
  finally{if(g===this.recipeQueryGeneration)this.searchBusy.set(false)}
 }
 protected async chooseRecipe(id:string){
  this.recipeId.set(id);this.selectedExtras.set([]);this.groups.set([]);this.clear();
  const selected=this.recipes().find(x=>x.id===id);
  if(!selected?.destino.id)return;
  const gen=++this.generation;
  try{
   const v=await firstValueFrom(this.catalog.variant(selected.destino.id));
   if(gen===this.generation)this.groups.set(v.varianteGrupoModificadoresComoVariante
    ?.flatMap(x=>x.grupo?[x.grupo]:[])??[]);
  }catch(e){if(gen===this.generation)this.error.set(gcErrorMessage(e))}
 }
 protected toggleExtra(id:string,checked:boolean){
  this.selectedExtras.update(current=>checked?[...current,id]:current.filter(x=>x!==id));this.clear();
 }
 protected async calculate(){
  const version=this.recipes().find(x=>x.id===this.recipeId())?.versionActivaId;
  if(!version||!this.valid())return;
  this.busy.set(true);this.error.set(null);this.result.set(null);
  try{this.result.set(await firstValueFrom(this.api.quote({
   recetaVersionId:version,sucursalId:this.branchId(),ubicacionId:this.locationId(),
   cantidad:toApiDecimal(this.amount()),modalidad:this.mode(),modificadores:this.selectedExtras()
  })))}
  catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
}
