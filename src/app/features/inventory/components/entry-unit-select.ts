import {Component,computed,effect,inject,input,output,signal,untracked} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {InventoryApi} from '../data-access/inventory.api';
import type {EntryOption} from '../data-access/inventory.models';
import {entryOptionKey,entryOptionLabel} from '../data-access/entry-units';

/**
 * «Se compra en»: the article's base unit, compatible units (L, kg, lb…) and its purchase
 * presentations. Emits the chosen option (base included) and the base option once loaded,
 * so the page can label fields and preview the conversion.
 */
@Component({
 selector:'gc-entry-unit-select',
 imports:[GcSearchSelect],
 template:`
  <gc-search-select [id]="id()" [label]="label()" [items]="items()" [value]="selected()"
   [clearable]="false" [searchable]="options().length>6" [loading]="loading()"
   [disabled]="disabled()||!articleId()" placeholder="Unidad de inventario"
   [hint]="hint()" (valueChange)="choose($event)"/>`
})
export class GcEntryUnitSelect{
 private readonly api=inject(InventoryApi);
 readonly id=input.required<string>();
 readonly label=input('Se compra en');
 readonly branchId=input('');
 readonly articleId=input('');
 readonly disabled=input(false);
 /** Chosen option; the base unit when the article changes. */
 readonly optionChange=output<EntryOption|null>();
 /** The article's base unit, for labels and previews. */
 readonly baseChange=output<EntryOption|null>();
 protected readonly options=signal<EntryOption[]>([]);
 protected readonly selected=signal('');
 protected readonly loading=signal(false);
 private readonly base=computed(()=>this.options().find(o=>o.tipo==='BASE')??null);
 protected readonly items=computed(()=>this.options().map(o=>({id:entryOptionKey(o),
  label:entryOptionLabel(o,this.base())})));
 protected readonly hint=computed(()=>this.options().length>1
  ?'El inventario se guarda en '+(this.base()?.nombre??'su unidad')+'; la conversión la hace el sistema.':'');
 private generation=0;
 constructor(){
  effect(()=>{
   const branch=this.branchId(),article=this.articleId();
   untracked(()=>void this.load(branch,article));
  });
 }
 private async load(branch:string,article:string){
  const gen=++this.generation;
  this.options.set([]);this.selected.set('');
  this.optionChange.emit(null);this.baseChange.emit(null);
  if(!branch||!article)return;
  this.loading.set(true);
  try{
   const rows=await firstValueFrom(this.api.entryOptions(branch,article));
   if(gen!==this.generation)return;
   this.options.set(rows);
   const base=rows.find(o=>o.tipo==='BASE')??null;
   this.selected.set(base?entryOptionKey(base):'');
   this.baseChange.emit(base);this.optionChange.emit(base);
  }catch{
   // Without options the entry stays in the base unit, exactly as before.
  }finally{if(gen===this.generation)this.loading.set(false)}
 }
 protected choose(key:string){
  const option=this.options().find(o=>entryOptionKey(o)===key)??this.base();
  this.selected.set(option?entryOptionKey(option):'');
  this.optionChange.emit(option);
 }
}
