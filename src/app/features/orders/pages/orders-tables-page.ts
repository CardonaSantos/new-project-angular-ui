import {Component,computed,effect,ElementRef,inject,signal,viewChild} from '@angular/core';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {Clipboard} from '@angular/cdk/clipboard';
import {firstValueFrom} from 'rxjs';
// Namespace import (not a default import): avoids depending on esModuleInterop,
// which this project's tsconfig does not set, for this CJS-only package.
import * as QRCode from 'qrcode';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {OrganizationAccess} from '../../organization/data-access/organization-access';
import {BranchesApi} from '../../organization/data-access/organization-api';
import {calendarDateAtBranch,clockTimeAtBranch,formatInstant,zonedInstantFrom} from '../../../shared/formatting';
import {SelfServiceAdminApi} from '../../self-service/data-access/self-service-admin.api';
import type {TableQrIssued,TableQrSummary} from '../../self-service/data-access/self-service-admin.models';
import {GcOrdersNav} from '../orders-nav';
import {OrdersApi} from '../data-access/orders.api';
import {OrdersAccess} from '../data-access/orders-access';
import {OrdersTableReservations,type OrdersTableConflict} from '../data-access/orders-table-reservations';
import {OrdersTodayReservations,type OrdersReservationSummary} from '../data-access/orders-today-reservations';
import type {Room,TableRecord} from '../data-access/orders.models';
import {money,openTableOrders} from '../data-access/orders.helpers';
@Component({
 selector:'gc-orders-tables-page',imports:[RouterLink,GcOrdersNav,GcSearchSelect],
 template:`
 <main class="ord-page ord-tables-page"><gc-orders-nav/>
 <div class="ord-heading">
  <div><h1>{{managing?'Administrar mesas y salas':'Mesas y salas'}}</h1>
   <p class="ord-note">{{managing?'Configura la distribución del local.':'Consulta la ocupación y toma pedidos desde el tablero.'}}</p></div>
  <div class="ord-actions">
   @if(managing){<a routerLink="/orders/tables">Volver al tablero</a>}
   @else if(access.canTablesManage()){<a routerLink="/orders/tables/manage">Administrar mesas</a>}
   <button type="button" (click)="load()" [disabled]="busy()">Actualizar</button>
  </div>
 </div>
 @if(error()){<p class="ord-alert" role="alert">{{error()}}</p>}
 @if(!managing&&todayReservations().length){
 <section class="ord-card ord-today-reservations">
  <div class="ord-heading"><h2>Reservas de hoy</h2>
   <a [routerLink]="['/reservations']" [queryParams]="{sucursalId:branch.branchId()}">Ver todas</a></div>
  <div class="ord-stat-grid">
   <div><small>Por llegar</small><strong>{{pendingReservations().length}}</strong></div>
   <div><small>Llegaron</small><strong>{{arrivedReservations().length}}</strong></div>
   <div><small>No asistió</small><strong>{{noShowReservations().length}}</strong></div>
  </div>
  @if(overdueReservations().length){
   <p class="ord-alert" role="alert">
    {{overdueReservations().length===1?'Hay 1 reservación confirmada vencida sin registrar llegada:':
      'Hay '+overdueReservations().length+' reservaciones confirmadas vencidas sin registrar llegada:'}}
    @for(r of overdueReservations();track r.id){
     <a [routerLink]="['/reservations',r.id]">{{r.nombreContacto}} ({{clockTimeAtBranch(r.inicio,zone())}})</a>
    }
   </p>
  }
  @if(nextArrivals().length){
   <ul class="ord-today-reservations-list">
    @for(r of nextArrivals();track r.id){
     <li>{{clockTimeAtBranch(r.inicio,zone())}} — {{r.nombreContacto}} ({{r.personas}})</li>
    }
   </ul>
  }
 </section>
 }
 @if(!managing){
 <section class="ord-card">
  <div class="ord-stat-grid ord-table-stats">
   <div><small>Mesas</small><strong>{{tables().length}}</strong></div>
   <div><small>Disponibles</small><strong>{{availableCount()}}</strong></div>
   <div><small>Ocupadas</small><strong>{{occupiedCount()}}</strong></div>
   <div><small>Inactivas</small><strong>{{inactiveCount()}}</strong></div>
  </div>
  <div class="ord-category-list" role="group" aria-label="Seleccionar sala">
   <button type="button" [class.active]="selectedRoom()===''" (click)="selectedRoom.set('')">Todas las salas</button>
   @for(room of rooms();track room.id){
    <button type="button" [class.active]="selectedRoom()===room.id" (click)="selectedRoom.set(room.id)">
     {{room.nombre}}</button>
   }
  </div>
  @if(busy()){<p role="status">Consultando mesas…</p>}
  <div class="ord-table-grid">
   @for(table of visibleTables();track table.id){
    <article class="ord-table-card">
     <div class="ord-heading"><strong>Mesa {{table.numero}}</strong>
      <span class="ord-ticket-badge" [class.ord-ticket-badge--ready]="!table.ocupacion"
       [class.ord-ticket-badge--working]="!!table.ocupacion">
       {{!table.activa?'Inactiva':table.ocupacion?'Ocupada':'Disponible'}}</span></div>
     <small>{{table.sala.nombre}} · {{table.capacidad}} personas
      @if(table.ocupacion?.personas){ · {{table.ocupacion!.personas}} sentadas}</small>
     @if(reservationFor(table.id);as conflict){
      <p class="ord-note ord-table-reserved">
       Reservada{{conflict.reservaConflictoInicio?' '+clockTimeAtBranch(conflict.reservaConflictoInicio,zone()):''}}
       {{conflict.reservaConflictoContacto?'— '+conflict.reservaConflictoContacto:''}}
      </p>
     }
     @if(table.ocupacion){
      @for(o of openOrders(table);track o.id){
       <div class="ord-actions">
        <a [routerLink]="['/orders/list',o.id]">{{o.numero}} · {{money(o.total)}}
         {{o.cliente?' · '+o.cliente.nombre:''}}</a>
       </div>
      }
      @if(openOrders(table).length){
       <p class="ord-note ord-table-blocked">
        Esta mesa tiene {{openOrders(table).length===1?'un pedido abierto':'pedidos abiertos'}}.
        Añade productos desde el POS o finaliza la preparación y cierra
        {{openOrders(table).length===1?'el pedido':'los pedidos'}} antes de liberarla.
       </p>
       @if(access.canKitchenRead()){
        <a routerLink="/orders/kitchen" class="ord-table-kitchen-link">Ver comandas de cocina</a>
       }
      }
     }
     <div class="ord-actions">
      @if(table.activa&&access.canCreate()){
       <button type="button" class="ord-primary" (click)="openTable(table)">
        {{openOrders(table).length?'Añadir productos':table.ocupacion?'Atender mesa':'Tomar pedido'}}
       </button>}
      @if(table.ocupacion&&access.canTablesManage()){
       <button type="button" (click)="release(table)"
        [disabled]="actionBusy()||openOrders(table).length>0"
        [attr.title]="openOrders(table).length?'Cierra primero los pedidos abiertos de esta mesa':null">
        Liberar mesa
       </button>}
      @if(access.canTablesManage()){
       <a routerLink="/orders/tables/manage">Configurar</a>}
     </div>
    </article>
   } @empty {<p class="ord-empty">No hay mesas para mostrar.</p>}
  </div>
 </section>
 }
 @if(managing&&access.canTablesManage()){
 <section class="ord-card ord-management ord-tables-admin">
  <div class="ord-heading">
   <h2>Configuración del local</h2>
   <div class="ord-view-switch" role="group" aria-label="Configuración de mesas">
    <button type="button" [class.active]="manageTab()==='rooms'"
     [attr.aria-pressed]="manageTab()==='rooms'" (click)="manageTab.set('rooms')">Salas</button>
    <button type="button" [class.active]="manageTab()==='tables'"
     [attr.aria-pressed]="manageTab()==='tables'" (click)="manageTab.set('tables')">Mesas</button>
    <button type="button" [class.active]="manageTab()==='qr'"
     [attr.aria-pressed]="manageTab()==='qr'" (click)="openQrTab()">Autoservicio (QR)</button>
   </div>
  </div>
  @if(manageTab()==='rooms'){
  <h3>Salas</h3>
  <div class="ord-small-list">
   @for(room of rooms();track room.id){
    <div class="ord-setting-row" [class.ord-setting-row--active]="roomId()===room.id">
     <strong>{{room.nombre}}</strong><span>{{room.activa?'Activa':'Inactiva'}}</span>
     <div class="ord-actions">
      <button type="button" (click)="editRoom(room)" [attr.aria-label]="'Renombrar sala '+room.nombre">Renombrar</button>
      <button type="button" (click)="toggleRoom(room)" [disabled]="actionBusy()"
       [attr.aria-label]="(room.activa?'Desactivar':'Activar')+' sala '+room.nombre">{{room.activa?'Desactivar':'Activar'}}</button>
     </div>
    </div>
   }
  </div>
  <fieldset class="ord-section"><legend #roomEditorHeading tabindex="-1">{{roomId()?'Editar sala':'Nueva sala'}}</legend>
   <label>Nombre de la sala
    <input [value]="roomName()" (input)="roomName.set($any($event.target).value)"
     maxlength="100" placeholder="Ej. Terraza"/>
   </label>
   <div class="ord-actions"><button type="button" class="ord-primary"
    [disabled]="actionBusy()||roomName().trim().length<2" (click)="saveRoom()">
    {{roomId()?'Guardar cambios':'Crear sala'}}</button>
    @if(roomId()){<button type="button" (click)="roomId.set('');roomName.set('')">Cancelar</button>}
   </div>
  </fieldset>
  }
  @if(manageTab()==='tables'){
  <div class="ord-small-list">
   @for(t of tables();track t.id){
    <div class="ord-setting-row" [class.ord-setting-row--active]="tableId()===t.id">
     <div><strong>Mesa {{t.numero}}</strong>
      <small>{{t.sala.nombre}} · {{t.capacidad}} personas · {{t.activa?'Activa':'Inactiva'}}</small>
     </div>
     <button type="button" (click)="editTable(t)" [disabled]="actionBusy()"
      [attr.aria-label]="'Editar mesa '+t.numero">Editar</button>
    </div>
   } @empty {<p>No hay mesas configuradas.</p>}
  </div>
  <fieldset class="ord-section"><legend #tableEditorHeading tabindex="-1">{{tableId()?'Editar mesa':'Nueva mesa'}}</legend>
   <div class="ord-form-grid">
    <gc-search-select id="room-for-table" label="Sala" [items]="roomOptions()"
     [value]="tableRoom()" placeholder="Seleccionar sala"
     (valueChange)="tableRoom.set($event)" [disabled]="!!tableId()"/>
    <label>Número o nombre de mesa
     <input [value]="tableNumber()" (input)="tableNumber.set($any($event.target).value)"
      maxlength="20" placeholder="Ej. 04"/>
    </label>
    <label>Capacidad
     <input type="number" min="1" max="40" [value]="capacity()"
      (input)="capacity.set($any($event.target).valueAsNumber||1)"/>
    </label>
   </div>
   <div class="ord-actions">
    <button type="button" class="ord-primary"
     [disabled]="actionBusy()||!tableRoom()||!tableNumber().trim()||capacity()<1||capacity()>40"
     (click)="saveTable()">{{tableId()?'Guardar mesa':'Crear mesa'}}</button>
    @if(tableId()){<button type="button" (click)="resetTableForm()">Cancelar</button>
     <button type="button" (click)="toggleTable()" [disabled]="actionBusy()"> {{editingTable()?.activa?'Desactivar':'Activar'}} mesa </button>}
   </div>
  </fieldset>
  }
  @if(manageTab()==='qr'){
  <h3>Autoservicio por QR</h3>
  @if(qrEnabled()===false){
   <p class="ord-alert" role="alert">El autoservicio por QR está <strong>desactivado</strong> para esta
    sucursal: ningún código funcionará hasta activarlo.
    <a [routerLink]="['/organization/branches',branch.branchId()]">Activarlo en Configuración</a></p>
  } @else if(qrEnabled()===true){
   <p class="ord-note">Autoservicio por QR está <strong>activado</strong> para esta sucursal.</p>
  }
  <p class="ord-note">Genera un código por mesa: el cliente lo escanea (o abre el enlace) y entra directo
   al menú de esa mesa, sin mesero. Un código nuevo invalida el anterior de la misma mesa.</p>
  <div class="ord-small-list">
   @for(t of tables();track t.id){
    <div class="ord-setting-row" [class.ord-setting-row--active]="qrTable()?.id===t.id">
     <div><strong>Mesa {{t.numero}}</strong><small>{{t.sala.nombre}}</small></div>
     <button type="button" (click)="selectQrTable(t)" [disabled]="qrBusy()"
      [attr.aria-label]="'Gestionar código QR de la mesa '+t.numero">Gestionar QR</button>
    </div>
   } @empty {<p>No hay mesas configuradas.</p>}
  </div>
  @if(qrTable();as t){
  <fieldset class="ord-section">
   <legend #qrPanelHeading tabindex="-1">Mesa {{t.numero}} · {{t.sala.nombre}}</legend>
   @if(qrError()){<p class="ord-alert" role="alert">{{qrError()}}</p>}
   @if(qrLoading()){<p role="status">Consultando código QR…</p>}
   @else {
    @if(activeQr();as active){
     <div class="ord-setting-row">
      <div><strong>Código activo</strong>
       <small>{{active.expiraEn?('Expira '+formatInstant(active.expiraEn,zone())):'No expira'}}
        · creado {{formatInstant(active.creadoEn,zone())}}</small></div>
      <button type="button" (click)="revokeQr(active.id)" [disabled]="qrBusy()">Revocar</button>
     </div>
    } @else {
     <p class="ord-note">Esta mesa no tiene un código QR activo en este momento.</p>
    }
    <div class="ord-actions">
     <button type="button" class="ord-primary" [disabled]="qrBusy()" (click)="issueQr()">
      {{qrBusy()?'Generando…':(activeQr()?'Generar nuevo código':'Generar código QR')}}
     </button>
    </div>
   }
   @if(qrIssued();as issued){
    <div class="ord-qr-result ord-qr-print">
     <p class="ord-alert ord-qr-warning" role="alert">
      Este código se muestra una sola vez: guárdalo, cópialo o imprímelo ahora.</p>
     <div class="ord-qr-result-body">
      @if(qrImage();as img){
       <img [src]="img" class="ord-qr-image" [alt]="'Código QR de la mesa '+t.numero"/>
      }
      <div class="ord-qr-link-col">
       <strong>Mesa {{t.numero}} · {{branch.active()?.nombre}}</strong>
       <code class="ord-qr-link">{{clientUrl(issued.url)}}</code>
       <div class="ord-actions ord-qr-no-print">
        <button type="button" (click)="copyLink(issued.url)">Copiar enlace</button>
        <a [href]="clientUrl(issued.url)" target="_blank" rel="noopener">Abrir vista de cliente</a>
        @if(qrImage();as img){
         <button type="button" (click)="printQr()">Imprimir</button>
         <a [href]="img" [download]="'mesa-'+t.numero+'-qr.png'">Descargar PNG</a>
        }
       </div>
      </div>
     </div>
    </div>
   }
   @if(qrHistory().length>1){
    <details class="ord-qr-history">
     <summary>Historial de códigos de esta mesa ({{qrHistory().length}})</summary>
     <div class="ord-small-list">
      @for(h of qrHistory();track h.id){
       <div class="ord-setting-row">
        <small>{{h.activo?'Activo':'Revocado o reemplazado'}} · creado {{formatInstant(h.creadoEn,zone())}}
         {{h.expiraEn?(' · expira '+formatInstant(h.expiraEn,zone())):''}}</small>
       </div>
      }
     </div>
    </details>
   }
  </fieldset>
  }
  }
 </section>
 }
 @if(managing&&!access.canTablesManage()){
  <p role="alert" class="ord-alert">No tienes permisos para administrar salas o mesas.</p>
 }
 </main>`
})
export class GcOrdersTablesPage{
 private readonly api=inject(OrdersApi);private readonly router=inject(Router);
 private readonly route=inject(ActivatedRoute);
 protected readonly managing=Boolean(this.route.snapshot.data['manage']);
 private readonly confirm=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 private readonly reservations=inject(OrdersTableReservations);
 private readonly todayApi=inject(OrdersTodayReservations);
 private readonly organization=inject(OrganizationAccess);
 private readonly branchesApi=inject(BranchesApi);
 private readonly selfServiceApi=inject(SelfServiceAdminApi);
 private readonly clipboard=inject(Clipboard);
 protected readonly todayReservations=signal<OrdersReservationSummary[]>([]);
 protected readonly pendingReservations=computed(()=>
  this.todayReservations().filter(r=>r.estado==='PENDIENTE'||r.estado==='CONFIRMADA'));
 protected readonly arrivedReservations=computed(()=>
  this.todayReservations().filter(r=>r.estado==='COMPLETADA'));
 protected readonly noShowReservations=computed(()=>
  this.todayReservations().filter(r=>r.estado==='NO_ASISTIO'));
 protected readonly overdueReservations=computed(()=>{
  const now=Date.now();
  return this.todayReservations().filter(r=>r.estado==='CONFIRMADA'&&new Date(r.fin).getTime()<now)
   .sort((a,b)=>new Date(a.fin).getTime()-new Date(b.fin).getTime());
 });
 protected readonly nextArrivals=computed(()=>{
  const now=Date.now();
  return this.pendingReservations().filter(r=>new Date(r.inicio).getTime()>=now-15*60000)
   .sort((a,b)=>new Date(a.inicio).getTime()-new Date(b.inicio).getTime()).slice(0,3);
 });
 protected readonly branch=inject(GcBranchContext);protected readonly access=inject(OrdersAccess);
 protected readonly money=money;protected readonly openOrders=openTableOrders;
 protected readonly clockTimeAtBranch=clockTimeAtBranch;protected readonly formatInstant=formatInstant;
 protected readonly rooms=signal<Room[]>([]);protected readonly tables=signal<TableRecord[]>([]);
 private readonly reservationConflicts=signal<Map<string,OrdersTableConflict>>(new Map());
 protected readonly selectedRoom=signal('');protected readonly busy=signal(false);
 protected readonly manageTab=signal<'rooms'|'tables'|'qr'>('rooms');
 protected readonly actionBusy=signal(false);protected readonly error=signal<string|null>(null);
 protected readonly roomId=signal('');protected readonly roomName=signal('');
 protected readonly tableId=signal('');protected readonly tableRoom=signal('');
 protected readonly tableNumber=signal('');protected readonly capacity=signal(2);
 // Autoservicio por QR (ver self-service/data-access/self-service-admin.*): qrEnabled
 // is best-effort (null = desconocido/sin permiso para leer la config) and never
 // blocks the QR tools themselves, same spirit as loadReservationOverlay() above.
 protected readonly qrEnabled=signal<boolean|null>(null);
 protected readonly qrTable=signal<TableRecord|null>(null);
 protected readonly qrHistory=signal<TableQrSummary[]>([]);
 protected readonly qrLoading=signal(false);protected readonly qrBusy=signal(false);
 protected readonly qrError=signal<string|null>(null);
 protected readonly qrIssued=signal<TableQrIssued|null>(null);
 protected readonly qrImage=signal<string|null>(null);
 protected readonly activeQr=computed(()=>this.qrHistory().find(q=>q.activo)??null);
 private readonly qrPanelHeading=viewChild<ElementRef<HTMLElement>>('qrPanelHeading');
 protected readonly visibleTables=computed(()=>this.tables().filter(x=>!this.selectedRoom()||x.sala.id===this.selectedRoom()));
 protected readonly availableCount=computed(()=>this.tables().filter(t=>t.activa&&!t.ocupacion).length);
 protected readonly occupiedCount=computed(()=>this.tables().filter(t=>t.activa&&t.ocupacion).length);
 protected readonly inactiveCount=computed(()=>this.tables().filter(t=>!t.activa).length);
 protected readonly roomOptions=computed(()=>this.rooms().filter(x=>x.activa).map(x=>({id:x.id,label:x.nombre})));
 protected readonly editingTable=computed(()=>this.tables().find(x=>x.id===this.tableId()));
 private readonly roomEditorHeading=viewChild<ElementRef<HTMLElement>>('roomEditorHeading');
 private readonly tableEditorHeading=viewChild<ElementRef<HTMLElement>>('tableEditorHeading');
 private focusHeading(get:()=>ElementRef<HTMLElement>|undefined){
  setTimeout(()=>{
   const el=get()?.nativeElement;
   if(!el)return;
   el.focus({preventScroll:true});
   el.scrollIntoView({behavior:'smooth',block:'start'});
  });
 }
 private generation=0;
 constructor(){effect(()=>{
  const id=this.branch.branchId();
  if(id){this.selectedRoom.set('');void this.load()}
 })}
 protected zone(){return this.branch.active()?.zonaHoraria??'America/Guatemala'}
 protected reservationFor(mesaId:string){
  const c=this.reservationConflicts().get(mesaId);
  return c&&c.motivo==='RESERVADA'?c:undefined;
 }
 private canSeeReservations(){return this.branch.has('reservations.read')||this.organization.canGlobal('reservations.read')}
 protected async load(){
  const id=this.branch.branchId();if(!id||!this.access.canTablesRead())return;
  const gen=++this.generation;this.busy.set(true);this.error.set(null);
  try{
   const [rooms,tables]=await Promise.all([firstValueFrom(this.api.rooms(id)),firstValueFrom(this.api.tables(id))]);
   if(gen!==this.generation)return;
   this.rooms.set(rooms);this.tables.set(tables);
  }catch(e){if(gen===this.generation)this.error.set(gcErrorMessage(e))}
  finally{if(gen===this.generation)this.busy.set(false)}
  void this.loadReservationOverlay(id,gen);
 }
 /** Best-effort overlay: never blocks or errors the tables board if it fails. */
 private async loadReservationOverlay(sucursalId:string,gen:number){
  if(!this.canSeeReservations()){this.reservationConflicts.set(new Map());this.todayReservations.set([]);return}
  const zone=this.zone();
  try{
   const now=new Date();
   const endOfDay=new Date(now);endOfDay.setHours(23,59,59,999);
   const rows=await firstValueFrom(this.reservations.upcoming(
    {sucursalId,inicio:now.toISOString(),fin:endOfDay.toISOString()}));
   if(gen!==this.generation)return;
   this.reservationConflicts.set(new Map(rows.map(r=>[r.id,r])));
  }catch{/* reservation badges are a convenience overlay, not core table data */}
  try{
   const today=calendarDateAtBranch(new Date().toISOString(),zone);
   const page=await firstValueFrom(this.todayApi.list({sucursalId,
    desde:zonedInstantFrom(today,'00:00',zone),hasta:zonedInstantFrom(today,'23:59',zone)}));
   if(gen!==this.generation)return;
   this.todayReservations.set(page.data);
  }catch{/* same: convenience widget, never blocks the tables board */}
 }
 protected openTable(table:TableRecord){
  void this.router.navigate(['/orders/pos'],{queryParams:{mesaId:table.id}});
 }
 protected async release(table:TableRecord){
  const id=table.ocupacion?.id;if(!id||this.actionBusy())return;
  // Guard in the action as well as the template; NestJS remains the authority.
  const open=this.openOrders(table);
  if(open.length){
   this.notices.show('La mesa '+table.numero+' tiene pedidos abiertos. Finaliza la preparación y cierra el pedido antes de liberarla.', 'warning', 6500);
   return;
  }
  if(!await this.confirm.confirm({title:'Liberar mesa '+table.numero,
   message:'No hay pedidos abiertos en esta mesa. ¿Cerrar su ocupación?',
   confirmText:'Liberar mesa'}))return;
  await this.mutate(async()=>{await firstValueFrom(this.api.closeOccupancy(id))},'Mesa '+table.numero+' liberada.');
 }
 protected editRoom(room:Room){
  this.manageTab.set('rooms');this.roomId.set(room.id);this.roomName.set(room.nombre);
  this.focusHeading(()=>this.roomEditorHeading());
 }
 protected async toggleRoom(room:Room){
  if(room.activa&&!await this.confirm.confirm({title:'Desactivar sala',message:'No podrá desactivarse una sala con mesas ocupadas.',danger:true,confirmText:'Desactivar'}))return;
  await this.mutate(async()=>{await firstValueFrom(this.api.updateRoom(room.id,{activa:!room.activa}))});
 }
 protected async saveRoom(){
  const name=this.roomName().trim();if(name.length<2)return;
  await this.mutate(async()=>{
   if(this.roomId())await firstValueFrom(this.api.updateRoom(this.roomId(),{nombre:name}));
   else await firstValueFrom(this.api.createRoom({sucursalId:this.branch.branchId()!,nombre:name}));
   this.roomId.set('');this.roomName.set('');
  });
 }
 protected editTable(table:TableRecord){
  this.manageTab.set('tables');this.tableId.set(table.id);this.tableRoom.set(table.sala.id);
  this.tableNumber.set(table.numero);this.capacity.set(table.capacidad);
  this.focusHeading(()=>this.tableEditorHeading());
 }
 protected resetTableForm(){this.tableId.set('');this.tableRoom.set('');this.tableNumber.set('');this.capacity.set(2)}
 protected async saveTable(){
  const number=this.tableNumber().trim();if(!this.tableRoom()||!number)return;
  await this.mutate(async()=>{
   if(this.tableId())await firstValueFrom(this.api.updateTable(this.tableId(),{
    numero:number,capacidad:this.capacity()
   }));
   else await firstValueFrom(this.api.createTable({salaId:this.tableRoom(),numero:number,capacidad:this.capacity()}));
   this.resetTableForm();
  });
 }
 protected async toggleTable(){
  const table=this.editingTable();if(!table)return;
  if(table.activa&&!await this.confirm.confirm({title:'Desactivar mesa',message:'No podrá desactivarse una mesa ocupada.',confirmText:'Desactivar',danger:true}))return;
  await this.mutate(async()=>{await firstValueFrom(this.api.updateTable(table.id,{activa:!table.activa}))});
 }
 private async mutate(fn:()=>Promise<void>,successMessage?:string){
  if(this.actionBusy())return;this.actionBusy.set(true);this.error.set(null);
  try{
   await fn();await this.load();
   if(successMessage)this.notices.show(successMessage,'success');
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
 protected openQrTab(){
  this.manageTab.set('qr');
  if(this.qrEnabled()===null)void this.loadQrConfig();
 }
 private async loadQrConfig(){
  const id=this.branch.branchId();if(!id)return;
  try{this.qrEnabled.set((await firstValueFrom(this.branchesApi.config(id))).permiteOrdenesQR)}
  catch{/* best-effort: a mesa manager without branches.read still gets the QR tools, just no banner */}
 }
 protected selectQrTable(table:TableRecord){
  this.qrTable.set(table);this.qrIssued.set(null);this.qrImage.set(null);this.qrError.set(null);
  this.focusHeading(()=>this.qrPanelHeading());
  void this.loadQrHistory(table.id);
 }
 private async loadQrHistory(mesaId:string){
  this.qrLoading.set(true);this.qrError.set(null);
  try{this.qrHistory.set(await firstValueFrom(this.selfServiceApi.list(mesaId)))}
  catch(e){this.qrError.set(gcErrorMessage(e))}
  finally{this.qrLoading.set(false)}
 }
 protected async issueQr(){
  const table=this.qrTable();if(!table||this.qrBusy())return;
  if(this.activeQr()&&!await this.confirm.confirm({title:'Generar nuevo código QR',
   message:'Esto invalida de inmediato el código QR actual de la mesa '+table.numero+
    '. Cualquier cliente que lo tenga abierto perderá el acceso al instante.',
   confirmText:'Generar nuevo código',danger:true}))return;
  this.qrBusy.set(true);this.qrError.set(null);
  try{
   const issued=await firstValueFrom(this.selfServiceApi.issue(table.id));
   this.qrIssued.set(issued);
   await this.renderQrImage(issued.url);
   await this.loadQrHistory(table.id);
  }catch(e){this.qrError.set(gcErrorMessage(e))}
  finally{this.qrBusy.set(false)}
 }
 protected async revokeQr(id:string){
  const table=this.qrTable();if(!table||this.qrBusy())return;
  if(!await this.confirm.confirm({title:'Revocar código QR',
   message:'Los clientes que tengan este código dejarán de poder acceder al menú de la mesa '+table.numero+'.',
   confirmText:'Revocar',danger:true}))return;
  this.qrBusy.set(true);this.qrError.set(null);
  try{
   await firstValueFrom(this.selfServiceApi.revoke(id));
   if(this.qrIssued()?.id===id){this.qrIssued.set(null);this.qrImage.set(null)}
   await this.loadQrHistory(table.id);
   this.notices.show('Código QR revocado.','success');
  }catch(e){this.qrError.set(gcErrorMessage(e))}
  finally{this.qrBusy.set(false)}
 }
 protected clientUrl(path:string){return window.location.origin+path}
 private async renderQrImage(path:string){
  try{this.qrImage.set(await QRCode.toDataURL(this.clientUrl(path),{width:360,margin:1}))}
  catch{this.qrImage.set(null)}
 }
 protected copyLink(path:string){
  this.clipboard.copy(this.clientUrl(path));
  this.notices.show('Enlace copiado.','success');
 }
 protected printQr(){window.print()}
}
