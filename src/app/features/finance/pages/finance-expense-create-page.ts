
import {Component,OnInit,computed,effect,inject,signal,untracked} from '@angular/core';
import {ActivatedRoute,Router} from '@angular/router';
import {ReactiveFormsModule,FormControl,FormGroup,Validators} from '@angular/forms';
import {Subject,debounceTime,distinctUntilChanged,firstValueFrom} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {gcErrorMessage} from '../../../core/http/api-error';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {toApiDecimal} from '../../../shared/formatting';
import {CashContext} from '../../payments/data-access/cash-context';
import {PurchasesApi} from '../../purchases/data-access/purchases.api';
import type {PurchaseSupplier} from '../../purchases/data-access/purchases.models';
import {GcFinanceNav} from '../finance-nav';
import {FinanceApi} from '../data-access/finance.api';
import {FinanceIntentService} from '../data-access/finance-intent.service';
import type {FinanceAccount,FinanceExpenseOrigin} from '../data-access/finance.models';

const AMOUNT_PATTERN=/^(?:0|[1-9]\d{0,13})(?:\.\d{1,2})?$/;

@Component({
 selector:'gc-finance-expense-create-page',
 imports:[ReactiveFormsModule,GcPageHeader,GcButtonDirective,GcSearchSelect,GcFinanceNav],
 template:`
 <div class="fin-page fin-narrow">
  <gc-page-header title="Nuevo gasto operativo"
   description="Registra un gasto pagado desde una caja abierta o cargado directamente a una cuenta financiera."/>
  <gc-finance-nav/>
  <form class="fin-card fin-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
   <fieldset class="fin-section"><legend>1. Origen del gasto</legend>
    <div class="fin-row" role="radiogroup" aria-label="Origen del gasto">
     <label><input type="radio" name="origen" value="CAJA" formControlName="origen"/> Desde caja</label>
     <label><input type="radio" name="origen" value="CUENTA_FINANCIERA" formControlName="origen"/> Desde cuenta financiera</label>
    </div>
    @if(form.controls.origen.value==='CAJA'){
     @if(ownShift()){
      <small class="fin-muted">Se cargará al turno abierto de {{ownShift()?.caja?.nombre??'tu caja'}}.</small>
     }@else{
      <p class="fin-alert" role="alert">No tienes un turno de caja abierto en esta sucursal. Abre un turno antes de registrar el gasto.</p>
     }
    }@else{
     <div class="fin-field"><label for="expense-account">Cuenta financiera</label>
      <gc-search-select id="expense-account" label="Cuenta financiera" [items]="accountChoices()"
       [value]="form.controls.cuentaFinancieraId.value" [loading]="accountsBusy()"
       (valueChange)="form.controls.cuentaFinancieraId.setValue($event)"/>
     </div>
    }
   </fieldset>
   <fieldset class="fin-section"><legend>2. Detalle</legend>
    <div class="fin-grid">
     <div class="fin-field"><label for="expense-amount">Monto</label>
      <input id="expense-amount" formControlName="monto" inputmode="decimal" placeholder="Ej. 150.00"
       [attr.aria-invalid]="form.controls.monto.invalid&&form.controls.monto.touched"/>
     </div>
     <div class="fin-field"><label for="expense-category">Categoría</label>
      <input id="expense-category" formControlName="categoria" maxlength="100" placeholder="Ej. Mantenimiento"
       [attr.aria-invalid]="form.controls.categoria.invalid&&form.controls.categoria.touched"/>
     </div>
    </div>
    <div class="fin-field"><label for="expense-description">Descripción</label>
     <input id="expense-description" formControlName="descripcion" maxlength="300"
      placeholder="Ej. Reparación de refrigerador"
      [attr.aria-invalid]="form.controls.descripcion.invalid&&form.controls.descripcion.touched"/>
    </div>
    <div class="fin-grid">
     <div class="fin-field"><label for="expense-supplier">Proveedor (opcional)</label>
      <gc-search-select id="expense-supplier" label="Proveedor (opcional)" [items]="supplierChoices()"
       [value]="supplierId()" [loading]="supplierBusy()" placeholder="Buscar proveedor…"
       (valueChange)="supplierId.set($event)" (searchChange)="supplierSearch.next($event)"/>
     </div>
     <div class="fin-field"><label for="expense-document">Documento de referencia (opcional)</label>
      <input id="expense-document" formControlName="documentoReferencia" maxlength="100" placeholder="Ej. Factura 00123"
       [attr.aria-invalid]="form.controls.documentoReferencia.invalid&&form.controls.documentoReferencia.touched"/>
     </div>
    </div>
   </fieldset>
   @if(saveError()){<p class="fin-alert" role="alert">{{saveError()}}</p>}
   <div class="fin-actions">
    <button type="submit" gcButton [disabled]="!canSubmit()">
     {{action.busy()?'Registrando…':'Registrar gasto'}}</button>
   </div>
   @if(!canSubmit()&&blockedReason();as reason){<small class="fin-muted">{{reason}}</small>}
  </form>
 </div>`,
 styleUrl:'../finance.scss'
})
export class GcFinanceExpenseCreatePage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly branch=inject(GcBranchContext);
 private readonly api=inject(FinanceApi);
 private readonly purchases=inject(PurchasesApi);
 private readonly intents=inject(FinanceIntentService);
 private readonly dialog=inject(ConfirmDialogService);
 protected readonly cash=inject(CashContext);
 protected readonly ownShift=this.cash.ownShift;
 protected readonly action=new GcConfirmedAction();
 protected readonly saveError=signal<string|null>(null);
 protected readonly intentReady=signal(false);
 protected readonly accounts=signal<FinanceAccount[]>([]);
 protected readonly accountsBusy=signal(false);
 protected readonly accountChoices=computed(()=>this.accounts().map(a=>({id:a.id,label:a.nombre})));
 protected readonly supplierId=signal('');
 protected readonly suppliers=signal<PurchaseSupplier[]>([]);
 protected readonly supplierChoices=computed(()=>this.suppliers().map(s=>({id:s.id,label:s.nombre})));
 protected readonly supplierBusy=signal(false);
 protected readonly supplierSearch=new Subject<string>();
 private operationId='';
 private sucursalId='';
 private supplierGeneration=0;
 protected readonly form=new FormGroup({
  origen:new FormControl<FinanceExpenseOrigin>('CAJA',{nonNullable:true}),
  cuentaFinancieraId:new FormControl('',{nonNullable:true}),
  monto:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.pattern(AMOUNT_PATTERN)]}),
  categoria:new FormControl('',{nonNullable:true,validators:Validators.minLength(2)}),
  descripcion:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.minLength(3)]}),
  documentoReferencia:new FormControl('',{nonNullable:true,validators:Validators.minLength(2)}),
 });
 protected canSubmit(){
  if(this.form.invalid||this.action.busy()||!this.intentReady())return false;
  if(this.form.controls.origen.value==='CAJA')return !!this.ownShift();
  return !!this.form.controls.cuentaFinancieraId.value;
 }
 protected blockedReason(){
  if(!this.intentReady())return 'Preparando el formulario…';
  if(this.form.controls.origen.value==='CAJA'&&!this.ownShift())
   return 'Abre un turno de caja en esta sucursal para continuar.';
  if(this.form.controls.origen.value==='CUENTA_FINANCIERA'&&!this.form.controls.cuentaFinancieraId.value)
   return 'Selecciona una cuenta financiera.';
  if(this.form.invalid&&this.form.touched)return 'Revisa los campos marcados en rojo.';
  return null;
 }
 constructor(){
  this.supplierSearch.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed())
   .subscribe(term=>void this.searchSuppliers(term));
  this.form.controls.origen.valueChanges.pipe(takeUntilDestroyed()).subscribe(origen=>{
   if(origen==='CAJA')this.form.controls.cuentaFinancieraId.setValue('');
  });
  effect(()=>{if(this.branch.branchId())void untracked(()=>this.cash.refresh(true))});
 }
 async ngOnInit(){
  this.sucursalId=this.route.snapshot.queryParamMap.get('sucursalId')||this.branch.branchId()||'';
  if(!this.sucursalId){this.saveError.set('Selecciona una sucursal antes de registrar un gasto.');return}
  this.accountsBusy.set(true);
  try{
   const [intentId,accounts]=await Promise.all([
    this.intents.require(this.sucursalId,'FIN_EXPENSE_CREATE'),
    firstValueFrom(this.api.accounts({sucursalId:this.sucursalId,limit:100})),
   ]);
   this.operationId=intentId;this.intentReady.set(true);
   this.accounts.set(accounts.data.filter(a=>a.activa));
  }catch(e){this.saveError.set(gcErrorMessage(e))}
  finally{this.accountsBusy.set(false)}
 }
 private async searchSuppliers(term:string){
  const gen=++this.supplierGeneration;this.supplierBusy.set(true);
  try{
   const result=await firstValueFrom(this.purchases.suppliers({sucursalId:this.sucursalId,search:term,limit:20}));
   if(gen!==this.supplierGeneration)return;
   this.suppliers.set(result.data);
  }finally{if(gen===this.supplierGeneration)this.supplierBusy.set(false)}
 }
 protected async save(){
  if(!this.canSubmit()){this.form.markAllAsTouched();return}
  const v=this.form.getRawValue();
  let monto:string;
  try{monto=toApiDecimal(v.monto)}catch(e){this.saveError.set(gcErrorMessage(e));return}
  const shift=this.ownShift();
  this.saveError.set(null);
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Registrar gasto',message:'¿Registrar este gasto operativo?',confirmText:'Registrar'},
   ()=>firstValueFrom(this.api.createExpense({
    operationId:this.operationId,sucursalId:this.sucursalId,origen:v.origen,monto,
    descripcion:v.descripcion.trim(),
    ...(v.categoria.trim()?{categoria:v.categoria.trim()}:{}),
    ...(this.supplierId()?{proveedorId:this.supplierId()}:{}),
    ...(v.origen==='CAJA'&&shift?{turnoId:shift.id}:{}),
    ...(v.origen==='CUENTA_FINANCIERA'?{cuentaFinancieraId:v.cuentaFinancieraId}:{}),
    ...(v.documentoReferencia.trim()?{documentoReferencia:v.documentoReferencia.trim()}:{}),
   })));
  if(!r)return;
  if(!r.ok){
   if(r.reason==='error'){this.saveError.set(gcErrorMessage(r.error));this.intents.release(this.sucursalId,'FIN_EXPENSE_CREATE')}
   return;
  }
  this.form.markAsPristine();
  await this.router.navigate(['/finance/expenses',r.value.id]);
 }
 hasUnsavedChanges(){return this.form.dirty}
}
