
import {Component,inject,signal} from '@angular/core';
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
import {OrganizationAccess} from '../../organization/data-access/organization-access';
import {GcInventoryNav} from '../inventory-nav';
import {GcInventorySubnav,OPERATION_LINKS} from '../components/inventory-subnav';
import {GcInventoryPicker} from '../components/inventory-picker';
import {InventoryUrlState} from '../data-access/inventory-url-state';
import {InventoryApi} from '../data-access/inventory.api';
import {parseApiDecimal,toApiDecimal} from '../../../shared/formatting';
type Operation='opening'|'inbound'|'outbound'|'waste'|'consume';
@Component({
 selector:'gc-inventory-operation-page',
 providers:[InventoryUrlState],
 imports:[RouterLink,ReactiveFormsModule,GcPageHeader,GcButtonDirective,
  GcInventoryNav,GcInventorySubnav,GcInventoryPicker],
 template:`
 <div class="inv-page inv-narrow">
  <gc-page-header title="Registrar movimiento"/>
  <gc-inventory-nav/><gc-inventory-subnav [links]="links" label="Operaciones"/>
  <section class="inv-card">
   <form class="inv-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
    <div class="inv-grid">
     <div class="inv-field">
      <label for="manual-type">Operación</label>
      <select id="manual-type" [value]="kind()" (change)="kind.set($any($event.target).value)">
       <option value="opening">Saldo inicial</option>
       <option value="inbound">Entrada manual</option>
       <option value="outbound">Salida manual</option>
       <option value="waste">Merma</option>
       <option value="consume">Consumo interno</option>
      </select>
     </div>
     <div class="inv-field"><label for="manual-branch">Sucursal</label>
      <select id="manual-branch" [value]="url.filters().sucursalId"
       (change)="branchChange($any($event.target).value)">
       @for(b of branch.branches();track b.id){<option [value]="b.id">{{b.nombre}}</option>}
      </select>
     </div>
     <gc-inventory-picker id="manual-art" label="Artículo" kind="article" [value]="articleId()"
      (valueChange)="articleId.set($event);lotId.set('')"/>
     <gc-inventory-picker id="manual-warehouse" label="Almacén" kind="warehouse"
      [branchId]="url.filters().sucursalId" [value]="warehouseId()"
      (valueChange)="warehouseId.set($event);locationId.set('')"/>
     <gc-inventory-picker id="manual-location" label="Ubicación" kind="location"
      [branchId]="url.filters().sucursalId" [warehouseId]="warehouseId()" [value]="locationId()"
      (valueChange)="locationId.set($event)"/>
     <gc-inventory-picker id="manual-lot" label="Lote (si aplica)" kind="lot"
      [branchId]="url.filters().sucursalId" [articleId]="articleId()" [value]="lotId()"
      (valueChange)="lotId.set($event)"/>
     <div class="inv-field"><label for="manual-qty">Cantidad</label>
      <input id="manual-qty" formControlName="cantidad" inputmode="decimal"
       placeholder="Ej. 5.250000"
       [attr.aria-invalid]="form.controls.cantidad.invalid&&form.controls.cantidad.touched"/>
      @if(form.controls.cantidad.touched&&form.controls.cantidad.invalid){<small class="inv-error">Cantidad positiva con hasta seis decimales.</small>}
     </div>
     @if(kind()==='opening'||kind()==='inbound'){
      <div class="inv-field"><label for="manual-cost">Costo unitario</label>
       <input id="manual-cost" formControlName="costoUnitario" inputmode="decimal" placeholder="Ej. 1.250000"/>
       <small>Obligatorio para ingresos. Solo cuentas autorizadas para costos.</small>
      </div>
     }
     @if(kind()==='consume'){
      <div class="inv-field"><label for="manual-purpose">Destino de uso</label>
       <input id="manual-purpose" formControlName="destinoUso" maxlength="100" placeholder="Ej. Consumo del personal"/>
      </div>
     }
    </div>
    <div class="inv-field"><label for="manual-reason">Motivo</label>
     <textarea id="manual-reason" formControlName="motivo" rows="3" maxlength="500"
      placeholder="Describe el motivo del movimiento"></textarea>
    </div>
    <p class="inv-muted">Cada operación genera un registro inmutable de Kardex y una clave de idempotencia. No se modifican saldos manualmente en Angular.</p>
    @if(error()){<p role="alert" class="inv-alert">{{error()}}</p>}
    <div class="inv-actions">
     <button type="submit" gcButton [disabled]="action.busy()||form.invalid||!articleId()||!locationId()||!canWrite()">
      {{action.busy()?'Registrando…':'Revisar y registrar'}}
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
 private readonly access=inject(OrganizationAccess);
 protected readonly links=OPERATION_LINKS;
 protected readonly action=new GcConfirmedAction();
 protected readonly kind=signal<Operation>('inbound');
 protected readonly articleId=signal('');protected readonly warehouseId=signal('');
 protected readonly locationId=signal('');protected readonly lotId=signal('');
 protected readonly error=signal<string|null>(null);
 private key=crypto.randomUUID();
 protected readonly form=new FormGroup({
  cantidad:new FormControl('',{nonNullable:true,validators:[Validators.required,
   Validators.pattern(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/)]}),
  costoUnitario:new FormControl('',{nonNullable:true,validators:Validators.pattern(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/)}),
  destinoUso:new FormControl(''),motivo:new FormControl('',{nonNullable:true,validators:Validators.required})
 });
 constructor(){
  this.form.valueChanges.subscribe(()=>this.key=crypto.randomUUID());
 }
 protected canWrite(){return this.access.canGlobal('inventory.adjust')||
  this.branch.has('inventory.adjust')||this.branch.has('inventory.transfer')}
 protected branchChange(id:string){
  this.warehouseId.set('');this.locationId.set('');this.lotId.set('');
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
   this.error.set('Indica el costo unitario de entrada.');return}
  if(this.kind()==='consume'&&!v.destinoUso.trim()){
   this.error.set('Indica el destino del consumo interno.');return}
  const dto={articuloId:this.articleId(),ubicacionId:this.locationId(),
   ...(this.lotId()?{loteId:this.lotId()}:{}),cantidad:amount,
   claveOperacion:this.key,motivo:v.motivo.trim()};
  const type=this.kind();this.error.set(null);
  const result=await this.action.runConfirmed(this.dialog,{
   title:'Registrar movimiento',
   message:'Se contabilizará '+amount+' del artículo seleccionado. El movimiento será inmutable. ¿Continuar?',
   confirmText:'Registrar movimiento',danger:type==='waste'||type==='outbound'},
   ()=>firstValueFrom(type==='consume'
    ?this.api.internalConsumption({...dto,destinoUso:v.destinoUso.trim()})
    :this.api.manual(type,{...dto,...(cost&&(type==='opening'||type==='inbound')?{costoUnitario:cost}:{})})));
  if(!result)return;
  if(!result.ok){if(result.reason==='error')this.error.set(gcErrorMessage(result.error));return}
  this.form.reset();this.articleId.set('');this.warehouseId.set('');
  this.locationId.set('');this.lotId.set('');
  this.notice.show('Movimiento contabilizado.','success');
  await this.router.navigate(['/inventory/operations/movements'],{queryParams:{sucursalId:this.url.filters().sucursalId}});
 }
 hasUnsavedChanges(){return this.form.dirty||!!this.articleId()||!!this.locationId()}
}
