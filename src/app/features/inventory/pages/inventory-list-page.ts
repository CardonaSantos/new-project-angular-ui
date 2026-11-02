
import {Component,computed,effect,inject,signal} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {MatDialog} from '@angular/material/dialog';
import {GcImagePreviewDialog} from '../../../design-system/media/gc-image-preview-dialog';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcDataTable,type GcTableRow,type GcTableColumn} from '../../../design-system/data/gc-data-table';
import {GcTableCellDirective} from '../../../design-system/data/gc-table-cell.directive';
import {GcPagination,type GcPageChange} from '../../../design-system/data/gc-pagination';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcInventoryNav} from '../inventory-nav';
import {GcInventorySubnav,STOCK_LINKS,OPERATION_LINKS} from '../components/inventory-subnav';
import {InventoryApi} from '../data-access/inventory.api';
import {InventoryUrlState,type InventoryFilters} from '../data-access/inventory-url-state';
import {GcInventoryPicker} from '../components/inventory-picker';
import {OrganizationAccess} from '../../organization/data-access/organization-access';
import type {InventoryKind,CountStatus,TransferStatus} from '../data-access/inventory.models';
import {formatDecimal} from '../../../shared/formatting';
import {inventoryInstant,inventoryCalendar,inventoryMovementLabel} from '../data-access/inventory-presentation';

