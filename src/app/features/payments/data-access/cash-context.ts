import {computed,inject,Injectable,signal} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcSessionService} from '../../../core/auth/gc-session.service';
import {PaymentsApi} from './payments.api';
import type {CashRegister,CashShift} from './payments.models';
import {paymentError} from './payments.helpers';
import {PaymentsAccess} from './payments-access';
@Injectable({providedIn:'root'})
export class CashContext{
 private readonly api=inject(PaymentsApi);
 private readonly branch=inject(GcBranchContext);
 private readonly session=inject(GcSessionService);
 private readonly access=inject(PaymentsAccess);
 readonly registers=signal<CashRegister[]>([]);
 readonly shifts=signal<CashShift[]>([]);
 readonly loading=signal(false);
 readonly error=signal('');
 private loadedFor='';
 readonly ownShift=computed(()=>this.shifts().find(x=>!x.cerradaEn&&
  x.cajeroId===this.session.user()?.id)??null);
 readonly ownShiftId=computed(()=>this.ownShift()?.id??'');
 private generation=0;
 async refresh(force=false){
  const branch=this.branch.branchId();
  if(!branch||!this.access.canCashRead()){
   this.loadedFor='';this.registers.set([]);this.shifts.set([]);return;
  }
  if(!force&&this.loadedFor===branch&&this.shifts().length)return;
  const gen=++this.generation;this.loading.set(true);this.error.set('');
  try{
   const [registers,shifts]=await Promise.all([
    firstValueFrom(this.api.registers(branch)),
    firstValueFrom(this.api.shifts(branch,1,100))
   ]);
   if(gen!==this.generation||branch!==this.branch.branchId())return;
   this.registers.set(registers);this.shifts.set(shifts.data);this.loadedFor=branch;
  }catch(e){if(gen===this.generation){this.error.set(paymentError(e));this.loadedFor=''}}
  finally{if(gen===this.generation)this.loading.set(false)}
 }
 clear(){this.generation++;this.loadedFor='';this.registers.set([]);this.shifts.set([]);this.error.set('')}
}
