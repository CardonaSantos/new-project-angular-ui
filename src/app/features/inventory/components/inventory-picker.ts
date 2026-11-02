
import {Component,effect,inject,input,output,signal} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {InventoryApi} from '../data-access/inventory.api';

export type InventoryPickerKind='article'|'warehouse'|'location'|'lot'|'unit';
interface Choice {id:string;label:string}
@Component({
 selector:'gc-inventory-picker',
 template:`
 <div class="inv-field">
  <label [for]="id()">{{label()}}</label>
  <div class="inv-row">
   <input [id]="id()+'-search'" [attr.aria-label]="'Buscar '+label()" [value]="search()"
    (input)="search.set($any($event.target).value)" maxlength="100"
    placeholder="Buscar por nombre o código" [disabled]="loading()"/>
   <button type="button" (click)="reload()" [disabled]="loading()">Buscar</button>
  </div>
  <select [id]="id()" [value]="value()" (change)="select($any($event.target).value)"
   [disabled]="loading()||disabled()">
   <option value="">{{loading()?'Consultando…':'Seleccionar'}}</option>
   @for(item of items();track item.id){<option [value]="item.id">{{item.label}}</option>}
  </select>
  @if(error()){<small class="inv-error" role="alert">{{error()}}</small>}
  @if(more()){<small>Refina la búsqueda para encontrar más resultados.</small>}
 </div>`,
 styleUrl:'../inventory.scss'
})
export class GcInventoryPicker {
 readonly id=input.required<string>();
 readonly label=input('Artículo');
 readonly kind=input.required<InventoryPickerKind>();
 readonly value=input('');
 readonly branchId=input('');
 readonly warehouseId=input('');
 readonly articleId=input('');
 readonly disabled=input(false);
 readonly valueChange=output<string>();
 protected readonly search=signal('');
 protected readonly items=signal<Choice[]>([]);
 protected readonly loading=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly more=signal(false);
 private readonly api=inject(InventoryApi);
 private generation=0;
 constructor(){
  effect(()=>{
   this.kind();this.branchId();this.warehouseId();this.articleId();
   void this.load();
  });
 }
 protected select(value:string){this.valueChange.emit(value)}
 protected reload(){void this.load()}
 private async load(){
  const current=++this.generation;
  this.loading.set(true);this.error.set(null);this.items.set([]);
  try{
   const kind=this.kind(),search=this.search().trim();
   let items:Choice[]=[],more=false;
   if(kind==='article'){
    const r=await firstValueFrom(this.api.articleOptions({search,limit:50}));
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
    const r=await firstValueFrom(this.api.unitOptions({search,limit:50}));
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