type View='articles'|'stock'|'lots'|'movements'|'counts'|'transfers';
const VIEWS:Record<View,{title:string;columns:GcTableColumn[];create?:string}> = {
 articles:{title:'Artículos',create:'/inventory/articles/new',columns:[
  {key:'nombre',label:'Artículo'},{key:'codigo',label:'Código'},{key:'tipo',label:'Tipo'},
  {key:'unidad',label:'Unidad'},{key:'estado',label:'Estado'},{key:'acciones',label:'Acciones'}]},
 stock:{title:'Existencias',columns:[
  {key:'nombre',label:'Artículo'},{key:'cantidad',label:'Cantidad física'},
  {key:'ubicacion',label:'Ubicación'},{key:'lote',label:'Lote'}]},
 lots:{title:'Lotes',columns:[
  {key:'nombre',label:'Artículo'},{key:'codigo',label:'Lote'},{key:'cantidad',label:'Existencias'},
  {key:'vencimiento',label:'Vencimiento'},{key:'estado',label:'Estado'},{key:'acciones',label:'Acciones'}]},
 movements:{title:'Kardex',create:'/inventory/operations/manual',columns:[
  {key:'nombre',label:'Artículo'},{key:'tipo',label:'Movimiento'},
  {key:'cantidad',label:'Cantidad'},{key:'fecha',label:'Fecha'},{key:'acciones',label:'Acciones'}]},
 counts:{title:'Conteos',create:'/inventory/operations/counts/new',columns:[
  {key:'almacen',label:'Almacén'},{key:'estado',label:'Estado'},
  {key:'lineas',label:'Líneas'},{key:'fecha',label:'Fecha'},{key:'acciones',label:'Acciones'}]},
 transfers:{title:'Transferencias',create:'/inventory/operations/transfers/new',columns:[
  {key:'numero',label:'Documento'},{key:'origen',label:'Origen'},{key:'destino',label:'Destino'},
  {key:'estado',label:'Estado'},{key:'acciones',label:'Acciones'}]}
};
function decimal(value:string|null|undefined){try{return value?formatDecimal(value):'0'}catch{return '—'}}
function objectValue(value:GcTableRow[string]):string{return value==null?'':String(value)}
@Component({
 selector:'gc-inventory-list-page',
 providers:[InventoryUrlState],
 imports:[RouterLink,GcPageHeader,GcButtonDirective,GcDataTable,GcTableCellDirective,
  GcPagination,GcErrorState,GcInventoryNav,GcInventorySubnav,GcInventoryPicker],
 template:`
 <div class="inv-page">
  <gc-page-header [title]="config.title"/>
  <gc-inventory-nav/>
  @if(view==='stock'||view==='lots'){
   <gc-inventory-subnav [links]="stockLinks" label="Existencias y lotes"/>
  } @else if(view==='movements'||view==='counts'||view==='transfers'){
   <gc-inventory-subnav [links]="operationLinks" label="Operaciones"/>
  }
  <section class="inv-card">
   @if(config.create&&canCreate()){
    <div class="inv-row inv-create-row">
     <a gcButton [routerLink]="config.create">{{view==='articles'?'Nuevo artículo':view==='movements'?'Registrar movimiento':view==='counts'?'Nuevo conteo':'Nueva transferencia'}}</a>
    </div>
   }
   <form class="inv-toolbar" (submit)="apply($event)">
    @if(view==='articles'||view==='movements'){
     <div class="inv-field"><label for="inv-search">Buscar artículo</label>
      <input id="inv-search" [value]="search()" (input)="search.set($any($event.target).value)"
       maxlength="100" placeholder="Nombre o código"/></div>
    }
    @if(view!=='articles'){
     <div class="inv-field"><label for="inv-branch">Sucursal</label>
      <select id="inv-branch" [value]="url.filters().sucursalId" (change)="setFilter('sucursalId',$any($event.target).value)">
       @for(b of branch.branches();track b.id){<option [value]="b.id">{{b.nombre}}</option>}
      </select>
     </div>
    }
    @if(view==='articles'){
     <div class="inv-field"><label for="inv-type">Tipo</label>
      <select id="inv-type" [value]="url.filters().tipo" (change)="setFilter('tipo',$any($event.target).value)">
       <option value="">Todos</option>
       @for(kind of kinds;track kind.value){<option [value]="kind.value">{{kind.label}}</option>}
      </select>
     </div>
    }
    @if(view==='articles'||view==='counts'||view==='transfers'){
     <div class="inv-field"><label for="inv-status">Estado</label>
      <select id="inv-status" [value]="url.filters().estado" (change)="setFilter('estado',$any($event.target).value)">
       <option value="">Todos</option>
       @for(option of states();track option.value){<option [value]="option.value">{{option.label}}</option>}
      </select>
     </div>
    }
    @if(view==='stock'||view==='lots'||view==='movements'||view==='counts'){
     <div class="inv-field"><label for="inv-warehouse">Almacén</label>
      <select id="inv-warehouse" [value]="url.filters().almacenId" (change)="setFilter('almacenId',$any($event.target).value)">
       <option value="">Todos</option>
       @for(item of warehouses();track item.id){<option [value]="item.id">{{item.nombre}}</option>}
      </select>
     </div>
    }
    @if(view==='lots'||view==='stock'||view==='movements'){
     <div class="inv-field"><label for="inv-article">Artículo</label>
      <select id="inv-article" [value]="url.filters().articuloId" (change)="setFilter('articuloId',$any($event.target).value)">
       <option value="">Todos</option>
       @for(item of articles();track item.id){<option [value]="item.id">{{item.nombre}}</option>}
      </select>
     </div>
    }
    @if(view==='articles'||view==='movements'){<button gcButton type="submit" variant="outline">Buscar</button>}
   </form>
   @if(!canRead()){<p role="alert" class="inv-alert">No tienes permiso para consultar inventario en esta sucursal.</p>}
   @else if(page.status()==='error'){<gc-error-state [message]="errorMessage()" (retry)="reload()"/>}
   @else{
    <gc-data-table [columns]="config.columns" [rows]="page.data()?.rows??[]" [loading]="page.busy()">
     <ng-template gcTableCell="nombre" let-row>
      <div class="inv-photo">
       @if(image(row['imagen']);as photoUrl){
        <button type="button" class="inv-image-trigger" [attr.aria-label]="'Ampliar imagen de '+row['nombre']"
         (click)="openPhoto(photoUrl,objectValue(row['nombre']))">
         <img [src]="photoUrl" alt="" loading="lazy" (error)="imageFailed($event)"/>
        </button>
       } @else {<span class="inv-placeholder" aria-hidden="true">IMG</span>}
       <span>{{row['nombre']}}</span>
      </div>
     </ng-template>
     <ng-template gcTableCell="acciones" let-row>
      @if(link(row['id']);as url){<a class="inv-link" [routerLink]="url">Ver detalle</a>}
      @else if(view==='lots'&&access.canGlobal('inventory.articles.manage')){
       <button type="button" gcButton variant="outline" [disabled]="action.busy()||lotReason().trim().length<3"
        (click)="toggleLot(row)">{{row['bloqueado']?'Desbloquear':'Bloquear'}}</button>
      }
     </ng-template>
    </gc-data-table>
    <gc-pagination [index]="url.filters().page-1" [size]="url.filters().limit"
      [total]="page.data()?.total??0" (pageChange)="onPage($event)"/>
   }

   @if(view==='lots'&&access.canGlobal('inventory.articles.manage')){
    <div class="inv-field">
     <label for="lot-block-reason">Motivo para bloquear o desbloquear un lote</label>
     <input id="lot-block-reason" [value]="lotReason()" maxlength="500"
      (input)="lotReason.set($any($event.target).value)"
      placeholder="Ej. Retiro preventivo por calidad"/>
    </div>
   }
   @if(view==='stock'){<p class="inv-muted">Existencias físicas, no reservas de pedidos.</p>}
  </section>
  @if(view==='lots'&&access.canGlobal('inventory.articles.manage')){
   <section class="inv-card inv-narrow">
    <h2>Registrar lote</h2>
    <div class="inv-grid">
     <gc-inventory-picker id="new-lot-article" kind="article" label="Artículo"
       [value]="newLotArticle()" (valueChange)="newLotArticle.set($event)"/>
     <div class="inv-field"><label for="new-lot-code">Código de lote</label>
      <input id="new-lot-code" maxlength="100" placeholder="Ej. LOTE-2026-001"
       [value]="newLotCode()" (input)="newLotCode.set($any($event.target).value)"/>
     </div>
     <div class="inv-field"><label for="new-lot-manufacture">Fecha de elaboración (opcional)</label>
      <input id="new-lot-manufacture" type="date" [value]="newLotManufacture()"
       (change)="newLotManufacture.set($any($event.target).value)"/>
     </div>
     <div class="inv-field"><label for="new-lot-expiry">Fecha de vencimiento (opcional)</label>
      <input id="new-lot-expiry" type="date" [value]="newLotExpiry()"
       (change)="newLotExpiry.set($any($event.target).value)"/>
     </div>
    </div>
    @if(lotError()){<p role="alert" class="inv-alert">{{lotError()}}</p>}
    <div class="inv-actions">
     <button gcButton type="button" [disabled]="action.busy()||!newLotArticle()||!newLotCode().trim()"
      (click)="createLot()">Crear lote</button>
    </div>
    <p class="inv-muted">Los lotes nuevos pueden aparecer sin existencias. Selecciona el artículo para consultarlos.</p>
   </section>
  }
 </div>`,
 styleUrl:'../inventory.scss'
})
export class GcInventoryListPage {
 protected readonly branch=inject(GcBranchContext);
 protected readonly url=inject(InventoryUrlState);
 private readonly route=inject(ActivatedRoute);
 private readonly api=inject(InventoryApi);
 protected readonly access=inject(OrganizationAccess);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly previewDialog=inject(MatDialog);
 private readonly notice=inject(GcNotificationService);
 protected readonly view=(this.route.snapshot.data['view']??'lots') as View;
 protected readonly config=VIEWS[this.view];
 protected readonly stockLinks=STOCK_LINKS;protected readonly operationLinks=OPERATION_LINKS;
 protected readonly kinds:readonly {value:InventoryKind;label:string}[]=[
  {value:'INGREDIENTE',label:'Ingrediente'},{value:'PREPARACION',label:'Preparación'},
  {value:'PRODUCTO_TERMINADO',label:'Producto terminado'},
  {value:'EMPAQUE',label:'Empaque'},{value:'SUMINISTRO',label:'Suministro'}];
 protected readonly search=signal('');
 protected readonly warehouses=signal<{id:string;nombre:string}[]>([]);
 protected readonly articles=signal<{id:string;nombre:string}[]>([]);
 protected readonly page=new GcPageState<{rows:GcTableRow[];total:number}>();
 protected readonly action=new GcConfirmedAction();
 protected readonly newLotArticle=signal('');
 protected readonly newLotCode=signal('');
 protected readonly newLotManufacture=signal('');
 protected readonly newLotExpiry=signal('');
 protected readonly lotError=signal<string|null>(null);
 protected readonly lotReason=signal('');
 protected readonly states=computed(()=>{
  if(this.view==='articles')return [{value:'true',label:'Activos'},{value:'false',label:'Inactivos'}];
  if(this.view==='counts')return ['BORRADOR','CONFIRMADO','CANCELADO'].map(v=>({value:v,label:v.replaceAll('_',' ')}));
  return ['BORRADOR','EN_TRANSITO','RECIBIDA','CANCELADA'].map(v=>({value:v,label:v.replaceAll('_',' ') }));
 });
 constructor(){
  effect(()=>{
   const f=this.url.filters();
   this.search.set(f.search);
   if(this.view==='articles'||f.sucursalId)void this.load(f);
  });
  effect(()=>{
   const branch=this.url.filters().sucursalId;
   if(branch)void this.loadOptions(branch);
  });
 }
 protected canCreate(){
  if(this.view==='articles')return this.access.canGlobal('inventory.articles.manage');
  if(this.view==='movements')return this.branch.has('inventory.adjust')||this.branch.has('inventory.consume.internal');
  if(this.view==='counts')return this.branch.has('inventory.adjust');
  if(this.view==='transfers')return this.branch.has('inventory.transfer');
  return false;
 }
 protected canRead(){return this.branch.has('inventory.read')||this.view==='articles'||this.branch.branches().length>0}
 protected errorMessage(){return gcErrorMessage(this.page.error())}
 private zone(id:string){return this.branch.branches().find(b=>b.id===id)?.zonaHoraria}
 protected reload(){void this.load(this.url.filters())}
 protected async setFilter(key:keyof InventoryFilters,value:string){
  await this.url.patch({[key]:value,page:1});
 }
 protected apply(event:Event){event.preventDefault();void this.url.patch({search:this.search().trim(),page:1})}
 protected onPage(change:GcPageChange){void this.url.patch({page:change.index+1,limit:change.size})}
 protected link(id:GcTableRow[string]):string|null{
  const value=objectValue(id);if(!value)return null;
  if(this.view==='articles')return '/inventory/articles/'+encodeURIComponent(value);
  if(this.view==='movements')return '/inventory/operations/movements/'+encodeURIComponent(value);
  if(this.view==='counts')return '/inventory/operations/counts/'+encodeURIComponent(value);
  if(this.view==='transfers')return '/inventory/operations/transfers/'+encodeURIComponent(value);
  return null;
 }
 protected readonly objectValue=objectValue;
 protected openPhoto(url:string,alt:string){
  this.previewDialog.open(GcImagePreviewDialog,{
   data:{url,alt},width:'min(94vw,720px)',maxWidth:'94vw',
   ariaLabel:'Vista de fotografía de artículo',autoFocus:'dialog',restoreFocus:true,
  });
 }
 protected image(v:GcTableRow[string]):string|null{return typeof v==='string'&&v?v:null}
 protected imageFailed(event:Event){(event.target as HTMLImageElement).style.visibility='hidden'}
 private async loadOptions(sucursalId:string){
  try{
   const r=await firstValueFrom(this.api.warehouseOptions({sucursalId,limit:50}));
   this.warehouses.set(r.data.map(w=>({id:w.id,nombre:w.label||w.nombre||w.codigo})));
  }catch{this.warehouses.set([])}
  if(this.view==='lots'||this.view==='stock'||this.view==='movements'){
   try{const r=await firstValueFrom(this.api.articleOptions({limit:50}));this.articles.set(r.data)}
   catch{this.articles.set([])}
  }
 }
 private async load(f:InventoryFilters){
  if(this.view!=='articles'&&!f.sucursalId)return;
  await this.page.load(async()=>{
   let rows:GcTableRow[],total:number;
   const q={page:f.page,limit:f.limit};
   if(this.view==='articles'){
    const r=await firstValueFrom(this.api.articles({...q,search:f.search,
     tipo:f.tipo as InventoryKind||undefined,activo:f.estado===''?undefined:f.estado==='true'}));
    total=r.meta.total;rows=r.data.map(a=>({id:a.id,nombre:a.nombre,codigo:a.codigo,
     tipo:a.tipo,unidad:a.unidadBase?.codigo??'—',estado:a.activo?'Activo':'Inactivo',
     imagen:a.imagenPrincipalUrl,acciones:a.id}));
   }else if(this.view==='stock'){
    const r=await firstValueFrom(this.api.stock({...q,sucursalId:f.sucursalId,almacenId:f.almacenId,
     articuloId:f.articuloId}));
    total=r.meta.total;rows=r.data.map(s=>({id:s.id,nombre:s.articulo.nombre,
     imagen:s.articulo.imagenPrincipalUrl, cantidad:decimal(s.cantidad),
     ubicacion:s.ubicacion.nombre,lote:s.lote?.codigoLote??'—'}));
   }else if(this.view==='lots'){
    const r=await firstValueFrom(this.api.lots({...q,sucursalId:f.sucursalId,articuloId:f.articuloId,incluirSinExistencias:!!f.articuloId}));
    total=r.meta.total;rows=r.data.map(l=>({id:l.id,nombre:l.articulo.nombre,
     codigo:l.codigoLote,cantidad:decimal(l.cantidad),vencimiento:inventoryCalendar(l.fechaVencimiento),
     estado:l.bloqueado?'Bloqueado':'Disponible',bloqueado:l.bloqueado,acciones:l.id}));
   }else if(this.view==='movements'){
    const r=await firstValueFrom(this.api.movements({...q,sucursalId:f.sucursalId,
     articuloId:f.articuloId,almacenId:f.almacenId}));
    total=r.meta.total;rows=r.data.map(m=>({id:m.id,nombre:m.articulo.nombre,
     imagen:m.articulo.imagenPrincipalUrl,tipo:inventoryMovementLabel(m.tipo),cantidad:decimal(m.cantidad),
     fecha:inventoryInstant(m.creadoEn,this.zone(f.sucursalId)),acciones:m.id}));
   }else if(this.view==='counts'){
    const r=await firstValueFrom(this.api.counts({...q,sucursalId:f.sucursalId,
     almacenId:f.almacenId,estado:f.estado as CountStatus||undefined}));
    total=r.meta.total;rows=r.data.map(d=>({id:d.id,almacen:d.almacen.nombre,
     estado:d.estado,lineas:d.numeroLineas,fecha:inventoryInstant(d.creadoEn,this.zone(f.sucursalId)),acciones:d.id}));
   }else{
    const r=await firstValueFrom(this.api.transfers({...q,sucursalId:f.sucursalId,
     estado:f.estado as TransferStatus||undefined}));
    total=r.meta.total;rows=r.data.map(d=>({id:d.id,numero:d.numero,origen:d.origen.nombre,
     destino:d.destino.nombre,estado:d.estado,acciones:d.id}));
   }
   return {rows,total};
  },r=>r.rows.length===0);
 }
 hasUnsavedChanges(){return !!this.newLotCode().trim()||!!this.newLotExpiry()||!!this.newLotManufacture()}
 protected async createLot(){
  this.lotError.set(null);
  const article=this.newLotArticle(),code=this.newLotCode().trim();
  if(!article||!code)return;
  if(this.newLotManufacture()&&this.newLotExpiry()&&this.newLotManufacture()>this.newLotExpiry()){
   this.lotError.set('La elaboración no puede ser posterior al vencimiento.');return;
  }
  const r=await this.action.runConfirmed(this.dialog,{
   title:'Crear lote',message:'¿Registrar el lote para el artículo seleccionado?',
   confirmText:'Crear lote'},
   ()=>firstValueFrom(this.api.createLot({articuloId:article,codigoLote:code,
    ...(this.newLotManufacture()?{fechaElaboracion:this.newLotManufacture()}:{}),
    ...(this.newLotExpiry()?{fechaVencimiento:this.newLotExpiry()}:{})})));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.lotError.set(gcErrorMessage(r.error));return}
  this.newLotCode.set('');this.newLotManufacture.set('');this.newLotExpiry.set('');
  this.notice.show('Lote registrado.','success');
  await this.url.patch({articuloId:article,page:1});
  await this.load(this.url.filters());
 }
 protected async toggleLot(row:GcTableRow){
  if(this.lotReason().trim().length<3)return;
  const id=objectValue(row['id']);const current=row['bloqueado']===true;
  const next=!current;
  const r=await this.action.runConfirmed(this.dialog,{
   title:next?'Bloquear lote':'Desbloquear lote',
   message:next?'El lote quedará fuera de la cantidad utilizable. ¿Continuar?':
    '¿Desbloquear este lote para su uso?',
   confirmText:next?'Bloquear':'Desbloquear',danger:next,
  },()=>firstValueFrom(this.api.blockLot(id,next,this.lotReason().trim())));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.notice.show(gcErrorMessage(r.error),'error');return}
  this.lotReason.set('');this.notice.show('Estado del lote actualizado.','success');await this.load(this.url.filters());
 }
}
