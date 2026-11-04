import {Component,inject,output,signal} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {PurchasesApi} from '../data-access/purchases.api';
import type {PurchaseSupplier} from '../data-access/purchases.models';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {gcErrorMessage} from '../../../core/http/api-error';
@Component({
 selector:'gc-purchases-create-supplier',
 template:`<section class="pur-card">
  <h3>Nuevo proveedor</h3>
  <div class="pur-grid">
   <div class="pur-field"><label for="pur-inline-supplier-name">Nombre</label>
    <input id="pur-inline-supplier-name" maxlength="160" [value]="name()"
     (input)="name.set($any($event.target).value)" placeholder="Nombre del proveedor"/>
   </div>
   <div class="pur-field"><label for="pur-inline-supplier-tax">NIT (opcional)</label>
    <input id="pur-inline-supplier-tax" maxlength="60" [value]="tax()"
     (input)="tax.set($any($event.target).value)"/>
   </div>
  </div>
  @if(error()){<p role="alert" class="pur-alert">{{error()}}</p>}
  <div class="pur-actions">
   <button type="button" class="pur-primary" [disabled]="busy()||name().trim().length<2"
    (click)="save()">{{busy()?'Guardando…':'Crear y seleccionar'}}</button>
   <button type="button" [disabled]="busy()" (click)="dismiss.emit()">Volver</button>
  </div>
 </section>`,
 styleUrl:'../purchases.scss'
})
export class GcPurchasesCreateSupplier {
 readonly created=output<PurchaseSupplier>();readonly dismiss=output<void>();
 private readonly api=inject(PurchasesApi);private readonly notice=inject(GcNotificationService);
 protected readonly name=signal('');protected readonly tax=signal('');
 protected readonly busy=signal(false);protected readonly error=signal('');
 protected async save(){
  if(this.busy()||this.name().trim().length<2)return;
  this.busy.set(true);this.error.set('');
  try{
   const provider=await firstValueFrom(this.api.createSupplier({
    nombre:this.name().trim(),...(this.tax().trim()?{nit:this.tax().trim()}:{}),
   }));
   this.notice.show('Proveedor creado.','success');this.created.emit(provider);
  }catch(e){this.error.set(gcErrorMessage(e));this.notice.show(gcErrorMessage(e),'error',0)}
  finally{this.busy.set(false)}
 }
}
