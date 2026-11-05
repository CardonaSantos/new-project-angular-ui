import {Component,computed,effect,inject,input,output,signal} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {CatalogApi} from '../data-access/catalog.api';
import {CatalogAccess} from '../data-access/catalog-access';
import {RecipesAccess} from '../../recipes/data-access/recipes-access';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {gcErrorMessage} from '../../../core/http/api-error';
import {quickGroupIssues} from '../data-access/catalog-r3-validation';
import type {CatalogKind,CatalogQuickGroupSetup} from '../data-access/catalog.models';

interface IngredientRow {key:number;articuloId:string;unidadId:string;cantidad:string}
interface ChoiceRow {
 key:number;nombre:string;precio:string;consumo:boolean;ingredientes:IngredientRow[];
}
/** Compact, task-focused composer; stock posting stays in Orders/Kitchen, never here. */
@Component({
 selector:'gc-catalog-quick-extra-editor',
 imports:[GcInventoryPicker],
 template:`
 <section class="cat-quick-group" aria-label="Crear grupo completo de extras">
  <div class="cat-row"><h3>Nuevo grupo de extras</h3>
   <span class="cat-muted">Grupo, opciones y asociación en un solo guardado</span></div>
  <form (submit)="save($event)" class="cat-form" novalidate>
   <div class="cat-inline-grid">
    <label>Nombre del grupo
     <input maxlength="130" required [value]="groupName()" [disabled]="busy()"
      (input)="groupName.set($any($event.target).value)" placeholder="Ej. Toppings"/></label>
    <label>¿Cuántas opciones puede elegir?
     <select [value]="selectionMode()" [disabled]="busy()" (change)="selectionMode.set($any($event.target).value)">
      <option value="optional">Opcional (hasta 1)</option>
      <option value="required">Elegir 1 obligatoriamente</option>
      <option value="several">Varias opciones</option>
     </select></label>
    @if(selectionMode()==='several'){
     <label>Máximo de opciones
      <input type="number" min="1" max="30" [value]="maxChoices()" [disabled]="busy()"
       (input)="maxChoices.set(Number($any($event.target).value))"/></label>
    }
   </div>
   <div class="cat-row">
    <strong>Opciones que verá el cliente</strong>
    <button type="button" [disabled]="busy()||choices().length>=30" (click)="addChoice()">+ Opción</button>
   </div>
   <div class="cat-quick-group-options">
    @for(choice of choices();track choice.key;let index=$index){
     <fieldset class="cat-quick-group-choice">
      <legend>Opción {{index+1}}</legend>
      <div class="cat-quick-group-top">
       <label>Nombre
        <input [value]="choice.nombre" maxlength="130" required [disabled]="busy()"
         (input)="changeChoice(choice.key,{nombre:$any($event.target).value})"
         placeholder="Ej. Crema batida"/></label>
       <label>Recargo (Q)
        <input inputmode="decimal" [value]="choice.precio" required [disabled]="busy()"
         (input)="changeChoice(choice.key,{precio:$any($event.target).value})" placeholder="0.00"/></label>
       <button type="button" [disabled]="busy()||choices().length===1"
        [attr.aria-label]="'Quitar opción '+(index+1)" (click)="removeChoice(choice.key)">Quitar</button>
      </div>
      @if(prepared()&&recipeAccess.canManage()){
       <label class="cat-check"><input type="checkbox" [checked]="choice.consumo" [disabled]="busy()"
        (change)="setConsumption(choice.key,$any($event.target).checked)"/>
        Esta opción <strong>agrega ingredientes</strong> que se descontarán al preparar</label>
       @if(choice.consumo){
        <div class="cat-quick-group-ingredients">
         <p class="cat-muted">Define la cantidad adicional por cada unidad vendida. No se descuenta stock al guardar.</p>
         @for(part of choice.ingredientes;track part.key){
          <div class="cat-quick-group-ingredient">
           <gc-inventory-picker [id]="'extra-ing-'+choice.key+'-'+part.key" kind="article"
            label="Ingrediente" [value]="part.articuloId" [disabled]="busy()"
            (valueChange)="changeIngredient(choice.key,part.key,{articuloId:$event})"/>
           <gc-inventory-picker [id]="'extra-unit-'+choice.key+'-'+part.key" kind="unit"
            label="Unidad" [value]="part.unidadId" [disabled]="busy()"
            (valueChange)="changeIngredient(choice.key,part.key,{unidadId:$event})"/>
           <label>Cantidad que agrega
            <input inputmode="decimal" [disabled]="busy()" [value]="part.cantidad"
             (input)="changeIngredient(choice.key,part.key,{cantidad:$any($event.target).value})"
             placeholder="Ej. 0.010"/></label>
           <button type="button" [disabled]="busy()" (click)="removeIngredient(choice.key,part.key)"
            aria-label="Quitar ingrediente adicional">Quitar</button>
          </div>
         }
        </div>
        <button type="button" [disabled]="busy()||choice.ingredientes.length>=30"
         (click)="addIngredient(choice.key)">+ Ingrediente adicional</button>
       }
      }
     </fieldset>
    }
   </div>
   @if(problem()){<div class="cat-alert" role="alert">{{problem()}}</div>}
   <div class="cat-actions">
    <button class="cat-primary" type="submit" [disabled]="busy()||!access.canManage()">
     {{busy()?'Guardando…':variantId()?'Guardar y asignar al producto':'Guardar grupo y opciones'}}</button>
   </div>
  </form>
 </section>`,
 styles:[`
 .cat-quick-group{border:1px solid var(--gc-outline-variant);border-radius:.7rem;padding:.75rem;display:grid;gap:.7rem}
 .cat-quick-group-options{display:grid;gap:.55rem}
 .cat-quick-group-choice{border:1px solid var(--gc-outline-variant);border-radius:.55rem;min-width:0;padding:.55rem}
 .cat-quick-group-choice legend{font-weight:650;font-size:.8rem;padding:0 .3rem}
 .cat-quick-group-top{display:grid;grid-template-columns:minmax(0,1fr) 125px auto;gap:.5rem;align-items:end}
 .cat-quick-group-top label,.cat-quick-group-ingredient label{display:grid;gap:.3rem;font-size:.83rem;font-weight:600;min-width:0}
 .cat-quick-group-ingredients{display:grid;gap:.5rem}
 .cat-quick-group-ingredient{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) 125px auto;align-items:end;gap:.4rem}
 .cat-quick-group-ingredient input{width:100%;min-width:0}
 .cat-quick-group-choice :is(button,input,select):focus-visible{outline:2px solid var(--gc-primary);outline-offset:2px}
 @media(max-width:800px){.cat-quick-group-ingredient{grid-template-columns:repeat(2,minmax(0,1fr))}}
 @media(max-width:540px){.cat-quick-group-top,.cat-quick-group-ingredient{grid-template-columns:1fr}
  .cat-quick-group-choice button{min-height:40px;justify-self:start}}
 `]
})
export class GcCatalogQuickExtraEditor {
 readonly variantId=input('');
 readonly kind=input<CatalogKind>('PREPARADO');
 readonly saved=output<string>();
 readonly pendingChange=output<boolean>();
 protected readonly access=inject(CatalogAccess);
 protected readonly recipeAccess=inject(RecipesAccess);
 private readonly api=inject(CatalogApi);
 private readonly notifications=inject(GcNotificationService);
 protected readonly groupName=signal('');
 protected readonly selectionMode=signal('optional');
 protected readonly maxChoices=signal(2);
 protected readonly choices=signal<ChoiceRow[]>([{
  key:1,nombre:'',precio:'0.00',consumo:false,ingredientes:[]
 }]);
 protected readonly prepared=computed(()=>this.kind()==='PREPARADO');
 protected readonly busy=signal(false);
 protected readonly problem=signal('');
 protected readonly Number=Number;
 private nextChoice=2;
 private nextIngredient=1;
 private readonly original=JSON.stringify({name:'',mode:'optional',max:2,
  choices:[{key:1,nombre:'',precio:'0.00',consumo:false,ingredientes:[]}]});
 constructor(){
  effect(()=>{
   const value=JSON.stringify({name:this.groupName(),mode:this.selectionMode(),
    max:this.maxChoices(),choices:this.choices()});
   this.pendingChange.emit(value!==this.original);
  });
 }
 protected addChoice(){if(this.choices().length<30)this.choices.update(a=>[...a,{
  key:this.nextChoice++,nombre:'',precio:'0.00',consumo:false,ingredientes:[]
 }])}
 protected changeChoice(key:number,patch:Partial<ChoiceRow>){
  this.choices.update(a=>a.map(v=>v.key===key?{...v,...patch}:v));
 }
 protected removeChoice(key:number){
  if(this.choices().length>1)this.choices.update(a=>a.filter(v=>v.key!==key));
 }
 protected setConsumption(key:number,enabled:boolean){
  this.changeChoice(key,{consumo:enabled,
   ingredientes:enabled?[{key:this.nextIngredient++,articuloId:'',unidadId:'',cantidad:''}]:[]});
 }
 protected addIngredient(key:number){
  this.choices.update(a=>a.map(v=>v.key!==key?v:{...v,ingredientes:[
   ...v.ingredientes,{key:this.nextIngredient++,articuloId:'',unidadId:'',cantidad:''}]}));
 }
 protected changeIngredient(key:number,part:number,patch:Partial<IngredientRow>){
  this.choices.update(a=>a.map(v=>v.key!==key?v:{...v,
   ingredientes:v.ingredientes.map(x=>x.key===part?{...x,...patch}:x)}));
 }
 protected removeIngredient(key:number,part:number){
  this.choices.update(a=>a.map(v=>v.key!==key?v:{...v,
   ingredientes:v.ingredientes.filter(x=>x.key!==part)}));
 }
 private draft():CatalogQuickGroupSetup{
  const mode=this.selectionMode();
  return {nombre:this.groupName().trim(),
   minimo:mode==='required'?1:0,
   maximo:mode==='several'?this.maxChoices():1,
   ...(this.variantId()?{varianteId:this.variantId()}:{}),
   opciones:this.choices().map(x=>({
    nombre:x.nombre.trim(),incrementoPrecio:x.precio.trim(),
    ingredientes:x.consumo?x.ingredientes.map(c=>({
     articuloId:c.articuloId,unidadId:c.unidadId,cantidad:c.cantidad.trim(),efecto:'SUMAR' as const
    })):[]
   }))};
 }
 private validate():string[]{
  return quickGroupIssues(this.draft(),this.choices().map(x=>x.consumo));
 }

 protected async save(event:Event){
  event.preventDefault();
  if(this.busy()||!this.access.canManage())return;
  const errors=this.validate();
  if(errors.length){this.problem.set([...new Set(errors)].join(' '));return}
  this.busy.set(true);this.problem.set('');
  try{
   const group=await firstValueFrom(this.api.setupModifierGroup(this.draft()));
   this.notifications.show('Grupo con opciones guardado correctamente.','success');
   this.saved.emit(group.id);
  }catch(e){this.problem.set(gcErrorMessage(e)+
    ' Si se perdió la respuesta, verifica el listado antes de repetir la creación.')}
  finally{this.busy.set(false)}
 }
}
