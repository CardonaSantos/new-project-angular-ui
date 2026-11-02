import {Component,computed,effect,inject,signal} from '@angular/core';
import {Router,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {InventoryApi} from '../../inventory/data-access/inventory.api';
import type {Warehouse} from '../../inventory/data-access/inventory.models';
import {gcErrorMessage} from '../../../core/http/api-error';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {parseApiDecimal,formatDecimal,formatCurrency,toApiDecimal} from '../../../shared/formatting';
import type {GcDirtyAware} from '../../../core/ux/gc-unsaved-changes.guard';
import {RecipesAccess} from '../data-access/recipes-access';
import {RecipesApi} from '../data-access/recipes.api';
import type {RecipeOption,RecipeStockPreview,ProductionInput} from '../data-access/recipes.models';
import {GcRecipesNav} from '../recipes-nav';
@Component({
 selector:'gc-recipes-production-form-page',imports:[GcRecipesNav,RouterLink,GcInventoryPicker],
 template:`<main class="rec-page">
  <gc-recipes-nav/><a class="rec-link" routerLink="/recipes/production">Volver al historial</a>
  <section class="rec-card">
   <h2>Registrar producción</h2>
   <p class="rec-note">Prepara un lote para el inventario. Puedes guardarlo para revisar o confirmarlo directamente.</p>
   <div class="rec-form">
    <label class="rec-field">Sucursal
     <select [value]="branchId()" (change)="chooseBranch($any($event.target).value)" [disabled]="locked()||busy()">
      <option value="">Seleccionar sucursal</option>
      @for(b of branch.branches();track b.id){
       <option [value]="b.id" [selected]="b.id===branchId()">{{b.nombre}}</option>
      }
     </select>
    </label>
    <div class="rec-wide rec-form">
     <label class="rec-field">Buscar preparación
      <input [value]="search()" (input)="search.set($any($event.target).value)" maxlength="100"
       (keydown.enter)="$event.preventDefault();searchRecipes()" [disabled]="locked()||busy()"/>
     </label>
     <button type="button" (click)="searchRecipes()" [disabled]="locked()||busy()">Buscar</button>
     <label class="rec-field">Preparación
      <select [value]="recipeId()" (change)="chooseRecipe($any($event.target).value)" [disabled]="locked()||busy()">
       <option value="">Seleccionar una receta publicada</option>
       @for(r of visibleRecipes();track r.id){<option [value]="r.id" [selected]="r.id===recipeId()">
        {{r.label}}{{r.destino?.nombre?' · '+r.destino.nombre:''}}</option>}
      </select>
     </label>
    </div>
    @if(selectedRecipe();as r){
     <p class="rec-note rec-wide">La fórmula publicada rinde {{quantity(r.rendimiento?.cantidad,r.rendimiento?.unidad?.codigo)}}. Solo se utilizan versiones publicadas y activas.</p>
    }
    <label class="rec-field">Cantidad a producir
     <input [value]="amount()" (input)="amount.set($any($event.target).value);clearPreview()"
      [disabled]="locked()||busy()" inputmode="decimal" placeholder="1000"/>
    </label>
    <label class="rec-field">Almacén
     <select [value]="warehouseId()" (change)="chooseWarehouse($any($event.target).value)" [disabled]="locked()||busy()">
      <option value="">Seleccionar almacén</option>
      @for(w of warehouses();track w.id){<option [value]="w.id" [selected]="w.id===warehouseId()">{{w.nombre}}</option>}
     </select>
    </label>
    <gc-inventory-picker id="production-destination" label="Ubicación donde guardar el producto"
     kind="location" [warehouseId]="warehouseId()" [branchId]="branchId()"
     [value]="destinationId()" [disabled]="locked()||busy()" (valueChange)="destinationId.set($event);clearPreview()"/>
    <gc-inventory-picker id="production-origin" label="Ubicación desde la que consumir ingredientes"
     kind="location" [warehouseId]="warehouseId()" [branchId]="branchId()"
     [value]="originId()" [disabled]="locked()||busy()" (valueChange)="originId.set($event);clearPreview()"/>
    <label class="rec-field">Vencimiento (cuando corresponda)
     <input type="date" [value]="expiry()" (change)="expiry.set($any($event.target).value)"
      [disabled]="locked()||busy()"/>
    </label>
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
    <div class="rec-top"><h2>Ingredientes necesarios</h2>
     <strong>{{result.disponible===true?'Hay existencias suficientes':result.disponible===false?'Faltan ingredientes':'Revisión de ingredientes'}}</strong>
    </div>
    @if(result.insuficientes?.length){
     <div class="rec-table-wrap"><table class="rec-table">
      <thead><tr><th>Ingrediente</th><th>Necesario</th><th>Disponible</th><th>Faltante</th></tr></thead>
      <tbody>@for(x of result.insuficientes??[];track x.articuloId){
       <tr><td>{{x.articulo?.nombre??'Ingrediente'}}</td>
        <td>{{quantity(x.requerido,x.articulo?.unidadBase?.codigo)}}</td>
        <td>{{quantity(x.disponible,x.articulo?.unidadBase?.codigo)}}</td>
        <td>{{quantity(x.faltante,x.articulo?.unidadBase?.codigo)}}</td></tr>
      }</tbody></table></div>
    }
    <div class="rec-table-wrap"><table class="rec-table">
     <thead><tr><th>Ingrediente</th><th>Cantidad prevista</th><th>Ubicación</th><th>Lote</th>
      @if(result.costoEstimado!==undefined&&access.canSeeCosts()){<th>Costo estimado</th>}
     </tr></thead>
     <tbody>@for(x of result.consumos??[];track $index){
      <tr><td>{{x.articulo?.nombre??'Ingrediente'}}</td>
       <td>{{quantity(x.cantidad,x.articulo?.unidadBase?.codigo)}}</td>
       <td>{{x.ubicacion?.nombre??'Por determinar'}}</td>
       <td>{{x.lote?.codigoLote??'Sin lote'}}</td>
       @if(result.costoEstimado!==undefined&&access.canSeeCosts()){<td>{{x.costoTotal?currency(x.costoTotal):'—'}}</td>}
      </tr>
     } @empty {<tr><td colspan="5">No hay consumos calculados.</td></tr>}</tbody>
    </table></div>
    @if(result.costoEstimado!==undefined&&result.costoEstimado!==null&&access.canSeeCosts()){
     <p><strong>Costo estimado: {{currency(result.costoEstimado)}}</strong></p>}
    <p class="rec-note">Esta comprobación no reserva ingredientes ni descuenta inventario.</p>
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
 private readonly dialog=inject(ConfirmDialogService);
 protected readonly branchId=signal('');
 protected readonly recipeId=signal('');
 protected readonly recipes=signal<RecipeOption[]>([]);
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
 protected readonly currency=formatCurrency;
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
 constructor(){effect(()=>{
  const selected=this.branch.branchId();
  if(selected&&!this.branchId())void this.chooseBranch(selected);
 })}
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
  try{
   const r=await firstValueFrom(this.api.options({tipo:'PRODUCCION',search:this.search().trim(),limit:50}));
   const selected=this.selectedRecipe();
   this.recipes.set(selected&&!r.data.some(x=>x.id===selected.id)?[selected,...r.data]:r.data);
  }catch(e){this.error.set(gcErrorMessage(e))}
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
