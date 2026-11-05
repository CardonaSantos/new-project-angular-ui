import {Component,computed,effect,inject,signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {firstValueFrom,Subject,debounceTime,distinctUntilChanged} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {CatalogApi} from '../../catalog/data-access/catalog.api';
import type {CatalogCategoryOption,CatalogVariant} from '../../catalog/data-access/catalog.models';
import {InventoryApi} from '../../inventory/data-access/inventory.api';
import {GcOrdersNav} from '../orders-nav';
import {OrdersApi} from '../data-access/orders.api';
import {OrdersAccess} from '../data-access/orders-access';
import type {KitchenRoute,Station} from '../data-access/orders.models';

@Component({
 selector:'gc-orders-settings-page',imports:[GcOrdersNav,GcSearchSelect],
 template:`
 <main class="ord-page ord-kitchen-settings"><gc-orders-nav/>
 <div class="ord-heading"><div><h1>Configuración de cocina</h1>
  <p>Organiza estaciones y asigna los productos que se preparan en cada una.</p></div>
  <button type="button" (click)="load()" [disabled]="busy()">Actualizar</button></div>
 @if(error()){<p class="ord-alert" role="alert">{{error()}}</p>}
 @if(busy()){<p role="status">Cargando configuración…</p>}
 <div class="ord-view-switch ord-settings-tabs" role="group" aria-label="Apartado de configuración">
  <button type="button" [class.active]="section()==='stations'"
   [attr.aria-pressed]="section()==='stations'" (click)="section.set('stations')">Estaciones</button>
  <button type="button" [class.active]="section()==='routes'"
   [attr.aria-pressed]="section()==='routes'" (click)="section.set('routes')">Rutas de preparación</button>
 </div>
 @if(section()==='stations'){
 <section class="ord-card">
  <div class="ord-heading"><div><h2>Estaciones de preparación</h2>
    <p class="ord-note">{{stations().length}} estaciones · {{missingLocations()}} sin ubicación de ingredientes</p></div>
   @if(access.canKitchenManage()){
    <button type="button" class="ord-primary" (click)="beginStation()" [disabled]="actionBusy()">
     Nueva estación</button>
   }
  </div>
  <div class="ord-small-list">
   @for(st of stations();track st.id){
    <div class="ord-setting-row">
     <div><strong>{{st.nombre}}</strong>
      <small>{{st.ubicacionConsumo?.nombre??'Sin ubicación de ingredientes'}}</small></div>
     <span>{{st.activa?'Activa':'Inactiva'}}</span>
     @if(access.canKitchenManage()){
      <div class="ord-actions">
       <button type="button" (click)="editStation(st)">Editar</button>
       <button type="button" [disabled]="actionBusy()" (click)="toggleStation(st)">
        {{st.activa?'Desactivar':'Activar'}}
       </button>
      </div>}
    </div>
   } @empty {<p>No hay estaciones configuradas.</p>}
  </div>
  @if(access.canKitchenManage()&&stationForm()){
   <fieldset class="ord-section ord-settings-editor"><legend>{{editStationId()?'Editar estación':'Nueva estación'}}</legend>
    <div class="ord-form-grid">
     <label>Nombre
      <input [value]="stationName()" maxlength="100" (input)="stationName.set($any($event.target).value)"
       placeholder="Ej. Barra de café"/>
     </label>
     <gc-search-select id="kitchen-location" label="Ubicación de ingredientes"
      [items]="locationOptions()" [value]="locationId()" placeholder="Buscar ubicación"
      [remote]="true" (searchChange)="queueLocation($event)" (valueChange)="locationId.set($event)"/>
    </div>
    <p class="ord-note">Los ingredientes se descontarán de la ubicación configurada al iniciar la preparación.</p>
    <div class="ord-actions"><button class="ord-primary" type="button"
     [disabled]="actionBusy()||stationName().trim().length<2" (click)="saveStation()">
     {{editStationId()?'Guardar estación':'Crear estación'}}</button>
     <button type="button" (click)="clearStation()" [disabled]="actionBusy()">Cancelar</button>
    </div>
   </fieldset>
  }
 </section>
 }
 @if(section()==='routes'){
 <section class="ord-card">
  <div class="ord-heading">
   <div><h2>Rutas de preparación</h2>
    <p class="ord-note">{{routes().length}} rutas · Indica dónde se prepara cada producto o categoría.</p></div>
   @if(access.canKitchenManage()){
    <button type="button" class="ord-primary" (click)="beginRoute()" [disabled]="actionBusy()">
     Nueva ruta</button>
   }
  </div>
  <div class="ord-small-list">
   @for(route of routes();track route.id){
    <div class="ord-setting-row">
     <div><strong>{{route.variante?.nombre??route.categoria?.nombre??'Destino configurado'}}</strong>
      <small>{{route.estacion?.nombre}} · Prioridad {{route.prioridad}}</small></div>
     @if(access.canKitchenManage()){
      <div class="ord-actions">
       <button type="button" (click)="editRoute(route)">Editar</button>
       <button type="button" class="ord-danger" [disabled]="actionBusy()" (click)="removeRoute(route)">Quitar</button>
      </div>}
    </div>
   } @empty {<p>No hay rutas específicas. Una sola estación activa puede ser utilizada de forma predeterminada.</p>}
  </div>
  @if(access.canKitchenManage()&&routeForm()){
   <fieldset class="ord-section ord-settings-editor"><legend>{{editRouteId()?'Editar ruta':'Asignar preparación'}}</legend>
    <div class="ord-form-grid">
     <gc-search-select id="route-station" label="Estación" [items]="stationChoices()"
      [value]="routeStationId()" placeholder="Seleccionar estación"
      (valueChange)="routeStationId.set($event)"/>
     @if(!editRouteId()){
      <gc-search-select id="route-type" label="Asignar por" [items]="targetKinds"
       [value]="targetKind()" [searchable]="false" [clearable]="false"
       (valueChange)="setTargetKind($event)"/>
      @if(targetKind()==='variant'){
       <gc-search-select id="route-variant" label="Presentación" [items]="variantChoices()"
        [value]="targetId()" [remote]="true" placeholder="Buscar presentación preparada"
        (searchChange)="variantSearch.next($event)" (valueChange)="targetId.set($event)"/>
      } @else {
       <gc-search-select id="route-category" label="Categoría" [items]="categoryChoices()"
        [value]="targetId()" [remote]="true" placeholder="Buscar categoría"
        (searchChange)="categorySearch.next($event)" (valueChange)="targetId.set($event)"/>
      }
     }
     <label>Prioridad (0 a 1000)
      <input type="number" min="0" max="1000" [value]="priority()"
       (input)="priority.set($any($event.target).valueAsNumber||0)"/>
     </label>
    </div>
    <div class="ord-actions">
     <button type="button" class="ord-primary"
      [disabled]="actionBusy()||!routeStationId()||(!editRouteId()&&!targetId())||priority()<0||priority()>1000"
      (click)="saveRoute()">{{editRouteId()?'Guardar ruta':'Asignar ruta'}}</button>
     <button type="button" (click)="resetRoute()" [disabled]="actionBusy()">Cancelar</button>
    </div>
   </fieldset>
  }
 </section>
 }
 </main>`
})
export class GcOrdersSettingsPage{
 private readonly api=inject(OrdersApi);private readonly catalog=inject(CatalogApi);
 private readonly inventory=inject(InventoryApi);
 private readonly dialog=inject(ConfirmDialogService);
 protected readonly branch=inject(GcBranchContext);protected readonly access=inject(OrdersAccess);
 protected readonly stations=signal<Station[]>([]);protected readonly routes=signal<KitchenRoute[]>([]);
 protected readonly section=signal<'stations'|'routes'>('stations');
 protected readonly stationForm=signal(false);protected readonly routeForm=signal(false);
 protected readonly missingLocations=computed(()=>this.stations().filter(s=>s.activa&&!s.ubicacionConsumoId).length);
 protected readonly busy=signal(false);protected readonly actionBusy=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly stationName=signal('');protected readonly editStationId=signal('');
 protected readonly locationId=signal('');protected readonly locations=signal<{id:string;label:string}[]>([]);
 protected readonly targetKind=signal<'variant'|'category'>('variant');protected readonly targetId=signal('');
 protected readonly routeStationId=signal('');protected readonly priority=signal(100);
 protected readonly editRouteId=signal('');
 protected readonly variants=signal<CatalogVariant[]>([]);
 protected readonly categories=signal<CatalogCategoryOption[]>([]);
 protected readonly targetKinds=[{id:'variant',label:'Presentación'},{id:'category',label:'Categoría'}];
 protected readonly stationChoices=computed(()=>this.stations().filter(s=>s.activa||s.id===this.routeStationId()).map(s=>({id:s.id,label:s.nombre})));
 protected readonly locationOptions=computed(()=>this.locations());
 protected readonly variantChoices=computed(()=>this.variants().map(v=>({id:v.id,label:v.label??v.nombre})));
 protected readonly categoryChoices=computed(()=>this.categories().map(c=>({id:c.id,label:c.label})));
 protected readonly variantSearch=new Subject<string>();protected readonly categorySearch=new Subject<string>();
 private readonly locationSearch=new Subject<string>();private generation=0;
 private locationGeneration=0;private variantGeneration=0;private categoryGeneration=0;
 constructor(){
  effect(()=>{if(this.branch.branchId())void this.load()});
  this.locationSearch.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed())
   .subscribe(s=>void this.loadLocations(s));
  this.variantSearch.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed())
   .subscribe(s=>void this.loadVariants(s));
  this.categorySearch.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed())
   .subscribe(s=>void this.loadCategories(s));
 }
 protected async load(){
  const id=this.branch.branchId();if(!id||!this.access.canKitchenRead())return;
  const gen=++this.generation;this.busy.set(true);this.error.set(null);
  try{const [a,b]=await Promise.all([firstValueFrom(this.api.stations(id)),firstValueFrom(this.api.routes(id))]);
   if(gen===this.generation){this.stations.set(a);this.routes.set(b)}
  }catch(e){if(gen===this.generation)this.error.set(gcErrorMessage(e))}
  finally{if(gen===this.generation)this.busy.set(false)}
  void this.loadLocations('');void this.loadVariants('');void this.loadCategories('');
 }
 protected queueLocation(s:string){this.locationSearch.next(s)}
 private async loadLocations(search:string){
  const branch=this.branch.branchId();if(!branch)return;
  const gen=++this.locationGeneration;
  try{const r=await firstValueFrom(this.inventory.locationOptions({sucursalId:branch,search,limit:50}));
   if(gen!==this.locationGeneration||branch!==this.branch.branchId())return;
   const previous=this.locations().find(x=>x.id===this.locationId());
   this.locations.set(previous&&!r.data.some(x=>x.id===previous.id)?[previous,...r.data.map(x=>({id:x.id,label:x.label??x.nombre}))]:r.data.map(x=>({id:x.id,label:x.label??x.nombre})));
  }catch{/* Inventory permissions may differ from kitchen permissions. */}
 }
 private async loadVariants(search:string){
  const gen=++this.variantGeneration;
  try{const r=await firstValueFrom(this.catalog.variantOptions({search,limit:50}));
   if(gen!==this.variantGeneration)return;
   this.variants.set(r.data.filter(v=>v.producto?.tipo==='PREPARADO'));
  }catch{/* Catalog read is optional for kitchen managers. */}
 }
 private async loadCategories(search:string){
  const gen=++this.categoryGeneration;
  try{const r=await firstValueFrom(this.catalog.categoryOptions({search,limit:50}));
   if(gen!==this.categoryGeneration)return;
   this.categories.set(r.data);
  }catch{/* Catalog read is optional for kitchen managers. */}
 }
 private async mutate(work:()=>Promise<void>){
  if(this.actionBusy())return;this.actionBusy.set(true);this.error.set(null);
  try{await work();await this.load()}
  catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
 protected beginStation(){
  this.clearStation();this.stationForm.set(true);this.section.set('stations');
 }
 protected editStation(s:Station){
  this.section.set('stations');this.stationForm.set(true);
  this.editStationId.set(s.id);this.stationName.set(s.nombre);
  this.locationId.set(s.ubicacionConsumoId??'');
  if(s.ubicacionConsumo&&!this.locations().some(x=>x.id===s.ubicacionConsumo!.id))
   this.locations.update(a=>[{id:s.ubicacionConsumo!.id,label:s.ubicacionConsumo!.nombre},...a]);
 }
 protected clearStation(){
  this.editStationId.set('');this.stationName.set('');this.locationId.set('');this.stationForm.set(false);
 }
 protected async saveStation(){
  const branch=this.branch.branchId(),name=this.stationName().trim();if(!branch||name.length<2)return;
  await this.mutate(async()=>{
   if(this.editStationId()){
    await firstValueFrom(this.api.updateStation(this.editStationId(),{
     nombre:name,...(this.locationId()?{ubicacionConsumoId:this.locationId()}:{})
    }));
   }else{
    await firstValueFrom(this.api.createStation({sucursalId:branch,nombre:name,
     ...(this.locationId()?{ubicacionConsumoId:this.locationId()}:{})}));
   }
   this.clearStation();
  });
 }
 protected async toggleStation(s:Station){
  if(s.activa&&!await this.dialog.confirm({title:'Desactivar estación',
   message:'No podrá desactivarse mientras tenga comandas pendientes.',confirmText:'Desactivar',danger:true}))return;
  await this.mutate(async()=>{await firstValueFrom(this.api.updateStation(s.id,{activa:!s.activa}))});
 }
 protected setTargetKind(v:string){this.targetKind.set(v==='category'?'category':'variant');this.targetId.set('')}
 protected beginRoute(){
  this.resetRoute();this.routeForm.set(true);this.section.set('routes');
 }
 protected editRoute(r:KitchenRoute){
  this.section.set('routes');this.routeForm.set(true);
  this.editRouteId.set(r.id);this.routeStationId.set(r.estacionId);this.priority.set(r.prioridad);
 }
 protected resetRoute(){
  this.editRouteId.set('');this.routeStationId.set('');this.targetId.set('');
  this.priority.set(100);this.routeForm.set(false);
 }
 protected async saveRoute(){
  if(!this.routeStationId()||(!this.editRouteId()&&!this.targetId()))return;
  await this.mutate(async()=>{
   if(this.editRouteId()){
    await firstValueFrom(this.api.updateRoute(this.editRouteId(),{
     estacionId:this.routeStationId(),prioridad:this.priority()
    }));
   }else{
    await firstValueFrom(this.api.createRoute({
     estacionId:this.routeStationId(),prioridad:this.priority(),
     ...(this.targetKind()==='variant'?{varianteId:this.targetId()}:{categoriaId:this.targetId()})
    }));
   }
   this.resetRoute();
  });
 }
 protected async removeRoute(r:KitchenRoute){
  if(!await this.dialog.confirm({title:'Quitar ruta',
   message:'Los pedidos futuros utilizarán otra ruta disponible.',confirmText:'Quitar',danger:true}))return;
  await this.mutate(async()=>{await firstValueFrom(this.api.deleteRoute(r.id))});
 }
}
