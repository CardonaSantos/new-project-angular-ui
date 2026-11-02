
import {Component,OnInit,inject,signal} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcInventoryNav} from '../inventory-nav';
import {GcInventorySubnav,OPERATION_LINKS} from '../components/inventory-subnav';
import {InventoryApi} from '../data-access/inventory.api';
import {formatDecimal} from '../../../shared/formatting';
import type {InventoryMovement,CountDetail,TransferDetail} from '../data-access/inventory.models';

function formatted(value:string|null|undefined){
 try{return value==null?'—':formatDecimal(value)}catch{return '—'}
}
@Component({
 selector:'gc-inventory-document-page',
 imports:[RouterLink,GcPageHeader,GcButtonDirective,GcInventoryNav,GcInventorySubnav,GcErrorState],
 template:`
 <div class="inv-page inv-narrow">
  <gc-page-header [title]="title()"/>
  <gc-inventory-nav/><gc-inventory-subnav [links]="operationLinks" label="Operaciones"/>
  @if(page.busy()){<p role="status" class="inv-muted">Cargando documento…</p>}
  @if(page.status()==='error'){<gc-error-state [message]="gcError()" (retry)="reload()"/>}
  @if(page.data();as document){
   <section class="inv-card">
    <div class="inv-row"><h2>Detalle</h2>
     <span class="inv-muted">{{status(document)}}</span>
    </div>
    <dl class="inv-kv">
     @for(item of info(document);track item.label){
      <div><dt>{{item.label}}</dt><dd>{{item.value}}</dd></div>
     }
    </dl>
    @if(view==='count'||view==='transfer'){
     <h3>Artículos</h3>
     @for(line of lines(document);track line.key){
      <div class="inv-row">
       <div class="inv-stack"><strong>{{line.label}}</strong>
        <span class="inv-muted">{{line.description}}</span></div>
       <strong>{{line.quantity}}</strong>
      </div>
     } @empty{<p class="inv-muted">Sin líneas.</p>}
    }
    @if(view==='movement'){
     <p class="inv-muted">El Kardex es inmutable. Las correcciones se registran mediante nuevos documentos autorizados.</p>
    }
    @if(view==='count'&&status(document)==='BORRADOR'){
     <p class="inv-muted">Al confirmar, el sistema verificará que las existencias no hayan cambiado desde el conteo.</p>
    }
    @if(view==='transfer'&&status(document)==='EN_TRANSITO'){
     <p class="inv-muted">La recepción actual es total; no se admiten recepciones parciales.</p>
    }
    @if(error()){<p role="alert" class="inv-alert">{{error()}}</p>}
    <div class="inv-actions">
     @if(view==='count'&&status(document)==='BORRADOR'){
      <button gcButton type="button" [disabled]="action.busy()" (click)="act('confirm')">Confirmar conteo</button>
      <button gcButton variant="danger" type="button" [disabled]="action.busy()" (click)="act('cancel')">Cancelar conteo</button>
     }
     @if(view==='transfer'&&status(document)==='BORRADOR'){
      <button gcButton type="button" [disabled]="action.busy()" (click)="act('dispatch')">Despachar</button>
      <button gcButton variant="danger" type="button" [disabled]="action.busy()" (click)="act('cancel')">Cancelar transferencia</button>
     }
     @if(view==='transfer'&&status(document)==='EN_TRANSITO'){
      <button gcButton type="button" [disabled]="action.busy()" (click)="act('receive')">Confirmar recepción total</button>
     }
     <a [routerLink]="backLink()">Regresar al listado</a>
    </div>
   </section>
  }
 </div>`,
 styleUrl:'../inventory.scss'
})
export class GcInventoryDocumentPage implements OnInit {
 private readonly route=inject(ActivatedRoute);
 private readonly api=inject(InventoryApi);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notice=inject(GcNotificationService);
 protected readonly operationLinks=OPERATION_LINKS;
 protected readonly view=(this.route.snapshot.data['view']??'movement') as 'movement'|'count'|'transfer';
 private readonly id=this.route.snapshot.paramMap.get('id')??'';
 protected readonly page=new GcPageState<CountDetail|TransferDetail|InventoryMovement>();
 protected readonly action=new GcConfirmedAction();
 protected readonly error=signal<string|null>(null);
 protected title(){return this.view==='count'?'Detalle del conteo':this.view==='transfer'?'Transferencia':'Movimiento de inventario'}
 protected backLink(){return this.view==='count'?'/inventory/operations/counts':
  this.view==='transfer'?'/inventory/operations/transfers':'/inventory/operations/movements'}
 ngOnInit(){void this.load()}
 protected gcError(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load()}
 private async load(){
  await this.page.load(()=>firstValueFrom(this.view==='count'?this.api.count(this.id):
   this.view==='transfer'?this.api.transfer(this.id):this.api.movement(this.id)));
 }
 protected status(data:CountDetail|TransferDetail|InventoryMovement){
  if('estado' in data)return data.estado;
  return data.tipo;
 }
 protected info(data:CountDetail|TransferDetail|InventoryMovement){
  if('almacenId' in data)return [
   {label:'Almacén',value:data.almacenId},{label:'Estado',value:data.estado},
   {label:'Nota',value:data.nota??'—'},{label:'Fecha',value:data.creadoEn}];
  if('numero' in data)return [
   {label:'Número',value:data.numero},{label:'Origen',value:data.origen.nombre},
   {label:'Destino',value:data.destino.nombre},{label:'Estado',value:data.estado},
   {label:'Nota',value:data.nota??'—'}];
  return [
   {label:'Tipo',value:data.tipo},{label:'Artículo',value:data.articulo.nombre},
   {label:'Cantidad',value:formatted(data.cantidad)},{label:'Motivo',value:data.nota??'—'},
   {label:'Fecha',value:data.creadoEn}];
 }
 protected lines(data:CountDetail|TransferDetail|InventoryMovement){
  if(!('lineas' in data))return [];
  if('almacenId' in data)return data.lineas.map(l=>({key:l.id,label:l.articulo.nombre,
   description:l.ubicacion.nombre+' · Teórico '+formatted(l.cantidadTeorica)+' · Diferencia '+formatted(l.delta),
   quantity:formatted(l.cantidadContada)}));
  return data.lineas.map(l=>({key:l.id,label:l.articulo.nombre,
   description:l.lote?.codigoLote??'Sin lote',quantity:formatted(l.cantidadEnviada)}));
 }
 protected async act(kind:'confirm'|'cancel'|'dispatch'|'receive'){
  const titles:Record<string,string>={
   confirm:'Confirmar conteo',cancel:'Cancelar documento',dispatch:'Despachar transferencia',
   receive:'Confirmar recepción total'};
  const result=await this.action.runConfirmed(this.dialog,{
   title:titles[kind],
   message:kind==='receive'?'La recepción completa contabilizará la transferencia. ¿Continuar?':
    kind==='confirm'?'El conteo ajustará existencias con base en las diferencias verificadas. ¿Continuar?':
    'Esta operación modificará el estado del documento. ¿Continuar?',
   confirmText:titles[kind],danger:kind==='cancel'||kind==='confirm'},
   ()=>firstValueFrom(this.view==='count'
    ?this.api.countAction(this.id,kind as 'confirm'|'cancel')
    :this.api.transferAction(this.id,kind as 'dispatch'|'receive'|'cancel')));
  if(!result)return;
  if(!result.ok){if(result.reason==='error')this.error.set(gcErrorMessage(result.error));return}
  this.error.set(null);this.notice.show('Documento actualizado.','success');await this.load();
 }
}
