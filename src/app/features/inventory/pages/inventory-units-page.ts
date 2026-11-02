
import {Component,computed,effect,inject,signal} from '@angular/core';
import {FormControl,FormGroup,ReactiveFormsModule,Validators} from '@angular/forms';
import {firstValueFrom} from 'rxjs';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcDataTable,type GcTableColumn,type GcTableRow} from '../../../design-system/data/gc-data-table';
import {GcTableCellDirective} from '../../../design-system/data/gc-table-cell.directive';
import {GcPagination,type GcPageChange} from '../../../design-system/data/gc-pagination';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {OrganizationAccess} from '../../organization/data-access/organization-access';
import {GcInventoryNav} from '../inventory-nav';
import {GcInventorySubnav,SETTINGS_LINKS} from '../components/inventory-subnav';
import {GcInventoryPicker} from '../components/inventory-picker';
import {InventoryApi} from '../data-access/inventory.api';
import {InventoryUrlState} from '../data-access/inventory-url-state';
import {DIMENSIONS,type Dimension} from '../data-access/inventory.models';
import {toApiDecimal} from '../../../shared/formatting';
@Component({
 selector:'gc-inventory-units-page',
 providers:[InventoryUrlState],
 imports:[ReactiveFormsModule,GcPageHeader,GcButtonDirective,GcDataTable,GcTableCellDirective,
  GcPagination,GcErrorState,GcInventoryNav,GcInventorySubnav,GcInventoryPicker],
 template:`
 <div class="inv-page">
  <gc-page-header title="Unidades y conversiones"/>
  <gc-inventory-nav/><gc-inventory-subnav [links]="links" label="Configuración de inventario"/>
  <nav class="inv-subnav" aria-label="Unidades y conversiones">
   <button gcButton type="button" [variant]="section()==='units'?'primary':'outline'" (click)="changeSection('units')">Unidades</button>
   <button gcButton type="button" [variant]="section()==='conversions'?'primary':'outline'" (click)="changeSection('conversions')">Conversiones</button>
  </nav>
  <section class="inv-card">
   <div class="inv-toolbar">
    <form class="inv-toolbar" (submit)="searchNow($event)">
     <div class="inv-field"><label for="unit-search">Buscar unidad</label>
      <input id="unit-search" [value]="search()" (input)="search.set($any($event.target).value)"
       placeholder="Código o nombre" maxlength="100"/>
     </div>
     <button gcButton variant="outline" type="submit">Buscar</button>
    </form>
   </div>
   @if(page.status()==='error'){<gc-error-state [message]="readError()" (retry)="reload()"/>}
   @else{
    <gc-data-table [columns]="columns()" [rows]="page.data()?.rows??[]" [loading]="page.busy()">
     <ng-template gcTableCell="action" let-row>
      @if(section()==='units'){<button gcButton variant="outline" type="button" (click)="select(row['id'])">Editar</button>}
     </ng-template>
    </gc-data-table>
    <gc-pagination [index]="url.filters().page-1" [size]="url.filters().limit"
     [total]="page.data()?.total??0" (pageChange)="changePage($event)"/>
   }
  </section>
  @if(section()==='units'){
   <section class="inv-card inv-narrow">
    <h2>{{editId()?'Renombrar unidad':'Crear unidad'}}</h2>
    <form class="inv-form" [formGroup]="unitForm" (ngSubmit)="saveUnit()" novalidate>
     <div class="inv-grid">
      <div class="inv-field"><label for="unit-code">Código</label>
       <input id="unit-code" formControlName="codigo" maxlength="50" placeholder="Ej. KG"/></div>
      <div class="inv-field"><label for="unit-name">Nombre</label>
       <input id="unit-name" formControlName="nombre" maxlength="120" placeholder="Ej. Kilogramo"/></div>
      <div class="inv-field"><label for="unit-dimension">Dimensión</label>
       <select id="unit-dimension" formControlName="dimension">
        @for(d of dimensions;track d.value){<option [value]="d.value">{{d.label}}</option>}
       </select>
      </div>
      <label><input type="checkbox" formControlName="esBase"/> Unidad base de la dimensión</label>
     </div>
     <p class="inv-muted">Las unidades existentes conservan sus códigos y dimensiones para proteger las conversiones históricas.</p>
     @if(error()){<p class="inv-alert" role="alert">{{error()}}</p>}
     <div class="inv-actions">
      <button gcButton type="submit" [disabled]="unitForm.invalid||action.busy()||!canManage()||(!unitForm.dirty&&!!editId())">Guardar</button>
      @if(editId()){<button gcButton variant="outline" type="button" (click)="resetUnit()">Nueva unidad</button>}
     </div>
    </form>
   </section>
  } @else {
   <section class="inv-card inv-narrow">
    <h2>Registrar conversión</h2>
    <form class="inv-form" [formGroup]="conversionForm" (ngSubmit)="saveConversion()" novalidate>
     <div class="inv-grid">
      <gc-inventory-picker id="conversion-from" kind="unit" label="Unidad de origen"
       [value]="origin()" (valueChange)="origin.set($event)"/>
      <gc-inventory-picker id="conversion-to" kind="unit" label="Unidad de destino"
       [value]="destination()" (valueChange)="destination.set($event)"/>
      <div class="inv-field"><label for="conversion-factor">Factor</label>
       <input id="conversion-factor" formControlName="factor" inputmode="decimal" placeholder="Ej. 1000"/></div>
      <div class="inv-field"><label for="conversion-qty">Cantidad a comprobar</label>
       <input id="conversion-qty" formControlName="cantidad" inputmode="decimal" placeholder="Ej. 2.5"/></div>
     </div>
     @if(previewData();as data){
      <div class="inv-card"><strong>Vista previa</strong>
       @for(item of previewEntries(data);track item.key){<p>{{item.key}}: {{item.value}}</p>}
      </div>
     }
     @if(error()){<p class="inv-alert" role="alert">{{error()}}</p>}
     <div class="inv-actions">
      <button gcButton type="button" variant="outline" [disabled]="!origin()||!destination()||!conversionForm.controls.cantidad.value"
       (click)="preview()">Calcular vista previa</button>
      <button gcButton type="submit" [disabled]="!canManage()||!origin()||!destination()||!conversionForm.controls.factor.value||action.busy()">
       Crear conversión
      </button>
     </div>
    </form>
   </section>
  }
 </div>`,
 styleUrl:'../inventory.scss'
})
export class GcInventoryUnitsPage {
 protected readonly links=SETTINGS_LINKS;
 protected readonly url=inject(InventoryUrlState);
 private readonly api=inject(InventoryApi);
 private readonly access=inject(OrganizationAccess);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notice=inject(GcNotificationService);
 protected readonly section=computed<'units'|'conversions'>(()=>
  this.url.params().get('section')==='conversions'?'conversions':'units');
 protected readonly page=new GcPageState<{rows:GcTableRow[];total:number}>();
 protected readonly search=signal('');protected readonly editId=signal('');
 protected readonly error=signal<string|null>(null);
 protected readonly action=new GcConfirmedAction();
 protected readonly dimensions=DIMENSIONS;
 protected readonly origin=signal('');protected readonly destination=signal('');
 protected readonly previewData=signal<Record<string,unknown>|null>(null);
 protected readonly columns=computed<GcTableColumn[]>(()=>
  this.section()==='units'?
   [{key:'codigo',label:'Código'},{key:'nombre',label:'Nombre'},
    {key:'dimension',label:'Dimensión'},{key:'base',label:'Base'},{key:'action',label:'Acciones'}]:
   [{key:'origen',label:'Origen'},{key:'destino',label:'Destino'},{key:'factor',label:'Factor'}]);
 protected readonly unitForm=new FormGroup({
  codigo:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.pattern(/^[A-Za-z][A-Za-z0-9_-]{0,49}$/)]}),
  nombre:new FormControl('',{nonNullable:true,validators:Validators.required}),
  dimension:new FormControl<Dimension>('UNIDAD',{nonNullable:true}),
  esBase:new FormControl(false,{nonNullable:true})
 });
 protected readonly conversionForm=new FormGroup({
  factor:new FormControl('',{nonNullable:true,validators:Validators.pattern(/^\d+(?:\.\d{1,10})?$/)}),
  cantidad:new FormControl('1',{nonNullable:true,validators:Validators.pattern(/^\d+(?:\.\d{1,6})?$/)})
 });
 constructor(){effect(()=>{const f=this.url.filters();const mode=this.section();
  this.search.set(f.search);this.resetUnit();void this.load(mode);
 })}
 protected canManage(){return this.access.canGlobal('inventory.units.manage')}
 protected readError(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load(this.section())}
 protected changeSection(section:string){void this.url.patch({section,page:1})}
 protected searchNow(e:Event){e.preventDefault();void this.url.patch({search:this.search(),page:1})}
 protected changePage(c:GcPageChange){void this.url.patch({page:c.index+1,limit:c.size})}
 private async load(section:'units'|'conversions'){
  const f=this.url.filters();
  await this.page.load(async()=>{
   if(section==='units'){
    const r=await firstValueFrom(this.api.units({page:f.page,limit:f.limit,search:f.search}));
    return {total:r.meta.total,rows:r.data.map(x=>({id:x.id,codigo:x.codigo,nombre:x.nombre,
     dimension:x.dimension,base:x.esBase?'Sí':'No',action:x.id}))};
   }
   const r=await firstValueFrom(this.api.conversions({page:f.page,limit:f.limit,search:f.search}));
   return {total:r.meta.total,rows:r.data.map(x=>({id:x.id,
    origen:x.unidadOrigen?.nombre??'—',destino:x.unidadDestino?.nombre??'—',factor:x.factor}))};
  });
 }
 protected async select(v:GcTableRow[string]){
  const id=String(v);this.error.set(null);
  try{
   const d=await firstValueFrom(this.api.unit(id));
   this.editId.set(id);this.unitForm.reset({codigo:d.codigo,nombre:d.nombre,
    dimension:d.dimension,esBase:d.esBase});
   this.unitForm.controls.codigo.disable();
   this.unitForm.controls.dimension.disable();
   this.unitForm.controls.esBase.disable();
  }catch(e){this.error.set(gcErrorMessage(e))}
 }
 protected resetUnit(){
  this.editId.set('');
  this.unitForm.enable();
  this.unitForm.reset({codigo:'',nombre:'',dimension:'UNIDAD',esBase:false});
 }
 protected async saveUnit(){
  if(this.unitForm.invalid){this.unitForm.markAllAsTouched();return}
  const v=this.unitForm.getRawValue();const id=this.editId();
  this.error.set(null);
  const r=await this.action.runConfirmed(this.dialog,{title:id?'Renombrar unidad':'Crear unidad',
   message:'¿Guardar esta unidad de medida?',confirmText:'Guardar'},
   ()=>firstValueFrom(id?this.api.updateUnit(id,v.nombre.trim()):
    this.api.createUnit({codigo:v.codigo.trim(),nombre:v.nombre.trim(),dimension:v.dimension,esBase:v.esBase})));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.error.set(gcErrorMessage(r.error));return}
  this.resetUnit();this.notice.show('Unidad guardada.','success');await this.load('units');
 }
 protected previewEntries(data:Record<string,unknown>){
  return Object.entries(data).filter(([,v])=>typeof v==='string'||typeof v==='number')
   .map(([key,value])=>({key,value:String(value)}));
 }
 protected async preview(){
  this.error.set(null);
  try{const result=await firstValueFrom(this.api.conversionPreview({
   unidadOrigenId:this.origin(),unidadDestinoId:this.destination(),
   cantidad:toApiDecimal(this.conversionForm.controls.cantidad.value)}));
   this.previewData.set(result);
  }catch(e){this.error.set(gcErrorMessage(e))}
 }
 protected async saveConversion(){
  if(this.conversionForm.invalid||!this.origin()||!this.destination())return;
  this.error.set(null);
  let factor:string;
  try{factor=toApiDecimal(this.conversionForm.controls.factor.value)}
  catch(e){this.error.set(gcErrorMessage(e));return}
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Crear conversión',message:'Las conversiones registradas no se editan históricamente. ¿Continuar?',
   confirmText:'Crear conversión'},
   ()=>firstValueFrom(this.api.createConversion({
    unidadOrigenId:this.origin(),unidadDestinoId:this.destination(),factor})));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.error.set(gcErrorMessage(r.error));return}
  this.origin.set('');this.destination.set('');
  this.conversionForm.reset({factor:'',cantidad:'1'});this.previewData.set(null);
  this.notice.show('Conversión registrada.','success');await this.load('conversions');
 }
 hasUnsavedChanges(){return this.unitForm.dirty||this.conversionForm.dirty}
}
