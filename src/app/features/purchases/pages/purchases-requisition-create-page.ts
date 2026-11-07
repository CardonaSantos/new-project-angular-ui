
import {Component,inject,signal} from '@angular/core';
import {Router} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {PurchasesApi} from '../data-access/purchases.api';

interface RequestLine{key:string;articuloId:string;cantidad:string}
const emptyLine=():RequestLine=>({key:crypto.randomUUID(),articuloId:'',cantidad:''});
const decimal=(v:string):string|null=>{
 const n=v.trim();
 return /^(?=.*[1-9])(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/.test(n)?n:null;
};

@Component({
 selector:'gc-purchases-requisition-create-page',
 imports:[GcPageHeader,GcButtonDirective,GcErrorState,GcInventoryPicker],
 template:`
 <div class="req-page req-narrow">
  <gc-page-header title="Nueva requisición" description="Solicita insumos para un almacén."/>
  <section class="req-card">
   <gc-inventory-picker id="req-warehouse" kind="warehouse" label="Almacén que necesita insumos"
    [branchId]="context.branchId()??''" [value]="destId()"
    (valueChange)="destId.set($event);dirty=true"/>
   <div class="req-field"><label for="req-note">Nota (opcional)</label>
    <textarea id="req-note" rows="2" maxlength="500" [value]="note()"
     (input)="note.set($any($event.target).value);dirty=true"></textarea>
   </div>
  </section>

  <section class="req-card">
   <div class="req-row"><h2>Insumos</h2>
    <button type="button" gcButton variant="outline" (click)="addLine()">Agregar insumo</button></div>
   @for(l of lines();track l.key;let i=$index){
    <div class="req-line">
     <div class="req-row"><strong>Insumo {{i+1}}</strong>
      @if(lines().length>1){
       <button type="button" gcButton variant="outline" (click)="removeLine(l.key)">Quitar</button>
      }
     </div>
     <div class="req-grid">
      <gc-inventory-picker [id]="'req-item-'+l.key" kind="article" label="Artículo"
       [value]="l.articuloId" (valueChange)="patch(l.key,'articuloId',$event)"/>
      <div class="req-field"><label [for]="'req-qty-'+l.key">Cantidad solicitada (unidad base)</label>
       <input [id]="'req-qty-'+l.key" inputmode="decimal" [value]="l.cantidad"
        (input)="patch(l.key,'cantidad',$any($event.target).value)" placeholder="Ej. 10"/>
      </div>
     </div>
    </div>
   }
  </section>

  @if(error()){<p class="req-alert" role="alert">{{error()}}</p>}
  <div class="req-actions">
   <button type="button" gcButton [disabled]="!valid()||saving()" (click)="save()">
    {{saving()?'Creando…':'Crear requisición'}}</button>
  </div>
 </div>`,
 styleUrl:'../requisitions.scss'
})
export class GcPurchasesRequisitionCreatePage {
 private readonly router=inject(Router);
 protected readonly context=inject(GcBranchContext);
 private readonly api=inject(PurchasesApi);
 private readonly notices=inject(GcNotificationService);
 protected readonly destId=signal('');
 protected readonly note=signal('');
 protected readonly lines=signal<RequestLine[]>([emptyLine()]);
 protected readonly saving=signal(false);
 protected readonly error=signal<string|null>(null);
 dirty=false;
 private key=crypto.randomUUID();
 protected valid(){
  return Boolean(this.destId()&&this.lines().length&&
   this.lines().every(l=>l.articuloId&&decimal(l.cantidad))&&
   new Set(this.lines().map(l=>l.articuloId)).size===this.lines().length);
 }
 protected addLine(){this.lines.update(ls=>[...ls,emptyLine()]);this.dirty=true}
 protected removeLine(key:string){this.lines.update(ls=>ls.filter(l=>l.key!==key));this.dirty=true}
 protected patch<K extends keyof RequestLine>(key:string,field:K,value:RequestLine[K]){
  this.lines.update(ls=>ls.map(l=>l.key===key?{...l,[field]:value}:l));this.dirty=true;
 }
 protected async save(){
  if(!this.valid()||this.saving())return;
  this.saving.set(true);this.error.set(null);
  try{
   const r=await firstValueFrom(this.api.createRequisition({
    almacenDestinoId:this.destId(),nota:this.note().trim()||undefined,claveOperacion:this.key,
    lineas:this.lines().map(l=>({articuloId:l.articuloId,cantidadSolicitada:decimal(l.cantidad)!})),
   }));
   this.dirty=false;
   this.notices.show('Requisición creada.','success');
   await this.router.navigate(['/purchases/requisitions',r.id]);
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.saving.set(false)}
 }
 hasUnsavedChanges(){return this.dirty&&!this.saving()}
}
