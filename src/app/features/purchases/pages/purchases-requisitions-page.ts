import {DatePipe} from '@angular/common';
import {Component,inject,signal,effect,untracked} from '@angular/core';
import {RouterLink,Router} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {GcInventoryPicker} from '../../inventory/components/inventory-picker';
import {PurchasesApi} from '../data-access/purchases.api';
import {PurchasesAccess} from '../data-access/purchases-access';
import type {SupplyRequisition} from '../data-access/purchases.models';
import {decimal,newKey} from '../data-access/purchases.helpers';
import {GcPurchasesNav} from '../purchases-nav';
interface RequestLine{key:string;articuloId:string;cantidad:string}
const empty=():RequestLine=>({key:newKey(),articuloId:'',cantidad:''});
@Component({
 selector:'gc-purchases-requisitions-page',
 imports:[RouterLink,DatePipe,GcPurchasesNav,GcInventoryPicker],
 template:`<main class="pur-page"><gc-purchases-nav/>
  <header class="pur-heading"><h1>Requisiciones de insumos</h1>
   @if(access.canSupplyRequest()){
    <button class="pur-primary" type="button" (click)="editing.update(v=>!v)">
     {{editing()?'Cerrar formulario':'Solicitar insumos'}}
    </button>
   }
  </header>
  @if(editing()&&access.canSupplyRequest()){
   <section class="pur-card">
    <h2>Nueva solicitud</h2>
    <gc-inventory-picker id="pur-req-warehouse" kind="warehouse" label="Almacén que necesita insumos"
     [branchId]="context.branchId()??''" [value]="destId()"
     (valueChange)="destId.set($event)"/>
    <div class="pur-lines">
     @for(l of formLines();track l.key;let i=$index){
      <div class="pur-line">
       <div class="pur-line-header"><strong>Insumo {{i+1}}</strong>
        @if(formLines().length>1){<button type="button" (click)="removeLine(l.key)">Quitar</button>}
       </div>
       <div class="pur-grid">
        <gc-inventory-picker [id]="'pur-req-item-'+l.key" kind="article" label="Artículo"
         [value]="l.articuloId" (valueChange)="patch(l.key,'articuloId',$event)"/>
        <div class="pur-field"><label [for]="'pur-req-qty-'+l.key">Cantidad solicitada (unidad base)</label>
         <input [id]="'pur-req-qty-'+l.key" inputmode="decimal" [value]="l.cantidad"
          (input)="patch(l.key,'cantidad',$any($event.target).value)" placeholder="Ej. 10"/>
        </div>
       </div>
      </div>
     }
    </div>
    <div class="pur-actions"><button type="button" (click)="formLines.update(ls=>[...ls,empty()])">Agregar insumo</button></div>
    <div class="pur-field"><label for="pur-req-note">Nota (opcional)</label>
     <textarea id="pur-req-note" [value]="note()" rows="2" maxlength="500"
      (input)="note.set($any($event.target).value)"></textarea>
    </div>
    @if(formError()){<p role="alert" class="pur-alert">{{formError()}}</p>}
    <div class="pur-actions">
     <button type="button" class="pur-primary" [disabled]="saving()||!canSave()"
      (click)="create()">Crear requisición</button>
     <button type="button" (click)="editing.set(false)">Cancelar</button>
    </div>
   </section>
  }
  <section class="pur-card">
   <div class="pur-heading"><h2>Solicitudes</h2>
    <button type="button" (click)="load()" [disabled]="busy()">Actualizar</button>
   </div>
   @if(error()){<p role="alert" class="pur-alert">{{error()}}</p>}
   @if(busy()){<p role="status" class="pur-muted">Consultando requisiciones…</p>}
   <div class="pur-table-scroll">
    <table class="pur-table"><thead><tr><th>Número</th><th>Fecha</th><th>Insumos</th><th>Estado</th><th></th></tr></thead>
     <tbody>
      @for(r of rows();track r.id){
       <tr class="pur-data-row">
        <td data-label="Número"><strong>{{r.numero}}</strong></td>
        <td data-label="Fecha">{{r.creadaEn|date:'dd/MM/yyyy'}}</td>
        <td data-label="Insumos">{{r.lineas.length}}</td>
        <td data-label="Estado"><span class="pur-badge">{{r.estadoVisible??r.estado}}</span></td>
        <td data-label="Acción"><a class="pur-link" [routerLink]="['/purchases/requisitions',r.id]">Ver solicitud</a></td>
       </tr>
      } @empty {@if(!busy()){<tr><td colspan="5" class="pur-empty">No hay requisiciones.</td></tr>}}
     </tbody>
    </table>
   </div>
   <div class="pur-pagination">
    <span class="pur-muted">{{total()}} solicitudes · Página {{page()}} de {{pages()||1}}</span>
    <div class="pur-actions">
     <button type="button" (click)="change(-1)" [disabled]="page()<=1||busy()">Anterior</button>
     <button type="button" (click)="change(1)" [disabled]="page()>=pages()||busy()">Siguiente</button>
    </div>
   </div>
  </section>
 </main>`,
 styleUrl:'../purchases.scss'
})
export class GcPurchasesRequisitionsPage {
 protected readonly context=inject(GcBranchContext);
 protected readonly access=inject(PurchasesAccess);
 private readonly api=inject(PurchasesApi);private readonly router=inject(Router);
 private readonly notices=inject(GcNotificationService);
 protected readonly editing=signal(false);protected readonly destId=signal('');
 protected readonly formLines=signal<RequestLine[]>([empty()]);
 protected readonly note=signal('');protected readonly saving=signal(false);protected readonly formError=signal('');
 protected readonly rows=signal<SupplyRequisition[]>([]);
 protected readonly page=signal(1);protected readonly pages=signal(0);protected readonly total=signal(0);
 protected readonly busy=signal(false);protected readonly error=signal('');
 private key=newKey();private generation=0;
 protected readonly canSave=()=>Boolean(this.destId()&&this.formLines().length&&
  this.formLines().every(l=>l.articuloId&&decimal(l.cantidad))&&
  new Set(this.formLines().map(l=>l.articuloId)).size===this.formLines().length);
 constructor(){effect(()=>{
  const branch=this.context.branchId();
  untracked(()=>{this.page.set(1);this.destId.set('');this.rows.set([]);if(branch)void this.load()});
 })}
 protected patch<K extends keyof RequestLine>(key:string,field:K,value:RequestLine[K]){
  this.formLines.update(ls=>ls.map(l=>l.key===key?{...l,[field]:value}:l));
  this.key=newKey();
 }
 protected removeLine(key:string){this.formLines.update(ls=>ls.filter(l=>l.key!==key));this.key=newKey()}
 protected change(d:number){const n=this.page()+d;if(n<1||n>this.pages()||this.busy())return;this.page.set(n);void this.load()}
 protected async load(){
  if(!this.context.branchId()||!this.access.canSupplyRead())return;
  const generation=++this.generation,branch=this.context.branchId()!;
  this.busy.set(true);this.error.set('');
  try{
   const r=await firstValueFrom(this.api.requisitions({sucursalId:branch,page:this.page(),limit:20}));
   if(generation===this.generation&&branch===this.context.branchId()){
    this.rows.set(r.data);this.total.set(r.meta.total);this.pages.set(r.meta.totalPages)
   }
  }catch(e){if(generation===this.generation)this.error.set(gcErrorMessage(e))}
  finally{if(generation===this.generation)this.busy.set(false)}
 }
 protected async create(){
  if(this.saving()||!this.canSave()||!this.access.canSupplyRequest())return;
  this.saving.set(true);this.formError.set('');
  try{
   const r=await firstValueFrom(this.api.createRequisition({
    almacenDestinoId:this.destId(),nota:this.note().trim(),claveOperacion:this.key,
    lineas:this.formLines().map(l=>({articuloId:l.articuloId,cantidadSolicitada:decimal(l.cantidad)!}))
   }));
   this.notices.show('Requisición creada.','success');
   this.key=newKey();this.formLines.set([empty()]);this.editing.set(false);
   await this.router.navigate(['/purchases/requisitions',r.id]);
  }catch(e){this.formError.set(gcErrorMessage(e))}
  finally{this.saving.set(false)}
 }
}
