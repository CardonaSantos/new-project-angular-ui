
import {Component,computed,effect,inject,input,output,signal,untracked} from '@angular/core';
import {Subject,debounceTime,distinctUntilChanged} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {firstValueFrom} from 'rxjs';
import {InventoryApi} from '../data-access/inventory.api';
import type {InventoryKind,Dimension} from '../data-access/inventory.models';

export type InventoryPickerKind='article'|'warehouse'|'location'|'lot'|'unit';
interface Choice {id:string;label:string}
@Component({
 selector:'gc-inventory-picker',
 imports:[GcSearchSelect],
 template:`
 <gc-search-select [id]="id()" [label]="label()" [items]="visibleItems()"
  [value]="value()" [disabled]="disabled()" [loading]="loading()"
  [remote]="kind()!=='lot'" [clearable]="true"
  [placeholder]="disabled()?'No disponible':'Buscar por nombre o código…'"
  [hint]="more()?'Refina la búsqueda para encontrar más resultados.':''"
  [error]="error()??''"
  (valueChange)="select($event)" (searchChange)="onSearch($event)"/>
 `,
 styleUrl:'../inventory.scss'
})
export class GcInventoryPicker {
 readonly id=input.required<string>();
 readonly label=input('Artículo');
 readonly kind=input.required<InventoryPickerKind>();
 readonly value=input('');
 /** Saved readable name when the current value is outside the options page. */
 readonly selectedLabel=input('');
 readonly branchId=input('');
 readonly warehouseId=input('');
 readonly articleId=input('');
 /** Restrict article searches when a form requires a specific inventory category. */
 readonly articleKind=input<InventoryKind|''>('');
 /** Limits units to the dimension of the ingredient or commercial yield. */
 readonly unitDimension=input<Dimension|''>('');
 readonly disabled=input(false);
 readonly valueChange=output<string>();
 protected readonly search=signal('');
 protected readonly items=signal<Choice[]>([]);
 private readonly loadedLabel=signal('');
 protected readonly visibleItems=computed(()=>{
  const selected=this.value(),items=this.items();
  if(!selected||items.some(item=>item.id===selected))return items;
  const label=this.selectedLabel().trim()||this.loadedLabel()||
   'Selección guardada (fuera de los resultados)';
  return [{id:selected,label},...items];
 });
 protected readonly loading=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly more=signal(false);
 private readonly api=inject(InventoryApi);
 private readonly searchQueries=new Subject<string>();
 private generation=0;
 constructor(){
  this.searchQueries.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed()).subscribe(term=>{
   this.search.set(term);void this.load();
  });
  effect(()=>{
   this.kind();this.branchId();this.warehouseId();this.articleId();this.articleKind();this.unitDimension();
   untracked(()=>void this.load());
  });
  effect(()=>{
   const id=this.value(),kind=this.kind(),supplied=this.selectedLabel();
   this.loadedLabel.set('');
   if(id&&!supplied.trim())void this.readSelectedLabel(id,kind);
  });
 }
 private async readSelectedLabel(id:string,kind:InventoryPickerKind){
  try{
   let label='';
   if(kind==='article'){
    const item=await firstValueFrom(this.api.article(id));
    label=item.codigo+' · '+item.nombre;
   }else if(kind==='warehouse'){
    const item=await firstValueFrom(this.api.warehouse(id));
    label=item.nombre;
   }else if(kind==='location'){
    const item=await firstValueFrom(this.api.location(id));
    label=item.nombre;
   }else if(kind==='unit'){
    const item=await firstValueFrom(this.api.unit(id));
    label=item.nombre+' ('+item.codigo+')';
   }
   if(this.value()===id&&this.kind()===kind)this.loadedLabel.set(label);
  }catch{
   // An inactive or inaccessible linked record must not silently reset the selection.
  }
 }
 protected select(value:string){this.valueChange.emit(value)}
 protected onSearch(value:string){this.searchQueries.next(value)}
 private async load(){
  const current=++this.generation;
  this.loading.set(true);this.error.set(null);this.items.set([]);
  try{
   const kind=this.kind(),search=this.search().trim();
   let items:Choice[]=[],more=false;
   if(kind==='article'){
    const r=await firstValueFrom(this.api.articleOptions({search,limit:50,tipo:this.articleKind()||undefined}));
    items=r.data.map(x=>({id:x.id,label:x.codigo+' · '+x.nombre}));more=r.meta.hasMore;
   }else if(kind==='warehouse'){
    if(!this.branchId())return;
    const r=await firstValueFrom(this.api.warehouseOptions({search,sucursalId:this.branchId(),limit:50}));
    items=r.data.map(x=>({id:x.id,label:x.label||x.nombre||x.codigo}));more=r.meta.hasMore;
   }else if(kind==='location'){
    if(!this.warehouseId())return;
    const r=await firstValueFrom(this.api.locationOptions({
     almacenId:this.warehouseId(),sucursalId:this.branchId()||undefined,search,limit:50
    }));
    items=r.data.map(x=>({id:x.id,label:x.label||x.nombre||x.codigo}));more=r.meta.hasMore;
   }else if(kind==='unit'){
    const r=await firstValueFrom(this.api.unitOptions({search,limit:50,dimension:this.unitDimension()||undefined}));
    items=r.data.map(x=>({id:x.id,label:x.nombre+' ('+x.codigo+')'}));more=r.meta.hasMore;
   }else{
    if(!this.articleId()||!this.branchId())return;
    const r=await firstValueFrom(this.api.lots({sucursalId:this.branchId(),
      articuloId:this.articleId(),incluirSinExistencias:true,limit:50,page:1}));
    items=r.data.map(x=>({id:x.id,label:x.codigoLote+
      (x.bloqueado?' · Bloqueado':'')}));more=r.meta.total>r.meta.page*r.meta.limit;
   }
   if(current===this.generation){this.items.set(items);this.more.set(more)}
  }catch{
   if(current===this.generation)this.error.set('No fue posible cargar las opciones.')
  }finally{if(current===this.generation)this.loading.set(false)}
 }
}
