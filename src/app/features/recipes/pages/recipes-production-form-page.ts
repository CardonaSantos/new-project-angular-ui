import {Component,computed,effect,inject,signal} from '@angular/core';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {firstValueFrom,Subject,debounceTime,distinctUntilChanged} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {InventoryApi} from '../../inventory/data-access/inventory.api';
import type {Warehouse} from '../../inventory/data-access/inventory.models';
import {gcErrorMessage} from '../../../core/http/api-error';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {parseApiDecimal,formatDecimal,toApiDecimal} from '../../../shared/formatting';
import type {GcDirtyAware} from '../../../core/ux/gc-unsaved-changes.guard';
import {RecipesAccess} from '../data-access/recipes-access';
import {RecipesApi} from '../data-access/recipes.api';
import type {RecipeOption,RecipeStockPreview,ProductionInput} from '../data-access/recipes.models';
import {GcRecipesNav} from '../recipes-nav';
import {GcRecipeStockPreview} from '../components/recipe-stock-preview';
@Component({
 selector:'gc-recipes-production-form-page',
 imports:[GcRecipesNav,RouterLink,GcInventoryPicker,GcSearchSelect,GcRecipeStockPreview],
 template:`<main class="rec-page">
  <gc-recipes-nav/><a class="rec-link" routerLink="/recipes/production">Volver al historial</a>
  <section class="rec-card">
   <h2>Registrar producción</h2>
   <p class="rec-note">Esto es un paso manual: prepara por adelantado un lote de un semi-elaborado (ej. una salsa) para que quede disponible en Inventario y otras recetas puedan usarlo como ingrediente. No se dispara solo desde una venta ni desde el POS — regístralo cuando cocina vaya a preparar el lote.</p>
   <p class="rec-note"><strong>Guardar para revisar</strong> deja la producción pendiente, sin tocar el inventario todavía. <strong>Confirmar producción</strong> descuenta los ingredientes y suma el resultado al inventario de inmediato.</p>
   @if(arrivedFromRecipe()){<p class="rec-note"><strong>Preparación preseleccionada</strong> desde su ficha. Elige la sucursal y ubicación para continuar.</p>}

   <div class="rec-section">
    <h3>1. Preparación a producir</h3>
    <div class="rec-form">
     <gc-search-select id="production-branch" label="Sucursal" [items]="branchChoices()"
      [value]="branchId()" [clearable]="false" [disabled]="locked()||busy()"
      (valueChange)="chooseBranch($event)"/>
     <gc-search-select id="production-recipe" label="Preparación publicada"
      [items]="recipeChoices()" [value]="recipeId()" [remote]="true"
      [loading]="searchBusy()" [disabled]="locked()||busy()"
      placeholder="Buscar preparación…"
      (searchChange)="queueRecipeSearch($event)" (valueChange)="chooseRecipe($event)"/>
    </div>
    @if(selectedRecipe();as r){
     <p class="rec-note">La fórmula publicada rinde {{quantity(r.rendimiento?.cantidad,r.rendimiento?.unidad?.codigo)}}. Solo se utilizan versiones publicadas y activas.</p>
    }
   </div>
   <div class="rec-section">
    <h3>2. Cantidad y ubicación física</h3>
    <div class="rec-form">
     <label class="rec-field">Cantidad a producir
      <input [value]="amount()" (input)="amount.set($any($event.target).value);clearPreview()"
       [disabled]="locked()||busy()" inputmode="decimal" placeholder="1000"/>
     </label>
     <gc-search-select id="production-warehouse" label="Almacén" [items]="warehouseChoices()"
      [value]="warehouseId()" [disabled]="locked()||busy()||!branchId()"
      (valueChange)="chooseWarehouse($event)"/>
     <gc-inventory-picker id="production-destination" label="Ubicación donde guardar el producto"
      kind="location" [warehouseId]="warehouseId()" [branchId]="branchId()"
      [value]="destinationId()" [disabled]="locked()||busy()||!warehouseId()"
      (valueChange)="destinationId.set($event);clearPreview()"/>
     <gc-inventory-picker id="production-origin" label="Ubicación desde la que consumir ingredientes"
      kind="location" [warehouseId]="warehouseId()" [branchId]="branchId()"
      [value]="originId()" [disabled]="locked()||busy()||!warehouseId()"
      (valueChange)="originId.set($event);clearPreview()"/>
     <label class="rec-field">Vencimiento (cuando corresponda)
      <input type="date" [value]="expiry()" (change)="expiry.set($any($event.target).value)"
       [disabled]="locked()||busy()"/>
     </label>
    </div>
   </div>
   <p class="rec-note">La cantidad se registra en la unidad base del artículo producido. Si dejas el origen vacío, se utilizará la ubicación de destino.</p>
   @if(!access.canProduce()){<p class="rec-alert">No tienes permiso para registrar producción en esta sucursal.</p>}
   @if(error()){<p class="rec-alert" role="alert">{{error()}}</p>}
   <div class="rec-actions">
    <button type="button" [disabled]="!canSubmit()||busy()||locked()" (click)="checkStock()">Comprobar ingredientes</button>
    <button type="button" [disabled]="!canSubmit()||busy()" (click)="submit('draft')">Guardar para revisar</button>
    <button type="button" class="rec-primary" [disabled]="!canSubmit()||busy()" (click)="submit('execute')">
     {{locked()?'Reintentar registro':'Confirmar producción'}}</button>
   </div>
   @if(locked()){
    <p class="rec-alert">No se pudo confirmar la respuesta anterior. Si reintentas, enviaremos exactamente la misma operación para evitar duplicados.</p>
    <button type="button" (click)="resetAttempt()" [disabled]="busy()">Cambiar los datos</button>
   }
  </section>
  @if(preview();as result){
   <section class="rec-card">
    <gc-recipe-stock-preview [result]="result" [canSeeCosts]="access.canSeeCosts()" [showLots]="true"
     title="Ingredientes necesarios"/>
   </section>
  }
 </main>`,styleUrl:'../recipes.scss'
})
export class GcRecipesProductionFormPage implements GcDirtyAware {
 protected readonly branch=inject(GcBranchContext);
 protected readonly access=inject(RecipesAccess);
 private readonly api=inject(RecipesApi);
 private readonly inventory=inject(InventoryApi);
 private readonly router=inject(Router);
 private readonly route=inject(ActivatedRoute);
 private readonly dialog=inject(ConfirmDialogService);
 protected readonly arrivedFromRecipe=signal(false);
 protected readonly branchId=signal('');
 protected readonly recipeId=signal('');
 protected readonly recipes=signal<RecipeOption[]>([]);
 protected readonly recipeChoices=computed(()=>this.recipes().map(r=>({id:r.id,
  label:r.label+(r.destino?.nombre?' · '+r.destino.nombre:'')})));
 protected readonly branchChoices=computed(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly warehouseChoices=computed(()=>this.warehouses().map(w=>({id:w.id,label:w.nombre})));
 protected readonly searchBusy=signal(false);
 private readonly recipeSearchTerms=new Subject<string>();
 private recipeQueryGeneration=0;
 protected queueRecipeSearch(value:string){this.recipeSearchTerms.next(value)}
 protected readonly selectedRecipe=computed(()=>this.recipes().find(x=>x.id===this.recipeId())??null);
 protected readonly visibleRecipes=computed(()=>this.recipes());
 protected readonly search=signal('');
 protected readonly warehouses=signal<Warehouse[]>([]);
 protected readonly warehouseId=signal('');
 protected readonly destinationId=signal('');
 protected readonly originId=signal('');
 protected readonly amount=signal('1');
 protected readonly expiry=signal('');
 protected readonly busy=signal(false);
 protected readonly locked=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly preview=signal<RecipeStockPreview|null>(null);
 protected readonly quantity=(n:string|null|undefined,u?:string)=>{
  try{return n?formatDecimal(n)+' '+(u??''):'—'}catch{return '—'}
 };
 private pending:{mode:'draft'|'execute';payload:ProductionInput}|null=null;
 private saved=false;
 private generation=0;
 protected readonly canSubmit=computed(()=>{
  if(!this.access.canProduce()||!this.branchId()||!this.selectedRecipe()?.versionActivaId||
   !this.destinationId()||!this.warehouseId())return false;
  try{return parseApiDecimal(this.amount()).gt(0)}catch{return false}
 });
 constructor(){
  effect(()=>{
   const selected=this.branch.branchId();
   if(selected&&!this.branchId())void this.chooseBranch(selected);
  });
  this.recipeSearchTerms.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed())
   .subscribe(term=>{this.search.set(term);void this.searchRecipes()});
  void this.searchRecipes();
  // Arriving from a recipe's "Siguiente paso" link: preselect it instead of
  // making the operator search for the same preparation they just came from.
  const qp=this.route.snapshot.queryParamMap;
  const recetaId=qp.get('recetaId'),recetaVersionId=qp.get('recetaVersionId');
  if(recetaId&&recetaVersionId){
   this.recipes.update(list=>[{id:recetaId,label:qp.get('nombre')||'Preparación seleccionada',
    tipo:'PRODUCCION',activa:true,versionActiva:null,versionActivaId:recetaVersionId,
    destino:{id:null,nombre:''},rendimiento:null},...list]);
   this.arrivedFromRecipe.set(true);
   this.chooseRecipe(recetaId);
  }
 }
 hasUnsavedChanges(){return !this.saved&&!!(this.recipeId()||this.destinationId()||this.originId()||this.expiry()||this.pending)}
 protected clearPreview(){this.preview.set(null)}
 protected async chooseBranch(id:string){
  if(this.locked())return;
  this.branchId.set(id);this.warehouseId.set('');this.destinationId.set('');this.originId.set('');
  this.preview.set(null);this.error.set(null);
  if(!id){this.warehouses.set([]);return}
  const g=++this.generation;
  try{
   const data=await firstValueFrom(this.inventory.warehouses({sucursalId:id,limit:100,page:1,activo:true}));
   if(g===this.generation)this.warehouses.set(data.data);
  }catch(e){if(g===this.generation)this.error.set(gcErrorMessage(e))}
 }
 protected chooseWarehouse(id:string){
  this.warehouseId.set(id);this.destinationId.set('');this.originId.set('');this.clearPreview();
 }
 protected async searchRecipes(){
  const g=++this.recipeQueryGeneration;
  this.searchBusy.set(true);
  try{
   const r=await firstValueFrom(this.api.options({tipo:'PRODUCCION',search:this.search().trim(),limit:50}));
   if(g!==this.recipeQueryGeneration)return;
   const selected=this.selectedRecipe();
   this.recipes.set(selected&&!r.data.some(x=>x.id===selected.id)?[selected,...r.data]:r.data);
  }catch(e){if(g===this.recipeQueryGeneration)this.error.set(gcErrorMessage(e))}
  finally{if(g===this.recipeQueryGeneration)this.searchBusy.set(false)}
 }
 protected chooseRecipe(id:string){
  this.recipeId.set(id);this.clearPreview();this.error.set(null);
 }
 protected async checkStock(){
  const version=this.selectedRecipe()?.versionActivaId;
  if(!version||!this.branchId()||!this.destinationId())return;
  this.busy.set(true);this.error.set(null);this.preview.set(null);
  try{this.preview.set(await firstValueFrom(this.api.preview(version,{
   sucursalId:this.branchId(),ubicacionId:this.originId()||this.destinationId(),
   cantidad:toApiDecimal(this.amount())
  })))}
  catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
 protected async submit(mode:'draft'|'execute'){
  if(!this.canSubmit()||this.busy())return;
  if(this.pending&&this.pending.mode!==mode){
   this.error.set('Termina el intento anterior antes de cambiar de operación.');return;
  }
  if(!this.pending){
   const message=mode==='execute'?
    'Se descontarán los ingredientes y se registrará la nueva preparación en Inventario.':
    'La producción quedará pendiente hasta que la confirmes.';
   const confirmed=await this.dialog.confirm({
    title:mode==='execute'?'Confirmar producción':'Guardar producción pendiente',
    message,confirmText:mode==='execute'?'Registrar producción':'Guardar borrador'});
   if(!confirmed)return;
   this.pending={mode,payload:{
    recetaVersionId:this.selectedRecipe()!.versionActivaId!,
    ubicacionDestinoId:this.destinationId(),
    ...(this.originId()?{ubicacionConsumoId:this.originId()}:{}),
    cantidadProducida:toApiDecimal(this.amount()),
    ...(this.expiry()?{fechaVencimiento:this.expiry()}:{}),
    claveOperacion:'PROD:UI:'+crypto.randomUUID()
   }};
  }
  this.locked.set(true);this.busy.set(true);this.error.set(null);
  try{
   const doc=await firstValueFrom(this.pending.mode==='execute'?
    this.api.productionExecute(this.pending.payload):this.api.productionDraft(this.pending.payload));
   this.saved=true;await this.router.navigate(['/recipes/production',doc.id]);
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
 protected async resetAttempt(){
  const ok=await this.dialog.confirm({title:'Cambiar los datos',
   message:'Si la operación anterior llegó al servidor, podría haberse registrado aunque no recibieras respuesta. Comprueba primero el historial de producción.',
   confirmText:'Editar de nuevo',danger:true});
  if(!ok)return;
  this.pending=null;this.locked.set(false);this.preview.set(null);this.error.set(null);
 }
}
