import {Component,computed,effect,inject,input,output,signal,untracked} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {RecipesApi} from '../../recipes/data-access/recipes.api';
import {RecipesAccess} from '../../recipes/data-access/recipes-access';
import type {RecipeRecord,RecipeVersion,RecipeVersionInput,RecipeStockPreview} from '../../recipes/data-access/recipes.models';
import {InventoryApi} from '../../inventory/data-access/inventory.api';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {gcErrorMessage} from '../../../core/http/api-error';
import {recipeDraftIssues} from '../data-access/catalog-r3-validation';

interface Ingredient {
 key:number;articuloId:string;articuloNombre:string;unidadId:string;unidadNombre:string;
 cantidad:string;mermaPorcentaje:string;
}
/** Receta VENTA por presentación; NEVER calls stock posting or updates published versions in-place. */
@Component({
 selector:'gc-catalog-inline-recipe',
 imports:[GcInventoryPicker],
 template:`
 <section class="cat-inline-recipe" aria-label="Receta y consumo de ingredientes">
  <div class="cat-inline-recipe-header">
   <div><h3>Receta · {{variantName()||productName()}}</h3>
    <p class="cat-muted">Aquí defines qué ingredientes se descontarán cuando se procese la preparación.</p></div>
   @if(currentPublished()){<span class="cat-inline-recipe-published">Receta publicada</span>}
  </div>
  <div class="cat-inline-recipe-warning">
   <strong>Control de Inventario:</strong>
   Guardar una receta no descuenta stock. El consumo real se registra cuando Cocina procesa el pedido.
   Las órdenes previas conservan la versión de receta que utilizaron.
  </div>
  @if(loading()){<p role="status" class="cat-muted">Cargando receta y unidades…</p>}
  @if(loadError()){<p role="alert" class="cat-alert">{{loadError()}}</p>}
  @if(!access.canRead()){
   <p class="cat-muted">Necesitas permiso de consulta de Recetas para revisar la composición existente antes de modificarla.</p>
  }@else if(!loading()){
   @if(existing();as item){
    <div class="cat-inline-recipe-status">
     <strong>{{item.nombre}}</strong>
     @if(currentPublished();as version){
      <span>Versión {{version.numero}} publicada · Rinde {{version.rendimiento}} {{version.unidadRendimiento?.nombre??'unidades'}}</span>
     }@else{<span>Todavía no hay una fórmula publicada.</span>}
     @if(access.canManage()&&!editing()){
      <button type="button" class="gc-button gc-button--outline" (click)="startEditing()">Crear nueva versión</button>
     }
    </div>
   }
   @if((!existing()||editing())&&access.canManage()){
    <form class="cat-inline-recipe-form" novalidate (submit)="save($event)">
     <div class="cat-inline-recipe-yield">
      <label class="cat-inline-recipe-field">Rinde (porciones)
       <input inputmode="decimal" [value]="yieldAmount()" required [disabled]="saving()"
        (input)="yieldAmount.set($any($event.target).value)" placeholder="1"/></label>
      <gc-inventory-picker id="recipe-inline-yield-unit" kind="unit" unitDimension="UNIDAD"
       label="Unidad de rendimiento" [value]="yieldUnit()" [disabled]="saving()"
       (valueChange)="yieldUnit.set($event)"/>
     </div>
     <div class="cat-inline-recipe-ingredients-heading">
      <div>
       <h4>Ingredientes que se consumirán</h4>
       <p class="cat-muted">Añade cada artículo físico con su cantidad y unidad.</p>
      </div>
      <span class="cat-inline-recipe-counter" aria-live="polite">
       {{parts().length}} {{parts().length===1?'ingrediente':'ingredientes'}}
      </span>
     </div>
     @for(part of parts();track part.key;let i=$index){
      <fieldset class="cat-inline-recipe-line">
       <legend>Ingrediente {{i+1}}</legend>
       <div class="cat-inline-recipe-fields">
        <gc-inventory-picker [id]="'rec-article-'+part.key" kind="article" label="Artículo de Inventario"
         [value]="part.articuloId" [selectedLabel]="part.articuloNombre" [disabled]="saving()"
         (valueChange)="editPart(part.key,{articuloId:$event,articuloNombre:''})"/>
        <gc-inventory-picker [id]="'rec-unit-'+part.key" kind="unit" label="Unidad"
         [value]="part.unidadId" [selectedLabel]="part.unidadNombre" [disabled]="saving()"
         (valueChange)="editPart(part.key,{unidadId:$event,unidadNombre:''})"/>
        <label class="cat-inline-recipe-field">Cantidad
         <input inputmode="decimal" [disabled]="saving()" [value]="part.cantidad" required
          (input)="editPart(part.key,{cantidad:$any($event.target).value})"
          placeholder="Ej. 150"/></label>
        <button type="button" class="gc-button gc-button--outline" [disabled]="saving()||parts().length===1"
         (click)="removePart(part.key)" [attr.aria-label]="'Quitar ingrediente '+(i+1)">Quitar</button>
       </div>
       <details class="cat-inline-recipe-more">
        <summary>Merma (opcional)</summary>
        <label class="cat-inline-recipe-field">Porcentaje de merma
         <input inputmode="decimal" [value]="part.mermaPorcentaje" [disabled]="saving()"
          (input)="editPart(part.key,{mermaPorcentaje:$any($event.target).value})" placeholder="0"/></label>
       </details>
      </fieldset>
     }
     <div class="cat-inline-recipe-add-row">
      <button type="button" class="gc-button gc-button--outline cat-inline-recipe-add"
       aria-label="Agregar otro ingrediente a la receta"
       (click)="addIngredient()" [disabled]="saving()||parts().length>=100">
       + Agregar otro ingrediente
      </button>
     </div>
     <p class="cat-muted">Las cantidades corresponden al rendimiento indicado. El servidor calcula la proporción cuando se prepara una orden.</p>
     @if(access.canPublish()){
      <label class="cat-check"><input type="checkbox" [checked]="publishNow()" [disabled]="saving()"
       (change)="publishNow.set($any($event.target).checked)"/>
       Publicar esta fórmula para nuevas órdenes después de guardarla</label>
     }@else{
      <p class="cat-muted">Se guardará como borrador. Publicarla requiere permiso de publicación de Recetas.</p>
     }
     @if(problem()){<p role="alert" class="cat-alert">{{problem()}}</p>}
     <div class="cat-inline-recipe-actions">
      <button class="gc-button cat-inline-recipe-submit" type="submit" [disabled]="saving()">
       {{saving()?'Validando y guardando…':publishNow()?'Guardar y publicar receta':'Guardar receta como borrador'}}</button>
      @if(existing()){
       <button class="gc-button gc-button--outline" type="button"
        (click)="cancelEditing()" [disabled]="saving()">Cancelar edición</button>
      }
     </div>
    </form>
   }@else if(!access.canManage()){
    <p class="cat-muted">Tu cuenta tiene acceso de lectura. Solicita permiso para registrar o modificar ingredientes.</p>
   }
   @if(currentPublished();as published){
    <div class="cat-inline-recipe-check">
     @if(branch.branchId()){
      <button type="button" class="gc-button gc-button--outline" [disabled]="checking()" (click)="checkStock(published)">
       {{checking()?'Comprobando…':'Consultar consumo y disponibilidad'}}</button>
     }
     @if(preview();as result){
      @if(result.requiereUbicacion){<p class="cat-muted">Para verificar existencias hay que seleccionar una ubicación de consumo de la sucursal.</p>}
      @if(result.disponible===false){<p class="cat-alert" role="alert">Existencias insuficientes para preparar esta receta.</p>}
      @if(result.disponible===true){<p class="cat-muted">Los ingredientes consultados tienen existencias utilizables en el contexto evaluado.</p>}
      @for(item of result.insuficientes??[];track item.articuloId){
       <p class="cat-muted">{{item.articulo?.nombre??item.articuloId}} · Requerido {{item.requerido}} · Disponible {{item.disponible}}</p>
      }
     }
     @if(checkError()){<p role="alert" class="cat-alert">{{checkError()}}</p>}
    </div>
   }
  }
 </section>`,
 styles:[`
 .cat-inline-recipe{display:grid;gap:.7rem;border:1px solid var(--gc-outline-variant);
  padding:.75rem;border-radius:.7rem;min-width:0}
 .cat-inline-recipe-warning{border-left:3px solid var(--gc-primary);padding:.45rem .6rem;
  background:var(--gc-surface-container);font-size:.81rem}
 .cat-inline-recipe-published{font-size:.75rem;color:var(--gc-primary);font-weight:650}
 .cat-inline-recipe-status{display:flex;gap:.45rem;flex-wrap:wrap;align-items:center}
 .cat-inline-recipe-status>span{font-size:.78rem;color:var(--gc-on-surface-variant)}
 .cat-inline-recipe-form{display:grid;gap:.65rem}
 .cat-inline-recipe-yield{display:grid;grid-template-columns:minmax(0,180px) minmax(0,1fr);gap:.5rem}
 .cat-inline-recipe-field{display:grid;gap:.25rem;font-size:.8rem;font-weight:650;min-width:0}
 .cat-inline-recipe-field input{width:100%;min-width:0}
 .cat-inline-recipe-line{min-width:0;border:1px solid var(--gc-outline-variant);padding:.48rem;border-radius:.5rem}
 .cat-inline-recipe-line legend{padding:0 .3rem;font-size:.77rem;font-weight:650}
 .cat-inline-recipe-fields{display:grid;align-items:end;gap:.45rem;
  grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,110px) auto}
 .cat-inline-recipe-more{margin-top:.5rem}
 .cat-inline-recipe-more summary{cursor:pointer;font-size:.76rem;font-weight:650}
 .cat-inline-recipe-more>label{margin-top:.35rem;max-width:180px}
 .cat-inline-recipe-check{display:grid;gap:.35rem}
 .cat-inline-recipe-check p{margin:0}
 .cat-inline-recipe-header,.cat-inline-recipe-ingredients-heading{
  display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap}
 .cat-inline-recipe-header h3,.cat-inline-recipe-ingredients-heading h4{font-size:1rem;line-height:1.4;margin:0}
 .cat-inline-recipe-ingredients-heading{border-bottom:1px solid var(--gc-outline-variant);padding-bottom:.55rem}
 .cat-inline-recipe-ingredients-heading p{margin:.2rem 0 0}
 .cat-inline-recipe-counter{font-size:.85rem;color:var(--gc-on-surface-variant);white-space:nowrap}
 .cat-inline-recipe-form{gap:1rem}
 .cat-inline-recipe .cat-muted{color:var(--gc-on-surface-variant);font-size:.85rem;line-height:1.4}
 .cat-inline-recipe .cat-inline-recipe-field{font-size:.9rem;line-height:1.35}
 .cat-inline-recipe-field input{
  background:var(--gc-surface);color:var(--gc-on-surface);
  border:1px solid var(--gc-outline);border-radius:.5rem;
  min-height:44px;padding:.5rem .65rem;font-size:.95rem}
 .cat-inline-recipe .cat-check{display:flex;align-items:flex-start;gap:.6rem;line-height:1.4;font-size:.9rem}
 .cat-inline-recipe .cat-check input{width:18px;height:18px;flex:none;accent-color:var(--gc-primary);margin-top:.14rem}
 .cat-inline-recipe-line{padding:.7rem;display:grid;gap:.55rem}
 .cat-inline-recipe-line legend{font-size:.85rem}
 .cat-inline-recipe-add-row{display:flex;justify-content:flex-start;padding:.2rem 0}
 .cat-inline-recipe .gc-button{font-size:.9rem;min-height:44px;line-height:1.25}
 .cat-inline-recipe-add{border-style:dashed}
 .cat-inline-recipe-actions{display:flex;align-items:center;gap:.65rem;flex-wrap:wrap;
  padding-top:.8rem;border-top:1px solid var(--gc-outline-variant)}
 .cat-inline-recipe-submit{font-weight:700;min-width:225px}
 @media(max-width:560px){.cat-inline-recipe-actions>.gc-button{width:100%}
  .cat-inline-recipe-add{width:100%}}

 .cat-inline-recipe :is(input,button,summary):focus-visible{outline:2px solid var(--gc-primary);outline-offset:2px}
 @media(max-width:800px){.cat-inline-recipe-fields{grid-template-columns:repeat(2,minmax(0,1fr))}}
 @media(max-width:560px){.cat-inline-recipe-yield,.cat-inline-recipe-fields{grid-template-columns:1fr}}
 `]
})
export class GcCatalogInlineRecipe {
 readonly variantId=input.required<string>();
 readonly productName=input('');
 readonly variantName=input('');
 readonly updated=output<void>();
 readonly pendingChange=output<boolean>();
 protected readonly access=inject(RecipesAccess);
 protected readonly branch=inject(GcBranchContext);
 private readonly api=inject(RecipesApi);
 private readonly inventory=inject(InventoryApi);
 private readonly confirm=inject(ConfirmDialogService);
 private readonly notify=inject(GcNotificationService);
 protected readonly loading=signal(true);
 protected readonly loadError=signal('');
 protected readonly existing=signal<RecipeRecord|null>(null);
 protected readonly currentPublished=signal<RecipeVersion|null>(null);
 protected readonly editing=signal(false);
 protected readonly yieldUnit=signal('');
 protected readonly yieldAmount=signal('1');
 protected readonly parts=signal<Ingredient[]>([
  {key:1,articuloId:'',articuloNombre:'',unidadId:'',unidadNombre:'',cantidad:'',mermaPorcentaje:'0'}
 ]);
 protected readonly publishNow=signal(false);
 protected readonly signature=computed(()=>JSON.stringify({
  amount:this.yieldAmount(),unit:this.yieldUnit(),parts:this.parts(),
  publish:this.publishNow()
 }));
 private readonly baseline=signal('');
 protected readonly problem=signal('');
 protected readonly saving=signal(false);
 protected readonly checking=signal(false);
 protected readonly checkError=signal('');
 protected readonly preview=signal<RecipeStockPreview|null>(null);
 private nextKey=2;
 private generation=0;
 constructor(){
  effect(()=>{const id=this.variantId();untracked(()=>void this.load(id))});
  effect(()=>{
   this.pendingChange.emit(!this.loading()&&this.editing()&&
    this.signature()!==this.baseline());
  });
 }
 private async load(id:string){
  const gen=++this.generation;
  this.loading.set(true);this.loadError.set('');this.problem.set('');this.preview.set(null);
  this.existing.set(null);this.currentPublished.set(null);this.editing.set(false);
  if(!this.access.canRead()){this.loading.set(false);return}
  try{
   const result=await firstValueFrom(this.api.list({tipo:'VENTA',varianteId:id,limit:10}));
   if(gen!==this.generation)return;
   const existing=result.data.find(x=>x.varianteId===id);
   if(existing){
    const full=await firstValueFrom(this.api.detail(existing.id));
    if(gen!==this.generation)return;
    this.existing.set(full);
    const current=(full.recetaVersionesComoReceta??[]).find(v=>v.activa&&!!v.publicadaEn)??null;
    this.currentPublished.set(current);
   }else{
    this.editing.set(true);
   }
   const units=await firstValueFrom(this.inventory.unitOptions({dimension:'UNIDAD',limit:50}));
   if(gen!==this.generation)return;
   const base=units.data.find(x=>x.esBase)??units.data[0];
   this.yieldUnit.set(base?.id??'');
  }catch(e){if(gen===this.generation)this.loadError.set(gcErrorMessage(e))}
  finally{if(gen===this.generation){
   this.baseline.set(this.signature());this.loading.set(false);
  }}
 }
 private fillVersion(version:RecipeVersion|null){
  this.yieldAmount.set(version?.rendimiento??'1');
  if(version?.unidadRendimientoId)this.yieldUnit.set(version.unidadRendimientoId);
  this.parts.set(version?.recetaComponentesComoRecetaVersion?.length?
   version.recetaComponentesComoRecetaVersion.map(x=>({
    key:this.nextKey++,articuloId:x.articuloId,
    articuloNombre:x.articulo?.nombre??'',
    unidadId:x.unidadId,unidadNombre:x.unidad?.nombre??'',
    cantidad:x.cantidad,mermaPorcentaje:x.mermaPorcentaje
   })):
   [{key:this.nextKey++,articuloId:'',articuloNombre:'',unidadId:'',
     unidadNombre:'',cantidad:'',mermaPorcentaje:'0'}]);
 }
 protected startEditing(){
  this.fillVersion(this.currentPublished());
  this.publishNow.set(false);this.problem.set('');
  this.baseline.set(this.signature());this.editing.set(true);
 }
 protected cancelEditing(){this.editing.set(false);this.problem.set('')}
 protected addIngredient(){if(this.parts().length<100)this.parts.update(a=>[...a,{
  key:this.nextKey++,articuloId:'',articuloNombre:'',unidadId:'',
  unidadNombre:'',cantidad:'',mermaPorcentaje:'0'
 }])}
 protected editPart(key:number,patch:Partial<Ingredient>){
  this.parts.update(a=>a.map(x=>x.key===key?{...x,...patch}:x));
 }
 protected removePart(key:number){if(this.parts().length>1)this.parts.update(a=>a.filter(x=>x.key!==key))}
 private errors(){return recipeDraftIssues(this.dto());}

