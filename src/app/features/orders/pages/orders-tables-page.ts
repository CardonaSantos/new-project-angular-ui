import {Component,computed,effect,inject,signal} from '@angular/core';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {GcOrdersNav} from '../orders-nav';
import {OrdersApi} from '../data-access/orders.api';
import {OrdersAccess} from '../data-access/orders-access';
import type {Room,TableRecord} from '../data-access/orders.models';
import {money} from '../data-access/orders.helpers';
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
     <small>{{table.sala.nombre}} · {{table.capacidad}} personas</small>
     @if(table.ocupacion){
      @for(o of openOrders(table);track o.id){
       <div class="ord-actions">
        <a [routerLink]="['/orders/list',o.id]">{{o.numero}} · {{money(o.total)}}</a>
       </div>
      }
      @if(openOrders(table).length){
       <p class="ord-note ord-table-blocked">
        Esta mesa tiene {{openOrders(table).length===1?'un pedido abierto':'pedidos abiertos'}}.
        Debes finalizar su preparación y cerrar {{openOrders(table).length===1?'el pedido':'los pedidos'}}
        antes de liberarla.
       </p>
       @if(access.canKitchenRead()){
        <a routerLink="/orders/kitchen" class="ord-table-kitchen-link">Ver comandas de cocina</a>
       }
      }
     }
     <div class="ord-actions">
      @if(!table.ocupacion&&table.activa&&access.canCreate()){
       <button type="button" class="ord-primary" (click)="openTable(table)">Tomar pedido</button>}
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
   </div>
  </div>
  @if(manageTab()==='rooms'){
  <h3>Salas</h3>
  <div class="ord-small-list">
   @for(room of rooms();track room.id){
    <div class="ord-setting-row">
     <strong>{{room.nombre}}</strong><span>{{room.activa?'Activa':'Inactiva'}}</span>
     <div class="ord-actions">
      <button type="button" (click)="editRoom(room)">Renombrar</button>
      <button type="button" (click)="toggleRoom(room)" [disabled]="actionBusy()">{{room.activa?'Desactivar':'Activar'}}</button>
     </div>
    </div>
   }
  </div>
  <fieldset class="ord-section"><legend>{{roomId()?'Editar sala':'Nueva sala'}}</legend>
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
    <div class="ord-setting-row">
     <div><strong>Mesa {{t.numero}}</strong>
      <small>{{t.sala.nombre}} · {{t.capacidad}} personas · {{t.activa?'Activa':'Inactiva'}}</small>
     </div>
     <button type="button" (click)="editTable(t)" [disabled]="actionBusy()">Editar</button>
    </div>
   } @empty {<p>No hay mesas configuradas.</p>}
  </div>
  <fieldset class="ord-section"><legend>{{tableId()?'Editar mesa':'Nueva mesa'}}</legend>
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
 protected readonly branch=inject(GcBranchContext);protected readonly access=inject(OrdersAccess);
 protected readonly money=money;
 protected readonly rooms=signal<Room[]>([]);protected readonly tables=signal<TableRecord[]>([]);
 protected readonly selectedRoom=signal('');protected readonly busy=signal(false);
 protected readonly manageTab=signal<'rooms'|'tables'>('rooms');
 protected readonly actionBusy=signal(false);protected readonly error=signal<string|null>(null);
 protected readonly roomId=signal('');protected readonly roomName=signal('');
 protected readonly tableId=signal('');protected readonly tableRoom=signal('');
 protected readonly tableNumber=signal('');protected readonly capacity=signal(2);
 protected readonly visibleTables=computed(()=>this.tables().filter(x=>!this.selectedRoom()||x.sala.id===this.selectedRoom()));
 protected readonly availableCount=computed(()=>this.tables().filter(t=>t.activa&&!t.ocupacion).length);
 protected readonly occupiedCount=computed(()=>this.tables().filter(t=>t.activa&&t.ocupacion).length);
 protected readonly inactiveCount=computed(()=>this.tables().filter(t=>!t.activa).length);
 protected readonly roomOptions=computed(()=>this.rooms().filter(x=>x.activa).map(x=>({id:x.id,label:x.nombre})));
 protected readonly editingTable=computed(()=>this.tables().find(x=>x.id===this.tableId()));
 private generation=0;
 constructor(){effect(()=>{
  const id=this.branch.branchId();
  if(id){this.selectedRoom.set('');void this.load()}
 })}
 protected async load(){
  const id=this.branch.branchId();if(!id||!this.access.canTablesRead())return;
  const gen=++this.generation;this.busy.set(true);this.error.set(null);
  try{
   const [rooms,tables]=await Promise.all([firstValueFrom(this.api.rooms(id)),firstValueFrom(this.api.tables(id))]);
   if(gen!==this.generation)return;
   this.rooms.set(rooms);this.tables.set(tables);
  }catch(e){if(gen===this.generation)this.error.set(gcErrorMessage(e))}
  finally{if(gen===this.generation)this.busy.set(false)}
 }
 protected openTable(table:TableRecord){
  void this.router.navigate(['/orders/pos'],{queryParams:{mesaId:table.id}});
 }
 protected openOrders(table:TableRecord){
  return (table.ocupacion?.ordenesComoOcupacionMesa??[]).filter(order=>order.estado==='ABIERTA');
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
}
