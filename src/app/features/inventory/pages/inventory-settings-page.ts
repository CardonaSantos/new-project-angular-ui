
import {Component,computed,effect,inject,signal} from '@angular/core';
import {ReactiveFormsModule,FormControl,FormGroup,Validators} from '@angular/forms';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcDataTable,type GcTableRow,type GcTableColumn} from '../../../design-system/data/gc-data-table';
import {GcTableCellDirective} from '../../../design-system/data/gc-table-cell.directive';
import {GcPagination,type GcPageChange} from '../../../design-system/data/gc-pagination';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcInventoryNav} from '../inventory-nav';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {GcInventorySubnav,SETTINGS_LINKS} from '../components/inventory-subnav';
import {GcInventoryPicker} from '../components/inventory-picker';
import {InventoryUrlState} from '../data-access/inventory-url-state';
import {InventoryApi} from '../data-access/inventory.api';

type Scope='warehouses'|'locations';
@Component({
 selector:'gc-inventory-settings-page',
 providers:[InventoryUrlState],
 imports:[ReactiveFormsModule,GcPageHeader,GcButtonDirective,GcDataTable,GcTableCellDirective,
  GcPagination,GcErrorState,GcInventoryNav,GcInventorySubnav,GcInventoryPicker,GcSearchSelect],
 template:`
 <div class="inv-page">
  <gc-page-header title="Almacenes y ubicaciones"/>
  <gc-inventory-nav/><gc-inventory-subnav [links]="links" label="Configuración de inventario"/>
  <nav class="inv-subnav" aria-label="Elementos de almacén">
   <button gcButton type="button" [variant]="scope()==='warehouses'?'primary':'outline'"
    (click)="changeScope('warehouses')">Almacenes</button>
   <button gcButton type="button" [variant]="scope()==='locations'?'primary':'outline'"
    (click)="changeScope('locations')">Ubicaciones</button>
  </nav>
  <section class="inv-card">
   <div class="inv-toolbar">
    <gc-search-select id="warehouse-branch" label="Sucursal" [items]="branchChoices()"
     [value]="url.filters().sucursalId" [clearable]="false" (valueChange)="changeBranch($event)"/>
    <gc-search-select id="warehouse-status" label="Estado" [items]="statusChoices"
     [value]="url.filters().estado" placeholder="Todos" [searchable]="false" (valueChange)="setFilter('estado',$event)"/>
    <form class="inv-toolbar" (submit)="applySearch($event)">
     <div class="inv-field"><label for="warehouse-search">Buscar</label>
      <input id="warehouse-search" [value]="search()" (input)="search.set($any($event.target).value)"
       maxlength="100" placeholder="Nombre o código"/>
     </div>
     <button gcButton variant="outline" type="submit">Buscar</button>
    </form>
   </div>
   @if(page.status()==='error'){<gc-error-state [message]="errorMessage()" (retry)="reload()"/>}
   @else{
    <gc-data-table [columns]="columns()" [rows]="page.data()?.rows??[]" [loading]="page.busy()">
     <ng-template gcTableCell="actions" let-row>
      <button type="button" gcButton variant="outline" (click)="select(row['id'])">Ver y editar</button>
     </ng-template>
    </gc-data-table>
    <gc-pagination [index]="url.filters().page-1" [size]="url.filters().limit"
     [total]="page.data()?.total??0" (pageChange)="onPage($event)"/>
   }
  </section>
  <section class="inv-card inv-narrow">
   <div class="inv-row"><h2>{{selectedId()?'Editar':'Registrar'}} {{scope()==='warehouses'?'almacén':'ubicación'}}</h2>
    @if(selectedId()){<button gcButton variant="outline" type="button" (click)="clear()">Nuevo</button>}
   </div>
   <form class="inv-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
    <fieldset class="inv-section"><legend>1. Identificación</legend>
    <div class="inv-grid">
     @if(scope()==='locations'){
      <gc-inventory-picker id="location-warehouse" label="Almacén" kind="warehouse"
       [branchId]="url.filters().sucursalId" [value]="warehouseId()"
       (valueChange)="warehouseId.set($event)"/>
     }
     <div class="inv-field"><label for="warehouse-code">Código</label>
      <input id="warehouse-code" formControlName="codigo" maxlength="50"
       placeholder="Ej. BOD-01"
       [attr.aria-invalid]="form.controls.codigo.invalid&&form.controls.codigo.touched"/>
     </div>
     <div class="inv-field"><label for="warehouse-name">Nombre</label>
      <input id="warehouse-name" formControlName="nombre" maxlength="150"
       placeholder="Ej. Bodega principal"
       [attr.aria-invalid]="form.controls.nombre.invalid&&form.controls.nombre.touched"/>
     </div>
    </div>
    </fieldset>
    @if(scope()==='locations'){
     <fieldset class="inv-section"><legend>2. Configuración de ubicación</legend>
      <label><input type="checkbox" formControlName="esRecepcion"/> Ubicación de recepción</label>
     </fieldset>
    }
    @if(saveError()){<p class="inv-alert" role="alert">{{saveError()}}</p>}
    <div class="inv-actions">
     <button type="submit" gcButton [disabled]="form.invalid||!canWrite()||action.busy()||(!form.dirty&&!!selectedId())||
      (scope()==='locations'&&!warehouseId())">{{action.busy()?'Guardando…':'Guardar'}}</button>
    </div>
   </form>
   @if(selectedId()){
    <div class="inv-field"><label for="warehouse-reason">Motivo del cambio de estado</label>
     <input id="warehouse-reason" [value]="reason()" (input)="reason.set($any($event.target).value)"
      maxlength="500" placeholder="Ej. Reorganización de bodega"/>
    </div>
    @if(statusError()){<p role="alert" class="inv-alert">{{statusError()}}</p>}
    <div class="inv-actions">
     <button type="button" gcButton [variant]="selectedActive()?'danger':'secondary'"
      [disabled]="!canWrite()||action.busy()||form.dirty||reason().trim().length<3"
      (click)="changeStatus()">{{selectedActive()?'Desactivar':'Activar'}}</button>
    </div>
   }
  </section>
 </div>`,
 styleUrl:'../inventory.scss'
})
export class GcInventorySettingsPage {
 protected readonly links=SETTINGS_LINKS;
 protected readonly url=inject(InventoryUrlState);
 protected readonly branch=inject(GcBranchContext);
 protected readonly branchChoices=computed(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly statusChoices=[{id:'true',label:'Activos'},{id:'false',label:'Inactivos'}];
 private readonly api=inject(InventoryApi);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 protected readonly scope=computed<Scope>(()=>this.url.params().get('section')==='locations'?'locations':'warehouses');
 protected readonly page=new GcPageState<{rows:GcTableRow[];total:number}>();
 protected readonly search=signal('');
 protected readonly selectedId=signal('');
 protected readonly selectedActive=signal(true);
 protected readonly warehouseId=signal('');
 protected readonly saveError=signal<string|null>(null);
 protected readonly statusError=signal<string|null>(null);
 protected readonly reason=signal('');
 protected readonly action=new GcConfirmedAction();
 protected readonly columns=computed<GcTableColumn[]>(()=>[
  {key:'codigo',label:'Código'},{key:'nombre',label:this.scope()==='warehouses'?'Almacén':'Ubicación'},
  {key:'estado',label:'Estado'}, ...(this.scope()==='locations'?[{key:'recepcion',label:'Recepción'}]:[]),
  {key:'actions',label:'Acciones'}]);
 protected readonly form=new FormGroup({
  codigo:new FormControl('',{nonNullable:true,validators:[Validators.required,
   Validators.pattern(/^[A-Za-z][A-Za-z0-9_-]{1,49}$/)]}),
  nombre:new FormControl('',{nonNullable:true,validators:Validators.required}),
  esRecepcion:new FormControl(false,{nonNullable:true})
 });
 constructor(){
  effect(()=>{const f=this.url.filters(),scope=this.scope();
   this.search.set(f.search);this.clear();if(f.sucursalId)void this.load(scope);
  });
 }
 protected canWrite(){return this.branch.has('inventory.warehouses.manage')}
 protected errorMessage(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load(this.scope())}
 protected async changeScope(scope:Scope){
  await this.url.patch({section:scope,page:1,search:null,estado:null});
 }
 protected async changeBranch(id:string){await this.url.patch({sucursalId:id,page:1})}
 protected async setFilter(key:string,value:string){await this.url.patch({[key]:value,page:1})}
 protected applySearch(e:Event){e.preventDefault();void this.url.patch({search:this.search().trim(),page:1})}
 protected onPage(e:GcPageChange){void this.url.patch({page:e.index+1,limit:e.size})}
 private async load(scope:Scope){
  const f=this.url.filters();
  await this.page.load(async()=>{
   if(scope==='warehouses'){
    const r=await firstValueFrom(this.api.warehouses({sucursalId:f.sucursalId,
     search:f.search,page:f.page,limit:f.limit,
     activo:f.estado?f.estado==='true':undefined}));
    return {total:r.meta.total,rows:r.data.map(x=>({id:x.id,codigo:x.codigo,
     nombre:x.nombre,estado:x.activo?'Activo':'Inactivo',actions:x.id}))};
   }
   const r=await firstValueFrom(this.api.locations({sucursalId:f.sucursalId,
    search:f.search,page:f.page,limit:f.limit,activo:f.estado?f.estado==='true':undefined}));
   return {total:r.meta.total,rows:r.data.map(x=>({id:x.id,codigo:x.codigo,
    nombre:x.nombre,estado:x.activo?'Activo':'Inactivo',recepcion:x.esRecepcion?'Sí':'No',actions:x.id}))};
  });
 }
 protected async select(v:GcTableRow[string]){
  const id=String(v);this.saveError.set(null);
  try{
   if(this.scope()==='warehouses'){
    const row=await firstValueFrom(this.api.warehouse(id));
    this.selectedId.set(id);this.selectedActive.set(row.activo);
    this.form.reset({codigo:row.codigo,nombre:row.nombre,esRecepcion:false});
   }else{
    const row=await firstValueFrom(this.api.location(id));
    this.selectedId.set(id);this.selectedActive.set(row.activo);
    this.warehouseId.set(row.almacenId);
    this.form.reset({codigo:row.codigo,nombre:row.nombre,esRecepcion:row.esRecepcion});
   }
   this.form.controls.codigo.disable();
  }catch(e){this.saveError.set(gcErrorMessage(e))}
 }
 protected clear(){
  this.selectedId.set('');this.selectedActive.set(true);this.warehouseId.set('');
  this.form.controls.codigo.enable();
  this.form.reset({codigo:'',nombre:'',esRecepcion:false});
  this.reason.set('');
 }
 protected async save(){
  if(this.form.invalid||!this.canWrite()){this.form.markAllAsTouched();return}
  const f=this.form.getRawValue(),scope=this.scope(),id=this.selectedId();
  this.saveError.set(null);
  const r=await this.action.runConfirmed(this.dialog,{
   title:id?'Guardar cambios':'Crear registro',message:'¿Guardar estos datos de almacén?',
   confirmText:'Guardar'},
   ()=>firstValueFrom(scope==='warehouses'
    ?id?this.api.updateWarehouse(id,f.nombre.trim()):
       this.api.createWarehouse({sucursalId:this.url.filters().sucursalId,codigo:f.codigo.trim(),nombre:f.nombre.trim()})
    :id?this.api.updateLocation(id,{nombre:f.nombre.trim(),esRecepcion:f.esRecepcion}):
      this.api.createLocation({almacenId:this.warehouseId(),codigo:f.codigo.trim(),nombre:f.nombre.trim(),esRecepcion:f.esRecepcion})));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.saveError.set(gcErrorMessage(r.error));return}
  this.clear();this.notices.show('Registro guardado.','success');await this.load(scope);
 }
 protected async changeStatus(){
  const id=this.selectedId();if(!id||this.reason().trim().length<3)return;
  this.statusError.set(null);const next=!this.selectedActive();
  const r=await this.action.runConfirmed(this.dialog,{
   title:next?'Activar registro':'Desactivar registro',
   message:'El servidor validará existencias y dependencias. ¿Continuar?',
   confirmText:next?'Activar':'Desactivar',danger:!next},
   ()=>firstValueFrom(this.scope()==='warehouses'
    ?this.api.warehouseStatus(id,next,this.reason().trim())
    :this.api.locationStatus(id,next,this.reason().trim())));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.statusError.set(gcErrorMessage(r.error));return}
  this.clear();this.notices.show('Estado actualizado.','success');await this.load(this.scope());
 }
 hasUnsavedChanges(){return this.form.dirty}
}