 private dto():RecipeVersionInput{
  return {rendimiento:this.yieldAmount().trim(),unidadRendimientoId:this.yieldUnit(),
   componentes:this.parts().map(p=>({
    articuloId:p.articuloId,unidadId:p.unidadId,cantidad:p.cantidad.trim(),
    mermaPorcentaje:p.mermaPorcentaje.trim()||'0'
   })),
   publicar:this.publishNow()&&this.access.canPublish()
  };
 }
 protected async save(event:Event){
  event.preventDefault();
  if(this.saving()||!this.access.canManage())return;
  const errors=this.errors();
  if(errors.length){this.problem.set([...new Set(errors)].join(' '));return}
  if(this.publishNow()){
   if(!this.access.canPublish()){this.problem.set('No tienes permiso para publicar recetas.');return}
   const yes=await this.confirm.confirm({
    title:'Publicar nueva versión de receta',
    message:'Las nuevas órdenes podrán consumir estas cantidades de Inventario. Las órdenes anteriores conservarán su versión. Comprueba ingredientes, unidades, rendimiento y merma antes de publicar.',
    confirmText:'Publicar receta'
   });
   if(!yes)return;
  }
  this.saving.set(true);this.problem.set('');
  try{
   const existing=this.existing();
   if(existing)await firstValueFrom(this.api.addVersion(existing.id,this.dto()));
   else await firstValueFrom(this.api.create({
    nombre:(this.productName()+' '+this.variantName()).trim().slice(0,160)||'Receta de venta',
    tipo:'VENTA',varianteId:this.variantId(),version:this.dto()
   }));
   this.notify.show('Fórmula guardada. Se respetan las versiones anteriores.','success');
   await this.load(this.variantId());
   this.updated.emit();
  }catch(e){this.problem.set(gcErrorMessage(e)+
   ' Comprueba las versiones antes de reintentar: una respuesta perdida no significa que se haya revertido el guardado.')}
  finally{this.saving.set(false)}
 }
 protected async checkStock(version:RecipeVersion){
  const branchId=this.branch.branchId();
  if(!branchId||this.checking())return;
  this.checking.set(true);this.checkError.set('');this.preview.set(null);
  try{this.preview.set(await firstValueFrom(this.api.preview(version.id,{sucursalId:branchId,cantidad:'1'})))}
  catch(e){this.checkError.set(gcErrorMessage(e))}
  finally{this.checking.set(false)}
 }
}
