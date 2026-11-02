import {Component,inject,OnInit,signal,computed} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {CatalogApi} from '../../catalog/data-access/catalog.api';
import {InventoryApi} from '../../inventory/data-access/inventory.api';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {GcRecipesNav} from '../recipes-nav';
import {RecipesAccess} from '../data-access/recipes-access';
import {RecipesApi} from '../data-access/recipes.api';
import {EFFECTS,type ModifierEffect,type ModifierComposition,type ModifierPhysicalInput} from '../data-access/recipes.models';
import type {CatalogModifier} from '../../catalog/data-access/catalog.models';
import type {GcDirtyAware} from '../../../core/ux/gc-unsaved-changes.guard';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {parseApiDecimal,toApiDecimal} from '../../../shared/formatting';
interface ExtraLine {
 key:number;articuloId:string;articuloLabel:string;unidadId:string;
 unidadLabel:string;cantidad:string;efecto:ModifierEffect;
 sustituyeArticuloId:string;sustituyeLabel:string;
}
@Component({
 selector:'gc-recipes-extras-page',imports:[GcRecipesNav,GcInventoryPicker],
 template:`<main class="rec-page">
  <gc-recipes-nav/>
  <section class="rec-card">
   <div class="rec-top"><h2>Ingredientes de extras</h2>
    <a class="rec-link" href="/catalog/extras">Administrar extras</a></div>
   <p class="rec-note">Aquí se definen los ingredientes que se agregan, retiran o cambian cuando alguien elige un extra. Los nombres y precios se administran en Catálogo.</p>
   <div class="rec-filters">
    <label class="rec-field">Buscar extra
     <input [value]="search()" (input)="search.set($any($event.target).value)" maxlength="120"
      (keydown.enter)="$event.preventDefault();applySearch()"/>
    </label><button type="button" (click)="applySearch()">Buscar</button>
   </div>
   @if(listBusy()){<p class="rec-muted" role="status">Cargando extras…</p>}
   @if(listError()){<p class="rec-alert" role="alert">{{listError()}}</p>}
   <div class="rec-table-wrap"><table class="rec-table">
    <thead><tr><th>Extra</th><th>Grupo</th><th>Estado</th><th></th></tr></thead><tbody>
     @for(mod of options();track mod.id){
      <tr><td><strong>{{mod.nombre}}</strong></td>
       <td>{{mod.grupo?.nombre??'Extra del catálogo'}}</td>
       <td>{{mod.activo?'Activo':'Inactivo'}}</td>
       <td><button type="button" (click)="choose(mod)">Ingredientes</button></td>
      </tr>
     } @empty {<tr><td colspan="4">No se encontraron extras.</td></tr>}
    </tbody>
   </table></div>
   <div class="rec-top rec-muted"><span>{{total()}} extras · Página {{page()}}</span>
    <div class="rec-actions">
     <button type="button" [disabled]="page()<=1" (click)="move(-1)">Anterior</button>
     <button type="button" [disabled]="page()*20>=total()" (click)="move(1)">Siguiente</button>
    </div>
   </div>
  </section>
  @if(selected();as mod){
   <section class="rec-card">
    <div class="rec-top"><h2>{{mod.nombre}}</h2>
     <span class="rec-muted">{{lines().length}} ingredientes configurados</span></div>
    <p class="rec-note">Configura únicamente los cambios que realiza este extra sobre la receta normal.</p>
    @for(item of lines();track item.key;let i=$index){
     <div class="rec-line">
      <div class="rec-line-grid">
       <label class="rec-field">Acción sobre la preparación
        <select [value]="item.efecto" [disabled]="!access.canManage()"
         (change)="changeLine(i,{efecto:$any($event.target).value})">
         @for(option of effects;track option.value){
          <option [value]="option.value" [selected]="option.value===item.efecto">{{option.label}}</option>
         }
        </select>
       </label>
       <gc-inventory-picker [id]="'extra-article-'+item.key" kind="article" label="Ingrediente"
        [value]="item.articuloId" [selectedLabel]="item.articuloLabel"
        [disabled]="!access.canManage()" (valueChange)="changeArticle(i,$event)"/>
       <gc-inventory-picker [id]="'extra-unit-'+item.key" kind="unit" label="Unidad"
        [value]="item.unidadId" [selectedLabel]="item.unidadLabel"
        [disabled]="!access.canManage()" (valueChange)="changeLine(i,{unidadId:$event,unidadLabel:''})"/>
       <label class="rec-field">Cantidad
        <input inputmode="decimal" [value]="item.cantidad" [disabled]="!access.canManage()"
         (input)="changeLine(i,{cantidad:$any($event.target).value})"/>
       </label>
       @if(item.efecto==='SUSTITUIR'){
        <gc-inventory-picker [id]="'extra-replace-'+item.key" kind="article" label="Ingrediente que se retira"
         [value]="item.sustituyeArticuloId" [selectedLabel]="item.sustituyeLabel"
         [disabled]="!access.canManage()" (valueChange)="changeLine(i,{sustituyeArticuloId:$event,sustituyeLabel:''})"/>
       }
      </div>
      @if(access.canManage()){<button type="button" (click)="removeLine(i)">Quitar ingrediente</button>}
     </div>
    } @empty {<p class="rec-muted">Este extra todavía no cambia ingredientes. Agrega uno para configurarlo.</p>}
    @for(message of validation();track message){<p class="rec-alert" role="alert">{{message}}</p>}
    @if(error()){<p class="rec-alert" role="alert">{{error()}}</p>}
    @if(access.canManage()){
     <div class="rec-actions">
      <button type="button" (click)="addLine()" [disabled]="busy()||lines().length>=100">Agregar ingrediente</button>
      <button type="button" class="rec-primary" [disabled]="busy()||validation().length>0||!dirty()" (click)="save()">
       {{busy()?'Guardando…':'Guardar composición'}}</button>
     </div>
    }
   </section>
  }
 </main>`,
 styleUrl:'../recipes.scss'
})
export class GcRecipesExtrasPage implements OnInit,GcDirtyAware{
 protected readonly access=inject(RecipesAccess);
 private readonly recipes=inject(RecipesApi);
 private readonly catalog=inject(CatalogApi);
 private readonly inventory=inject(InventoryApi);
 private readonly notify=inject(GcNotificationService);
 private readonly confirm=inject(ConfirmDialogService);
 protected readonly search=signal('');
 protected readonly page=signal(1);
 protected readonly total=signal(0);
 protected readonly options=signal<CatalogModifier[]>([]);
 protected readonly listBusy=signal(false);
 protected readonly listError=signal<string|null>(null);
 protected readonly selected=signal<ModifierComposition|null>(null);
 protected readonly lines=signal<ExtraLine[]>([]);
 protected readonly effects=EFFECTS;
 protected readonly busy=signal(false);
 protected readonly error=signal<string|null>(null);
 private original='';
 private key=0;
 protected readonly dirty=computed(()=>!!this.selected()&&JSON.stringify(this.lines())!==this.original);
 protected readonly validation=computed(()=>{
  const issues:string[]=[];const ids=new Set<string>();
  for(const item of this.lines()){
   if(!item.articuloId||!item.unidadId)issues.push('Elige un ingrediente y su unidad.');
   try{if(parseApiDecimal(item.cantidad).lte(0))issues.push('Las cantidades deben ser mayores que cero.')}
   catch{issues.push('Introduce cantidades válidas.')}
   if(ids.has(item.articuloId)&&item.articuloId)issues.push('Un ingrediente no puede repetirse.');
   ids.add(item.articuloId);
   if(item.efecto==='SUSTITUIR'&&(!item.sustituyeArticuloId||item.sustituyeArticuloId===item.articuloId))
    issues.push('Para cambiar un ingrediente, selecciona otro diferente al que se agrega.');
  }
  return [...new Set(issues)];
 });
 hasUnsavedChanges(){return this.dirty()}
 ngOnInit(){void this.load()}
 protected applySearch(){this.page.set(1);void this.load()}
 protected move(n:number){this.page.update(x=>Math.max(1,x+n));void this.load()}
 private async load(){
  this.listBusy.set(true);this.listError.set(null);
  try{const r=await firstValueFrom(this.catalog.modifiers({
   search:this.search().trim(),page:this.page(),limit:20
  }));this.options.set(r.data);this.total.set(r.meta.total)}
  catch(e){this.listError.set(gcErrorMessage(e))}
  finally{this.listBusy.set(false)}
 }
 protected async choose(mod:CatalogModifier){
  if(this.dirty()){
   const ok=await this.confirm.confirm({title:'Descartar cambios',
    message:'Se perderán los cambios de este extra que todavía no has guardado.',
    confirmText:'Continuar',danger:true});
   if(!ok)return;
  }
  this.busy.set(true);this.error.set(null);
  try{
   const item=await firstValueFrom(this.recipes.modifier(mod.id));
   this.selected.set(item);
   this.lines.set((item.modificadorComponentesComoModificador??[]).map(x=>({
    key:++this.key,articuloId:x.articuloId,articuloLabel:x.articulo?.nombre??'',
    unidadId:x.unidadId,unidadLabel:x.unidad?.nombre??'',cantidad:x.cantidad,
    efecto:x.efecto,sustituyeArticuloId:x.sustituyeArticuloId??'',
    sustituyeLabel:x.sustituyeArticulo?.nombre??''
   })));
   this.original=JSON.stringify(this.lines());
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
 protected changeLine(i:number,patch:Partial<ExtraLine>){
  this.lines.update(xs=>xs.map((x,j)=>i===j?{...x,...patch}:x))
 }
 protected async changeArticle(i:number,id:string){
  this.changeLine(i,{articuloId:id,articuloLabel:'',unidadId:'',unidadLabel:''});
  if(!id)return;
  try{
   const item=await firstValueFrom(this.inventory.article(id));
   if(this.lines()[i]?.articuloId===id)this.changeLine(i,{
    articuloLabel:item.nombre,unidadId:item.unidadBase.id,
    unidadLabel:item.unidadBase.nombre+' ('+item.unidadBase.codigo+')'
   });
  }catch{/* A readable fallback is provided by the shared picker. */}
 }
 protected addLine(){this.lines.update(x=>[...x,{
  key:++this.key,articuloId:'',articuloLabel:'',unidadId:'',unidadLabel:'',
  cantidad:'',efecto:'SUMAR',sustituyeArticuloId:'',sustituyeLabel:''
 }])}
 protected removeLine(i:number){this.lines.update(xs=>xs.filter((_,j)=>i!==j))}
 protected async save(){
  const selected=this.selected();if(!selected||!this.access.canManage()||this.busy()||this.validation().length)return;
  const ok=await this.confirm.confirm({title:'Actualizar ingredientes del extra',
   message:'La nueva composición se utilizará para futuras preparaciones.',confirmText:'Guardar'});
  if(!ok)return;
  this.busy.set(true);this.error.set(null);
  try{
   const dto:ModifierPhysicalInput[]=this.lines().map(x=>({
    articuloId:x.articuloId,unidadId:x.unidadId,cantidad:toApiDecimal(x.cantidad),efecto:x.efecto,
    ...(x.efecto==='SUSTITUIR'?{sustituyeArticuloId:x.sustituyeArticuloId}:{})
   }));
   const result=await firstValueFrom(this.recipes.setModifier(selected.id,dto));
   this.selected.set(result);
   this.lines.set((result.modificadorComponentesComoModificador??[]).map(x=>({
    key:++this.key,articuloId:x.articuloId,articuloLabel:x.articulo?.nombre??'',
    unidadId:x.unidadId,unidadLabel:x.unidad?.nombre??'',cantidad:x.cantidad,
    efecto:x.efecto,sustituyeArticuloId:x.sustituyeArticuloId??'',
    sustituyeLabel:x.sustituyeArticulo?.nombre??''
   })));
   this.original=JSON.stringify(this.lines());
   this.notify.show('Ingredientes del extra guardados.','success');
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
}
