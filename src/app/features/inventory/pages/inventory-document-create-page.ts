
import {Component,inject,signal} from '@angular/core';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {FormControl,FormGroup,ReactiveFormsModule,Validators} from '@angular/forms';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcInventoryNav} from '../inventory-nav';
import {GcInventorySubnav,OPERATION_LINKS} from '../components/inventory-subnav';
import {GcInventoryPicker} from '../components/inventory-picker';
import {InventoryApi} from '../data-access/inventory.api';
import {InventoryUrlState} from '../data-access/inventory-url-state';
import {parseApiDecimal,toApiDecimal} from '../../../shared/formatting';
import type {CountCreate,TransferCreate} from '../data-access/inventory.models';

interface DocumentLine {
 key:string;articuloId:string;ubicacionId:string;ubicacionOrigenId:string;ubicacionDestinoId:string;
 loteId:string;cantidad:string;costoUnitarioEntrada:string;
}
function emptyLine():DocumentLine {
 return {key:crypto.randomUUID(),articuloId:'',ubicacionId:'',ubicacionOrigenId:'',
  ubicacionDestinoId:'',loteId:'',cantidad:'',costoUnitarioEntrada:''};
}
@Component({
 selector:'gc-inventory-document-create-page',
 providers:[InventoryUrlState],
 imports:[ReactiveFormsModule,RouterLink,GcPageHeader,GcButtonDirective,GcInventoryNav,
  GcInventorySubnav,GcInventoryPicker],
 template:`
 <div class="inv-page inv-narrow">
  <gc-page-header [title]="isCount?'Nuevo conteo físico':'Nueva transferencia'"/>
  <gc-inventory-nav/><gc-inventory-subnav [links]="links" label="Operaciones"/>
  <form class="inv-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
   <section class="inv-card">
    <h2>1. Origen y destino</h2>
    <div class="inv-grid">
     <div class="inv-field"><label for="document-branch">Sucursal de origen</label>
      <select id="document-branch" [value]="url.filters().sucursalId" (change)="selectBranch($any($event.target).value)">
       @for(item of branch.branches();track item.id){<option [value]="item.id">{{item.nombre}}</option>}
      </select>
     </div>
     <gc-inventory-picker id="document-warehouse" label="Almacén de origen" kind="warehouse"
      [branchId]="url.filters().sucursalId" [value]="warehouseId()"
      (valueChange)="setWarehouse($event)"/>
     @if(!isCount){
      <div class="inv-field"><label for="document-target-branch">Sucursal de destino</label>
       <select id="document-target-branch" [value]="targetBranch()"
        (change)="setTargetBranch($any($event.target).value)">
        <option value="">Selecciona una sucursal</option>
        @for(item of branch.branches();track item.id){<option [value]="item.id">{{item.nombre}}</option>}
       </select>
      </div>
      <gc-inventory-picker id="document-target-warehouse" label="Almacén de destino" kind="warehouse"
       [branchId]="targetBranch()" [value]="targetWarehouse()"
       (valueChange)="targetWarehouse.set($event);resetLines()"/>
     }
    </div>
    <div class="inv-field"><label for="document-note">Nota</label>
     <textarea id="document-note" formControlName="nota" rows="3" maxlength="500"
       placeholder="Ej. Conteo de cierre o traslado de insumos"
       [attr.aria-invalid]="form.controls.nota.invalid&&form.controls.nota.touched"></textarea>
     @if(form.controls.nota.touched&&form.controls.nota.invalid){<small class="inv-error">Introduce una nota descriptiva.</small>}
    </div>
   </section>
   <section class="inv-card">
    <div class="inv-row"><h2>2. Artículos y cantidades</h2>
     <button gcButton variant="outline" type="button" (click)="addLine()"
      [disabled]="lines().length>=(isCount?200:100)">Añadir línea</button>
    </div>
    <p class="inv-muted">{{isCount?
      'Selecciona el artículo y la ubicación contada. El servidor calculará la diferencia frente al saldo registrado.':
      'Elige ubicaciones de origen y destino para cada artículo. La recepción posterior es total.'}}</p>
    <div class="inv-lines">
     @for(line of lines();track line.key;let i=$index){
      <fieldset class="inv-card">
       <legend>Artículo {{i+1}}</legend>
       <div class="inv-grid">
        <gc-inventory-picker [id]="'line-art-'+line.key" label="Artículo" kind="article"
         [value]="line.articuloId"
         (valueChange)="setLine(line.key,{articuloId:$event,loteId:''})"/>
        @if(isCount){
         <gc-inventory-picker [id]="'line-location-'+line.key" label="Ubicación" kind="location"
          [branchId]="url.filters().sucursalId" [warehouseId]="warehouseId()"
          [value]="line.ubicacionId" (valueChange)="setLine(line.key,{ubicacionId:$event})"/>
        } @else {
         <gc-inventory-picker [id]="'line-origin-'+line.key" label="Ubicación de origen" kind="location"
          [branchId]="url.filters().sucursalId" [warehouseId]="warehouseId()"
          [value]="line.ubicacionOrigenId" (valueChange)="setLine(line.key,{ubicacionOrigenId:$event})"/>
         <gc-inventory-picker [id]="'line-dest-'+line.key" label="Ubicación de destino" kind="location"
          [branchId]="targetBranch()" [warehouseId]="targetWarehouse()"
          [value]="line.ubicacionDestinoId" (valueChange)="setLine(line.key,{ubicacionDestinoId:$event})"/>
        }
        <gc-inventory-picker [id]="'line-lot-'+line.key" label="Lote (si aplica)" kind="lot"
         [branchId]="url.filters().sucursalId" [articleId]="line.articuloId"
         [value]="line.loteId" (valueChange)="setLine(line.key,{loteId:$event})"/>
        <div class="inv-field">
         <label [for]="'line-qty-'+line.key">{{isCount?'Cantidad contada':'Cantidad a enviar'}}</label>
         <input [id]="'line-qty-'+line.key" inputmode="decimal" placeholder="Ej. 12.500000"
          [value]="line.cantidad" (input)="setLine(line.key,{cantidad:$any($event.target).value})"/>
        </div>
        @if(isCount){
         <div class="inv-field"><label [for]="'line-cost-'+line.key">Costo para diferencia positiva (si aplica)</label>
          <input [id]="'line-cost-'+line.key" inputmode="decimal" placeholder="Ej. 1.250000"
           [value]="line.costoUnitarioEntrada"
           (input)="setLine(line.key,{costoUnitarioEntrada:$any($event.target).value})"/>
         </div>
        }
       </div>
       <div class="inv-actions">
        <button type="button" gcButton variant="outline"
         [disabled]="lines().length===1" (click)="removeLine(line.key)">Quitar línea</button>
       </div>
      </fieldset>
     }
    </div>
   </section>
   <section class="inv-card">
    <h2>3. Revisión y confirmación</h2>
    <p class="inv-muted">{{lines().length}} línea(s). El documento se creará en BORRADOR. Su confirmación o despacho será una acción posterior.</p>
    @if(error()){<p role="alert" class="inv-alert">{{error()}}</p>}
    <div class="inv-actions">
     <button gcButton type="submit" [disabled]="!valid()||action.busy()||!canWrite()">
      {{action.busy()?'Creando…':isCount?'Crear conteo':'Crear transferencia'}}
     </button>
     <a [routerLink]="isCount?'/inventory/operations/counts':'/inventory/operations/transfers'">Cancelar y volver</a>
    </div>
   </section>
  </form>
 </div>`,
 styleUrl:'../inventory.scss'
})
export class GcInventoryDocumentCreatePage {
 private readonly route=inject(ActivatedRoute);
 protected readonly isCount=this.route.snapshot.data['view']==='count';
 protected readonly branch=inject(GcBranchContext);
 protected readonly url=inject(InventoryUrlState);
 private readonly api=inject(InventoryApi);
 private readonly router=inject(Router);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notice=inject(GcNotificationService);
 protected readonly links=OPERATION_LINKS;
 protected readonly action=new GcConfirmedAction();
 protected readonly error=signal<string|null>(null);
 protected readonly warehouseId=signal('');
 protected readonly targetBranch=signal('');
 protected readonly targetWarehouse=signal('');
 protected readonly lines=signal<DocumentLine[]>([emptyLine()]);
 protected readonly form=new FormGroup({
  nota:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.minLength(3)]})
 });
 protected selectBranch(branchId:string){
  this.warehouseId.set('');this.lines.set([emptyLine()]);
  void this.url.patch({sucursalId:branchId});
 }
 protected setTargetBranch(id:string){this.targetBranch.set(id);this.targetWarehouse.set('');this.lines.set([emptyLine()])}
 protected setWarehouse(id:string){this.warehouseId.set(id);this.lines.set([emptyLine()])}
 protected resetLines(){this.lines.set([emptyLine()])}
 protected addLine(){this.lines.update(current=>[...current,emptyLine()])}
 protected removeLine(key:string){this.lines.update(current=>current.filter(l=>l.key!==key))}
 protected setLine(key:string,update:Partial<DocumentLine>){
  this.lines.update(current=>current.map(line=>line.key===key?{...line,...update}:line))
 }
 protected canWrite(){return this.isCount?this.branch.has('inventory.adjust'):this.branch.has('inventory.transfer')}
 protected valid(){
  if(!this.warehouseId()||this.form.invalid||!this.lines().length)return false;
  if(!this.isCount&&(!this.targetBranch()||!this.targetWarehouse()||this.targetWarehouse()===this.warehouseId()))return false;
  return this.lines().every(line=>{
   if(!line.articuloId||!(this.isCount?line.ubicacionId:line.ubicacionOrigenId&&line.ubicacionDestinoId))
    return false;
   try{
    const n=parseApiDecimal(line.cantidad);
    return this.isCount?n.greaterThanOrEqualTo(0):n.greaterThan(0);
   }catch{return false}
  });
 }
 protected async save(){
  if(!this.valid()){this.form.markAllAsTouched();this.error.set('Completa el documento antes de crearlo.');return}
  const rows=this.lines(),nota=this.form.controls.nota.value.trim();
  const keys=rows.map(l=>[l.articuloId,
   this.isCount?l.ubicacionId:l.ubicacionOrigenId,l.loteId,
   this.isCount?'':l.ubicacionDestinoId].join('|'));
  if(new Set(keys).size!==keys.length){this.error.set('Existen líneas duplicadas.');return}
  const count:CountCreate={almacenId:this.warehouseId(),nota,lineas:rows.map(l=>({
   articuloId:l.articuloId,ubicacionId:l.ubicacionId,
   ...(l.loteId?{loteId:l.loteId}:{}),cantidadContada:toApiDecimal(l.cantidad),
   ...(l.costoUnitarioEntrada?{costoUnitarioEntrada:toApiDecimal(l.costoUnitarioEntrada)}:{})
  }))};
  const transfer:TransferCreate={almacenOrigenId:this.warehouseId(),
   almacenDestinoId:this.targetWarehouse(),nota,lineas:rows.map(l=>({
    articuloId:l.articuloId,ubicacionOrigenId:l.ubicacionOrigenId,
    ubicacionDestinoId:l.ubicacionDestinoId,
    ...(l.loteId?{loteId:l.loteId}:{}),cantidad:toApiDecimal(l.cantidad)
   }))};
  this.error.set(null);
  const result=await this.action.runConfirmed(this.dialog,{
   title:this.isCount?'Crear conteo':'Crear transferencia',
   message:'El documento se guardará como BORRADOR. ¿Confirmas la creación?',
   confirmText:'Crear borrador'},
   async()=>this.isCount?await firstValueFrom(this.api.createCount(count)):await firstValueFrom(this.api.createTransfer(transfer)));
  if(!result)return;
  if(!result.ok){if(result.reason==='error')this.error.set(gcErrorMessage(result.error));return}
  this.form.reset({nota:''});this.lines.set([emptyLine()]);this.warehouseId.set('');
  this.notice.show('Borrador creado.','success');
  await this.router.navigate(['/inventory/operations',this.isCount?'counts':'transfers',result.value.id]);
 }
 hasUnsavedChanges(){return this.form.dirty||this.lines().some(l=>!!l.articuloId||!!l.cantidad)}
}
