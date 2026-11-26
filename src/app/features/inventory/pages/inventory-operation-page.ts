
import {Component,computed,inject,signal} from '@angular/core';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {Router,RouterLink} from '@angular/router';
import {FormGroup,FormControl,ReactiveFormsModule,Validators} from '@angular/forms';
import {firstValueFrom} from 'rxjs';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcInventoryNav} from '../inventory-nav';
import {GcInventorySubnav,OPERATION_LINKS} from '../components/inventory-subnav';
import {GcInventoryPicker} from '../components/inventory-picker';
import {InventoryUrlState} from '../data-access/inventory-url-state';
import {InventoryApi} from '../data-access/inventory.api';
import {parseApiDecimal,toApiDecimal} from '../../../shared/formatting';
import {GcEntryUnitSelect} from '../components/entry-unit-select';
import type {EntryOption} from '../data-access/inventory.models';
import {type CostMode,entryCostPayload,entryPreview,entryUnitName,entryUnitPayload} from '../data-access/entry-units';
type Operation='opening'|'inbound'|'outbound'|'waste'|'consume';
@Component({
 selector:'gc-inventory-operation-page',
 providers:[InventoryUrlState],
 imports:[RouterLink,ReactiveFormsModule,GcPageHeader,GcButtonDirective,
  GcInventoryNav,GcInventorySubnav,GcInventoryPicker,GcSearchSelect,GcEntryUnitSelect],
 template:`
 <div class="inv-page inv-narrow">
  <gc-page-header title="Registrar movimiento"/>
  <gc-inventory-nav/><gc-inventory-subnav [links]="links" label="Operaciones"/>
  <section class="inv-card">
   <form class="inv-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
    <fieldset class="inv-section">
     <legend>1. Contexto del movimiento</legend>
     <div class="inv-grid">
      <gc-search-select id="manual-type" label="Operación" [items]="operationChoices"
       [value]="kind()" [searchable]="false" [clearable]="false"
       (valueChange)="changeKind($event)"/>
      <gc-search-select id="manual-branch" label="Sucursal" [items]="branchChoices()"
       [value]="url.filters().sucursalId" [clearable]="false"
       (valueChange)="branchChange($event)"/>
     </div>
    </fieldset>
    <fieldset class="inv-section">
     <legend>2. Artículo y ubicación</legend>
     <div class="inv-grid">
      <gc-inventory-picker id="manual-art" label="Artículo" kind="article" [value]="articleId()"
       (valueChange)="articleId.set($event);lotId.set('');newRequestKey()"/>
      <gc-inventory-picker id="manual-warehouse" label="Almacén" kind="warehouse"
       [branchId]="url.filters().sucursalId" [value]="warehouseId()"
       (valueChange)="warehouseId.set($event);locationId.set('');newRequestKey()"/>
      <gc-inventory-picker id="manual-location" label="Ubicación" kind="location"
       [branchId]="url.filters().sucursalId" [warehouseId]="warehouseId()" [value]="locationId()"
       (valueChange)="locationId.set($event);newRequestKey()"/>
      <gc-inventory-picker id="manual-lot" label="Lote (si aplica)" kind="lot"
       [branchId]="url.filters().sucursalId" [articleId]="articleId()" [value]="lotId()"
       (valueChange)="lotId.set($event);newRequestKey()"/>
     </div>
    </fieldset>
    <fieldset class="inv-section">
     <legend>3. Cantidades y justificación</legend>
     @if(kind()!=='consume'){
      <div class="inv-grid">
       <gc-entry-unit-select id="manual-unit" [branchId]="url.filters().sucursalId"
        [articleId]="articleId()" (optionChange)="unit.set($event);newRequestKey()"
        (baseChange)="baseUnit.set($event)"/>
       @if(kind()==='opening'||kind()==='inbound'){
        <div class="inv-field inv-cost-mode" role="radiogroup" aria-label="Cómo escribir el costo">
         <span class="inv-label">Costo</span>
         <label><input type="radio" name="manual-cost-mode" [checked]="costMode()==='total'"
          (change)="costMode.set('total');newRequestKey()"/> Total pagado</label>
         <label><input type="radio" name="manual-cost-mode" [checked]="costMode()==='unit'"
          (change)="costMode.set('unit');newRequestKey()"/> Por {{unitName()}}</label>
        </div>
       }
      </div>
     }
     <div class="inv-grid">
      <div class="inv-field"><label for="manual-qty">Cantidad{{kind()==='consume'?'':' ('+unitName()+')'}}</label>
       <input id="manual-qty" formControlName="cantidad" inputmode="decimal"
        placeholder="Ej. 5.250000"
        [attr.aria-invalid]="form.controls.cantidad.invalid&&form.controls.cantidad.touched"/>
       @if(form.controls.cantidad.touched&&form.controls.cantidad.invalid){<small class="inv-error">Cantidad positiva con hasta seis decimales.</small>}
      </div>
      @if(kind()==='opening'||kind()==='inbound'){
       <div class="inv-field"><label for="manual-cost">{{costMode()==='total'?'Costo total (Q)':'Costo por '+unitName()+' (Q)'}}</label>
        <input id="manual-cost" formControlName="costoUnitario" inputmode="decimal"
         [placeholder]="costMode()==='total'?'Ej. 40.00':'Ej. 20.00'"/>
        <small>Obligatorio para ingresos. Solo cuentas autorizadas para costos.</small>
       </div>
      }
      @if(kind()==='consume'){
       <div class="inv-field"><label for="manual-purpose">Destino de uso</label>
        <input id="manual-purpose" formControlName="destinoUso" maxlength="100" placeholder="Ej. Consumo del personal"/>
       </div>
      }
     </div>
     @if(kind()!=='consume'&&preview()){<p class="inv-hint" aria-live="polite">{{preview()}}</p>}
     <div class="inv-field"><label for="manual-reason">Motivo</label>
      <textarea id="manual-reason" formControlName="motivo" rows="3" maxlength="500"
       placeholder="Describe el motivo del movimiento"></textarea>
     </div>
    </fieldset>
        @if(error()){<p role="alert" class="inv-alert">{{error()}}</p>}
    <div class="inv-actions">
     <button type="submit" gcButton [disabled]="action.busy()||form.invalid||!articleId()||!locationId()||!canWrite()">
      {{action.busy()?'Registrando…':'Registrar movimiento'}}
     </button>
     <a routerLink="/inventory/operations/movements">Volver al Kardex</a>
    </div>
   </form>
  </section>
 </div>`,
 styleUrl:'../inventory.scss'
})
export class GcInventoryOperationPage {
 protected readonly branch=inject(GcBranchContext);
 protected readonly url=inject(InventoryUrlState);
 private readonly api=inject(InventoryApi);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notice=inject(GcNotificationService);
 private readonly router=inject(Router);
 protected readonly links=OPERATION_LINKS;
 protected readonly action=new GcConfirmedAction();
 protected readonly kind=signal<Operation>('inbound');
 protected readonly operationChoices=[
  {id:'opening',label:'Saldo inicial'},{id:'inbound',label:'Entrada manual'},
  {id:'outbound',label:'Salida manual'},{id:'waste',label:'Merma'},
  {id:'consume',label:'Consumo interno'}
 ];
 protected readonly branchChoices=computed(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 protected changeKind(value:string){this.kind.set(value as Operation);this.newRequestKey()}
 protected readonly articleId=signal('');protected readonly warehouseId=signal('');
 protected readonly locationId=signal('');protected readonly lotId=signal('');
 protected readonly error=signal<string|null>(null);
 /** «Se compra en»: null or the base unit keeps the entry in the article's own unit. */
 protected readonly unit=signal<EntryOption|null>(null);
 protected readonly baseUnit=signal<EntryOption|null>(null);
 protected readonly costMode=signal<CostMode>('total');
 protected readonly unitName=computed(()=>entryUnitName(this.unit(),this.baseUnit()));
 private readonly values=signal({cantidad:'',costoUnitario:''});
 protected readonly preview=computed(()=>{
  const v=this.values(),entry=this.kind()==='opening'||this.kind()==='inbound';
  return entryPreview(this.unit(),this.baseUnit(),v.cantidad,entry?v.costoUnitario||undefined:undefined,
   entry?this.costMode():'unit');
 });
 private key=crypto.randomUUID();
 protected newRequestKey(){this.key=crypto.randomUUID()}
 protected readonly form=new FormGroup({
  cantidad:new FormControl('',{nonNullable:true,validators:[Validators.required,
   Validators.pattern(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/)]}),
  costoUnitario:new FormControl('',{nonNullable:true,validators:Validators.pattern(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/)}),
  destinoUso:new FormControl('',{nonNullable:true}),motivo:new FormControl('',{nonNullable:true,validators:Validators.required})
 });
 constructor(){
  this.form.valueChanges.subscribe(v=>{
   this.key=crypto.randomUUID();
   this.values.set({cantidad:v.cantidad??'',costoUnitario:v.costoUnitario??''});
  });
 }
 protected canWrite(){
  const kind=this.kind();
  if(kind==='consume')return this.branch.has('inventory.consume.internal');
  if(kind==='opening'||kind==='inbound')
   return this.branch.has('inventory.adjust')&&this.branch.has('inventory.costs.manage');
  return this.branch.has('inventory.adjust');
 }
 protected branchChange(id:string){
  this.warehouseId.set('');this.locationId.set('');this.lotId.set('');this.newRequestKey();
  void this.url.patch({sucursalId:id});
 }
 protected async save(){
  if(this.form.invalid){this.form.markAllAsTouched();return}
  if(!this.articleId()||!this.locationId())return;
  const v=this.form.getRawValue();
  let amount:string,cost:string|undefined;
  try{
   amount=toApiDecimal(v.cantidad);
   if(!parseApiDecimal(amount).greaterThan(0))throw Error('La cantidad debe ser mayor a cero.');
   cost=v.costoUnitario?toApiDecimal(v.costoUnitario):undefined;
  }catch(e){this.error.set(e instanceof Error?e.message:gcErrorMessage(e));return}
  if((this.kind()==='opening'||this.kind()==='inbound')&&!cost){
   this.error.set('Indica el costo de la entrada.');return}
  if(this.kind()==='consume'&&(v.destinoUso.trim().length<3||v.motivo.trim().length<5)){
   this.error.set('El destino requiere 3 caracteres y el motivo al menos 5.');return}
  const dto={articuloId:this.articleId(),ubicacionId:this.locationId(),
   ...(this.lotId()?{loteId:this.lotId()}:{}),cantidad:amount,
   claveOperacion:this.key,motivo:v.motivo.trim()};
  const unitPayload=entryUnitPayload(this.unit());
  const what=amount+' '+this.unitName()+(this.preview()?' ('+this.preview()+')':'');
  const type=this.kind();this.error.set(null);
  const result=await this.action.runConfirmed(this.dialog,{
   title:'Registrar movimiento',
   message:'Se contabilizará '+what+' del artículo seleccionado. El movimiento será inmutable. ¿Continuar?',
   confirmText:'Registrar movimiento',danger:type==='waste'||type==='outbound'},
   ()=>firstValueFrom(type==='consume'
    ?this.api.internalConsumption({...dto,destinoUso:v.destinoUso.trim()})
    :this.api.manual(type,{...dto,...unitPayload,
      ...(type==='opening'||type==='inbound'?entryCostPayload(cost,this.costMode()):{})})));
  if(!result)return;
  if(!result.ok){if(result.reason==='error')this.error.set(gcErrorMessage(result.error));return}
  this.form.reset();this.articleId.set('');this.warehouseId.set('');this.unit.set(null);
  this.locationId.set('');this.lotId.set('');
  this.notice.show('Movimiento contabilizado.','success');
  await this.router.navigate(['/inventory/operations/movements'],{queryParams:{sucursalId:this.url.filters().sucursalId}});
 }
 hasUnsavedChanges(){return this.form.dirty||!!this.articleId()||!!this.locationId()}
}
