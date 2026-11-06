
import {Component,inject,OnInit,signal} from '@angular/core';
import {ActivatedRoute,Router} from '@angular/router';
import {ReactiveFormsModule,FormControl,FormGroup,Validators} from '@angular/forms';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {gcErrorMessage} from '../../../core/http/api-error';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcFinanceNav} from '../finance-nav';
import {FinanceApi} from '../data-access/finance.api';
import {FinanceIntentService} from '../data-access/finance-intent.service';
import type {FinanceAccountType} from '../data-access/finance.models';

const TIPOS:{id:FinanceAccountType;label:string}[]=[
 {id:'BANCO',label:'Banco'},{id:'TARJETA_EMPRESA',label:'Tarjeta de empresa'},
 {id:'EFECTIVO_EXTERNO',label:'Efectivo externo'}];

@Component({
 selector:'gc-finance-account-create-page',
 imports:[ReactiveFormsModule,GcPageHeader,GcButtonDirective,GcFinanceNav],
 template:`
 <div class="fin-page fin-narrow">
  <gc-page-header title="Nueva cuenta financiera"
   description="Registra una cuenta de banco, tarjeta de empresa o efectivo externo. El tipo no podrá cambiarse después."/>
  <gc-finance-nav/>
  <form class="fin-card fin-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
   <fieldset class="fin-section"><legend>Datos de la cuenta</legend>
    <div class="fin-grid">
     <div class="fin-field"><label for="account-name">Nombre</label>
      <input id="account-name" formControlName="nombre" maxlength="150" placeholder="Ej. Banco Industrial — Cta. 123"
       [attr.aria-invalid]="form.controls.nombre.invalid&&form.controls.nombre.touched"/>
     </div>
     <div class="fin-field"><label for="account-type">Tipo</label>
      <select id="account-type" formControlName="tipo"
       [attr.aria-invalid]="form.controls.tipo.invalid&&form.controls.tipo.touched">
       @for(t of tipos;track t.id){<option [value]="t.id">{{t.label}}</option>}
      </select>
      <small class="fin-muted">No podrás cambiar el tipo después de crear la cuenta.</small>
     </div>
    </div>
   </fieldset>
   @if(saveError()){<p class="fin-alert" role="alert">{{saveError()}}</p>}
   <div class="fin-actions">
    <button type="submit" gcButton [disabled]="form.invalid||action.busy()||!intentReady()">
     {{action.busy()?'Creando…':'Crear cuenta'}}</button>
   </div>
  </form>
 </div>`,
 styleUrl:'../finance.scss'
})
export class GcFinanceAccountCreatePage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly branch=inject(GcBranchContext);
 private readonly api=inject(FinanceApi);
 private readonly intents=inject(FinanceIntentService);
 private readonly dialog=inject(ConfirmDialogService);
 protected readonly tipos=TIPOS;
 protected readonly action=new GcConfirmedAction();
 protected readonly saveError=signal<string|null>(null);
 protected readonly intentReady=signal(false);
 private operationId='';
 private sucursalId='';
 protected readonly form=new FormGroup({
  nombre:new FormControl('',{nonNullable:true,validators:Validators.required}),
  tipo:new FormControl<FinanceAccountType>('BANCO',{nonNullable:true,validators:Validators.required})
 });
 async ngOnInit(){
  this.sucursalId=this.route.snapshot.queryParamMap.get('sucursalId')||this.branch.branchId()||'';
  if(!this.sucursalId){this.saveError.set('Selecciona una sucursal antes de crear una cuenta.');return}
  try{
   this.operationId=await this.intents.require(this.sucursalId,'FIN_ACCOUNT_CREATE');
   this.intentReady.set(true);
  }catch(e){this.saveError.set(gcErrorMessage(e))}
 }
 protected async save(){
  if(this.form.invalid||!this.intentReady()){this.form.markAllAsTouched();return}
  const v=this.form.getRawValue();
  this.saveError.set(null);
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Crear cuenta',message:'¿Registrar esta cuenta financiera?',confirmText:'Crear cuenta'},
   ()=>firstValueFrom(this.api.createAccount({
    operationId:this.operationId,sucursalId:this.sucursalId,nombre:v.nombre.trim(),tipo:v.tipo})));
  if(!r)return;
  if(!r.ok){
   if(r.reason==='error'){this.saveError.set(gcErrorMessage(r.error));this.intents.release(this.sucursalId,'FIN_ACCOUNT_CREATE')}
   return;
  }
  this.form.markAsPristine();
  await this.router.navigate(['/finance/accounts',r.value.id]);
 }
 hasUnsavedChanges(){return this.form.dirty}
}
