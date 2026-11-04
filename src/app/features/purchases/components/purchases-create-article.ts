import {Component,inject,output,signal} from '@angular/core';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {InventoryApi} from '../../inventory/data-access/inventory.api';
import type {Article,InventoryKind} from '../../inventory/data-access/inventory.models';
import {ARTICLE_KINDS} from '../../inventory/data-access/inventory.models';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {firstValueFrom} from 'rxjs';
@Component({
 selector:'gc-purchases-create-article',
 imports:[GcInventoryPicker,GcSearchSelect],
 template:`<section class="pur-card">
  <h3>Nuevo artículo</h3>
  <div class="pur-grid">
   <div class="pur-field"><label for="pur-inline-art-name">Nombre del insumo</label>
    <input id="pur-inline-art-name" [value]="name()" maxlength="160"
     (input)="name.set($any($event.target).value)" placeholder="Ej. Leche entera"/>
   </div>
   <div class="pur-field"><label for="pur-inline-art-code">Código</label>
    <input id="pur-inline-art-code" [value]="code()" maxlength="50"
     (input)="code.set($any($event.target).value)" placeholder="Ej. LECHE-001"/>
   </div>
   <gc-search-select id="pur-inline-art-kind" label="Tipo" [items]="kinds"
    [value]="kind()" [clearable]="false" [searchable]="false"
    (valueChange)="kind.set($any($event))"/>
   <gc-inventory-picker id="pur-inline-art-unit" kind="unit" label="Unidad base"
    [value]="unitId()" (valueChange)="unitId.set($event)"/>
  </div>
  <div class="pur-inline">
   <label><input type="checkbox" [checked]="requiresLot()"
    (change)="requiresLot.set($any($event.target).checked)"/> Controlar por lote</label>
   <label><input type="checkbox" [checked]="requiresExpiry()"
    (change)="requiresExpiry.set($any($event.target).checked);requiresLot.set(requiresExpiry()||requiresLot())"/>
    Requiere vencimiento</label>
  </div>
  @if(error()){<p class="pur-alert" role="alert">{{error()}}</p>}
  <div class="pur-actions">
   <button class="pur-primary" type="button" [disabled]="busy()||!name().trim()||!unitId()"
    (click)="save()">{{busy()?'Creando…':'Crear y seleccionar'}}</button>
   <button type="button" [disabled]="busy()" (click)="cancel.emit()">Volver</button>
  </div>
 </section>`,
 styleUrl:'../purchases.scss'
})
export class GcPurchasesCreateArticle {
 readonly created=output<Article>();readonly cancel=output<void>();
 private readonly api=inject(InventoryApi);
 private readonly notice=inject(GcNotificationService);
 protected readonly name=signal('');protected readonly code=signal('');
 protected readonly kind=signal<InventoryKind>('INGREDIENTE');protected readonly unitId=signal('');
 protected readonly requiresLot=signal(false);protected readonly requiresExpiry=signal(false);
 protected readonly kinds=ARTICLE_KINDS.map(x=>({id:x.value,label:x.label}));
 protected readonly busy=signal(false);protected readonly error=signal('');
 protected async save(){
  if(this.busy()||!this.name().trim()||!this.unitId())return;
  if(!/^[A-Za-z][A-Za-z0-9_-]{1,49}$/.test(this.code().trim())){
   this.error.set('Código inválido. Debe comenzar con una letra y tener de 2 a 50 caracteres.');return;
  }
  this.busy.set(true);this.error.set('');
  try{
   const article=await firstValueFrom(this.api.createArticle({
    codigo:this.code().trim(),nombre:this.name().trim(),tipo:this.kind(),unidadBaseId:this.unitId(),
    requiereLote:this.requiresLot()||this.requiresExpiry(),requiereVencimiento:this.requiresExpiry()
   }));
   this.notice.show('Artículo creado.','success');this.created.emit(article);
  }catch(e){this.error.set(gcErrorMessage(e));this.notice.show(gcErrorMessage(e),'error',0)}
  finally{this.busy.set(false)}
 }
}
